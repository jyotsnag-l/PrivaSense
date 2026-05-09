"""
Local storage helpers for JSON and CSV file management.
All files live in STORAGE_DIR (default ./data).
"""

import csv
import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Storage configuration
STORAGE_DIR = os.getenv("STORAGE_DIR", "./data")

# File paths
BASELINES_FILE = os.path.join(STORAGE_DIR, "privasense_baselines.json")
HISTORY_FILE = os.path.join(STORAGE_DIR, "privasense_history.csv")
CAREGIVER_LINKS_FILE = os.path.join(STORAGE_DIR, "caregiver_links.json")
ALERT_LOG_FILE = os.path.join(STORAGE_DIR, "alert_log.json")

# History CSV columns
HISTORY_COLUMNS = [
    "timestamp",
    "user_id",
    "pdi",
    "risk",
    "pause_rate",
    "mean_pause_duration",
    "speech_rate_wpm",
    "filler_rate",
    "lexical_diversity",
    "pitch_variability",
]


def _ensure_storage_dir() -> None:
    """Create storage directory if it doesn't exist."""
    os.makedirs(STORAGE_DIR, exist_ok=True)


def load_json(filename: str) -> Dict:
    """
    Load a JSON file from storage.

    Args:
        filename: Name of the JSON file

    Returns:
        Dict contents, or empty dict if file doesn't exist
    """
    _ensure_storage_dir()
    filepath = os.path.join(STORAGE_DIR, filename)

    if not os.path.exists(filepath):
        return {}

    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Error loading {filename}: {e}")
        return {}


def save_json(filename: str, data: Dict) -> None:
    """
    Save a dict to a JSON file in storage.

    Args:
        filename: Name of the JSON file
        data: Dict to save
    """
    _ensure_storage_dir()
    filepath = os.path.join(STORAGE_DIR, filename)

    try:
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
    except IOError as e:
        logger.error(f"Error saving {filename}: {e}")
        raise


def append_history(
    user_id: str,
    features: Dict[str, float],
    pdi: float,
    risk: str,
) -> None:
    """
    Append a session to the history CSV.

    Args:
        user_id: User identifier
        features: Dict of extracted features
        pdi: PDI score
        risk: Risk level string
    """
    _ensure_storage_dir()
    filepath = HISTORY_FILE

    # Check if file exists to determine if we need to write headers
    file_exists = os.path.exists(filepath)

    row = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "pdi": round(pdi, 4),
        "risk": risk,
        "pause_rate": round(features.get("pause_rate", 0.0), 4),
        "mean_pause_duration": round(features.get("mean_pause_duration", 0.0), 4),
        "speech_rate_wpm": round(features.get("speech_rate_wpm", 0.0), 4),
        "filler_rate": round(features.get("filler_rate", 0.0), 4),
        "lexical_diversity": round(features.get("lexical_diversity", 0.0), 4),
        "pitch_variability": round(features.get("pitch_variability", 0.0), 4),
    }

    try:
        with open(filepath, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=HISTORY_COLUMNS)
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)
    except IOError as e:
        logger.error(f"Error appending to history: {e}")
        raise


def get_user_history(user_id: str) -> List[Dict]:
    """
    Get all history entries for a user, sorted newest first.

    Args:
        user_id: User identifier

    Returns:
        List of dicts with session data, newest first
    """
    _ensure_storage_dir()
    filepath = HISTORY_FILE

    if not os.path.exists(filepath):
        return []

    try:
        with open(filepath, "r", newline="") as f:
            reader = csv.DictReader(f)
            rows = [row for row in reader if row["user_id"] == user_id]

        # Sort by timestamp descending (newest first)
        rows.sort(key=lambda x: x["timestamp"], reverse=True)

        return rows
    except IOError as e:
        logger.warning(f"Error reading history: {e}")
        return []


def get_caregiver_chat_id(user_id: str) -> Optional[int]:
    """
    Get the caregiver Telegram chat ID for a user.

    Args:
        user_id: User identifier

    Returns:
        Telegram chat ID as int, or None if not linked
    """
    links = load_json("caregiver_links.json")
    chat_id = links.get(user_id)

    if chat_id is not None:
        return int(chat_id)
    return None


def save_caregiver_link(user_id: str, caregiver_chat_id: int) -> None:
    """
    Save a caregiver link mapping.

    Args:
        user_id: User identifier
        caregiver_chat_id: Telegram chat ID of the caregiver
    """
    links = load_json("caregiver_links.json")
    links[user_id] = caregiver_chat_id
    save_json("caregiver_links.json", links)


def load_alert_log() -> Dict:
    """
    Load the alert log.

    Returns:
        Dict with { user_id: ISO_timestamp } of last alert
    """
    return load_json("alert_log.json")


def save_alert_log(log: Dict) -> None:
    """
    Save the alert log.

    Args:
        log: Dict with alert timestamps
    """
    save_json("alert_log.json", log)


def get_last_alert_time(user_id: str) -> Optional[datetime]:
    """
    Get the last alert time for a user.

    Args:
        user_id: User identifier

    Returns:
        datetime of last alert, or None if never alerted
    """
    log = load_alert_log()
    timestamp_str = log.get(user_id)

    if timestamp_str is None:
        return None

    try:
        return datetime.fromisoformat(timestamp_str)
    except ValueError:
        return None


def record_alert(user_id: str) -> None:
    """
    Record that an alert was sent for a user.

    Args:
        user_id: User identifier
    """
    log = load_alert_log()
    log[user_id] = datetime.utcnow().isoformat()
    save_alert_log(log)