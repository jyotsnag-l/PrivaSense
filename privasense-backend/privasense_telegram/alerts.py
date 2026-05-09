"""
Alert engine — auto-pushes notifications on HIGH risk or rising trend.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv

from storage.local_store import (
    get_user_history,
    get_caregiver_chat_id,
    load_json,
    save_json,
    record_alert,
    get_last_alert_time,
)
from pipeline.pdi import risk_label

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
ALERT_CHAT_ID = os.getenv("ALERT_CHAT_ID")
PDI_ALERT_THRESHOLD = float(os.getenv("PDI_ALERT_THRESHOLD", "0.50"))
PDI_TREND_WINDOW = int(os.getenv("PDI_TREND_WINDOW", "3"))

# De-duplication: don't send more than one alert per user per 6 hours
ALERT_COOLDOWN_HOURS = 6

# Alert log file
ALERT_LOG_FILE = "alert_log.json"


def _get_bot():
    """
    Get the bot instance for sending messages.
    Lazy import to avoid circular dependencies.
    """
    from privasense_telegram.bot import get_bot_app
    app = get_bot_app()
    return app.bot


def _get_alert_target(user_id: str) -> Optional[int]:
    """
    Determine where to send alerts for a user.

    Priority:
    1. Caregiver chat ID from caregiver_links.json
    2. ALERT_CHAT_ID environment variable
    3. None (no target)

    Returns:
        Telegram chat ID as int, or None
    """
    # Try to get linked caregiver
    caregiver_chat_id = get_caregiver_chat_id(user_id)
    if caregiver_chat_id is not None:
        return caregiver_chat_id

    # Fallback to default alert chat ID
    if ALERT_CHAT_ID:
        try:
            return int(ALERT_CHAT_ID)
        except ValueError:
            logger.warning(f"Invalid ALERT_CHAT_ID: {ALERT_CHAT_ID}")
            return None

    return None


def _should_send_alert(user_id: str) -> bool:
    """
    Check if we should send an alert (de-duplication).

    Returns:
        True if no alert sent in last ALERT_COOLDOWN_HOURS, False otherwise
    """
    last_alert_time = get_last_alert_time(user_id)

    if last_alert_time is None:
        return True

    cooldown_end = last_alert_time + timedelta(hours=ALERT_COOLDOWN_HOURS)
    if datetime.utcnow() > cooldown_end:
        return True

    return False


def _check_rising_trend(user_id: str) -> bool:
    """
    Check if the user has a rising trend over the last PDI_TREND_WINDOW sessions.

    Criteria:
    - Last PDI_TREND_WINDOW sessions all rising (each > previous)
    - All sessions in window are MEDIUM or HIGH risk

    Returns:
        True if rising trend detected, False otherwise
    """
    history = get_user_history(user_id)

    if len(history) < PDI_TREND_WINDOW:
        return False

    # Get last PDI_TREND_WINDOW sessions (newest first, so reverse)
    recent = history[:PDI_TREND_WINDOW]
    recent.reverse()  # Now oldest first

    # Check all are MEDIUM or HIGH
    for session in recent:
        risk = session.get("risk", "LOW")
        if risk not in ("MEDIUM", "HIGH"):
            return False

    # Check strictly rising
    pdi_values = [float(s.get("pdi", 0.0)) for s in recent]

    for i in range(1, len(pdi_values)):
        if pdi_values[i] <= pdi_values[i - 1]:
            return False

    return True


def _build_alert_message(user_id: str, pdi: float, risk: str, features: dict) -> str:
    """
    Build the alert message text.

    Args:
        user_id: User identifier
        pdi: PDI score
        risk: Risk level
        features: Feature dict with today's values

    Returns:
        Formatted alert message
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    # Find top 3 features by absolute value (as proxy for importance)
    sorted_features = sorted(
        features.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:3]

    key_signals = []
    for feature_name, value in sorted_features:
        key_signals.append(f"  • {feature_name}: {value:.3f}")

    message = f"""
🔔 PrivaSense Alert

User: {user_id}
PDI Score: {pdi:.3f}
Risk Level: {risk}
Session: {timestamp}

Key signals:
{chr(10).join(key_signals)}

Recommended: Check in with {user_id} today.
(Not a clinical diagnosis)
"""
    return message


def maybe_send_alert(user_id: str, result: dict) -> bool:
    """
    Main alert function — called after every /analyze and /demo pipeline run.

    Alert fires if:
    1. SINGLE-SESSION HIGH: result.risk == "HIGH"
    OR
    2. RISING TREND: last PDI_TREND_WINDOW sessions all rising

    De-duplication: do NOT send alert if already sent for this user in last 6 hours.

    Args:
        user_id: User identifier
        result: AnalyzeResponse-like dict with pdi, risk, features, etc.

    Returns:
        True if alert was sent, False otherwise
    """
    pdi = result.get("pdi", 0.0)
    risk = result.get("risk", "LOW")
    features = result.get("features", {})

    # Check de-duplication
    if not _should_send_alert(user_id):
        logger.info(f"Alert suppressed for {user_id} (cooldown active)")
        return False

    # Determine if alert should fire
    should_alert = False

    # Condition 1: HIGH risk
    if risk == "HIGH":
        should_alert = True
        logger.info(f"Alert triggered for {user_id}: HIGH risk (PDI={pdi:.3f})")

    # Condition 2: Rising trend
    if not should_alert and _check_rising_trend(user_id):
        should_alert = True
        logger.info(f"Alert triggered for {user_id}: rising trend detected")

    if not should_alert:
        return False

    # Get alert target
    chat_id = _get_alert_target(user_id)
    if chat_id is None:
        logger.warning(f"No alert target for user {user_id}, skipping alert")
        return False

    # Build and send message
    message = _build_alert_message(user_id, pdi, risk, features)

    try:
        bot = _get_bot()
        bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode="Markdown"
        )

        # Record alert for de-duplication
        record_alert(user_id)
        logger.info(f"Alert sent to chat {chat_id} for user {user_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to send Telegram alert: {e}")
        return False