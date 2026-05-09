"""
Telegram bot command handlers.
Implements /start, /help, /link, /status, /report, /trend commands.
"""

import os
import logging
from datetime import datetime
from typing import List, Dict

from telegram import Update
from telegram.ext import ContextTypes

from storage.local_store import (
    get_user_history,
    save_caregiver_link,
    load_json,
)

logger = logging.getLogger(__name__)


async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "Welcome to PrivaSense Caregiver Bot. Use /help to see commands."
    )


async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    help_text = """
🏠 PrivaSense Caregiver Bot — Available Commands

/link <user_id>     Link yourself to receive alerts for a user
/status <user_id>   Get latest PDI score and risk level
/report <user_id>   Get detailed feature breakdown for latest session
/trend <user_id>    View PDI trend over last 7 sessions
/help               Show this help message

Example: /link user123
         /status user123
         /report user123
         /trend user123
"""
    await update.message.reply_text(help_text)


async def handle_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /link command — links caregiver to a user."""
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("Usage: /link <user_id>")
        return

    user_id = context.args[0]
    caregiver_chat_id = update.effective_chat.id

    try:
        save_caregiver_link(user_id, caregiver_chat_id)
        await update.message.reply_text(
            f"You are now linked to monitoring updates for {user_id}."
        )
    except Exception as e:
        logger.error(f"Error saving caregiver link: {e}")
        await update.message.reply_text("Error linking caregiver. Please try again.")


async def handle_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command — shows latest PDI and risk."""
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("Usage: /status <user_id>")
        return

    user_id = context.args[0]
    history = get_user_history(user_id)

    if not history:
        await update.message.reply_text(f"No data found for {user_id}.")
        return

    # Get latest session (first in list since sorted newest first)
    latest = history[0]

    # Count total sessions for this user
    total_sessions = len(history)

    # Format timestamp
    try:
        dt = datetime.fromisoformat(latest["timestamp"])
        last_seen = dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, KeyError):
        last_seen = latest.get("timestamp", "unknown")

    response = f"""
User: {user_id}
PDI Score: {float(latest.get('pdi', 0)):.3f}
Risk: {latest.get('risk', 'UNKNOWN')}
Last session: {last_seen}
Total sessions: {total_sessions}
"""
    await update.message.reply_text(response)


async def handle_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /report command — detailed feature breakdown."""
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("Usage: /report <user_id>")
        return

    user_id = context.args[0]
    history = get_user_history(user_id)

    if not history:
        await update.message.reply_text(f"No data found for {user_id}.")
        return

    latest = history[0]

    # Format timestamp
    try:
        dt = datetime.fromisoformat(latest["timestamp"])
        session_time = dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, KeyError):
        session_time = latest.get("timestamp", "unknown")

    # Feature labels for display
    feature_labels = {
        "pause_rate": "Pause rate",
        "mean_pause_duration": "Mean pause duration",
        "speech_rate_wpm": "Speech rate (WPM)",
        "filler_rate": "Filler rate",
        "lexical_diversity": "Lexical diversity",
        "pitch_variability": "Pitch variability",
    }

    feature_domains = {
        "pause_rate": "Language fluency",
        "mean_pause_duration": "Language fluency",
        "speech_rate_wpm": "Processing speed",
        "filler_rate": "Working memory",
        "lexical_diversity": "Memory retrieval",
        "pitch_variability": "Emotional regulation",
    }

    # Build feature breakdown
    feature_lines = []
    top_driver = None
    top_driver_abs = 0.0

    for feature_key in feature_labels:
        today_val = float(latest.get(feature_key, 0.0))
        label = feature_labels[feature_key]
        domain = feature_domains[feature_key]

        # For display, we'll show the value and domain
        feature_lines.append(
            f"  {label:.<25} today={today_val:.2f}  [{domain}]"
        )

    # Find top driver (feature with highest absolute value deviation from normal)
    # Since we don't have baseline in history CSV, we'll use the feature with highest value
    # as a proxy for "most active" feature
    for feature_key in feature_labels:
        val = abs(float(latest.get(feature_key, 0.0)))
        if val > top_driver_abs:
            top_driver_abs = val
            top_driver = feature_labels[feature_key]

    # Format the report
    report = f"""
📋 PrivaSense Report — {user_id}
Session: {session_time}
PDI: {float(latest.get('pdi', 0)):.3f} | Risk: {latest.get('risk', 'UNKNOWN')}

Feature breakdown:
{chr(10).join(feature_lines)}

Top driver: {top_driver}

⚠️ Note: Not a medical device. Consult a professional for clinical assessment.
"""
    await update.message.reply_text(report)


async def handle_trend(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /trend command — shows PDI trend over last 7 sessions."""
    if not context.args or len(context.args) == 0:
        await update.message.reply_text("Usage: /trend <user_id>")
        return

    user_id = context.args[0]
    history = get_user_history(user_id)

    if not history:
        await update.message.reply_text(f"No data found for {user_id}.")
        return

    # Get last 7 sessions (already sorted newest first, so reverse for chronological)
    sessions = history[:7]
    sessions.reverse()  # Now oldest first

    if len(sessions) < 2:
        await update.message.reply_text(
            "Not enough data for trend. Need at least 2 sessions."
        )
        return

    # Extract PDI values
    pdi_values = [float(s.get("pdi", 0.0)) for s in sessions]

    # Create sparkline
    sparkline_chars = "▁▂▃▄▅▆▇█"
    min_pdi = min(pdi_values)
    max_pdi = max(pdi_values)
    range_pdi = max_pdi - min_pdi if max_pdi > min_pdi else 1.0

    sparkline = []
    for pdi in pdi_values:
        # Normalize to 0-1 range and map to sparkline character
        normalized = (pdi - min_pdi) / range_pdi
        idx = int(normalized * (len(sparkline_chars) - 1))
        idx = max(0, min(idx, len(sparkline_chars) - 1))
        sparkline.append(sparkline_chars[idx])

    # Build trend arrows
    trend_parts = []
    for i, (pdi, spark) in enumerate(zip(pdi_values, sparkline)):
        trend_parts.append(f"{pdi:.2f} {spark}")

    trend_str = " → ".join(trend_parts)

    # Determine trend direction (last 3 sessions)
    trend_label = "STABLE"
    if len(pdi_values) >= 3:
        last_three = pdi_values[-3:]
        if last_three[0] < last_three[1] < last_three[2]:
            trend_label = "RISING 🔺"
        elif last_three[0] > last_three[1] > last_three[2]:
            trend_label = "FALLING 🔻"

    response = f"""
📈 PDI Trend — last {len(sessions)} sessions for {user_id}:

{trend_str}

Trend: {trend_label}
"""
    await update.message.reply_text(response)