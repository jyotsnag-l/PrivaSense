"""
EMA (Exponential Moving Average) baseline engine.
Manages per-user baseline storage and updates.
"""

import json
import os
import logging
from typing import Dict

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Storage configuration
STORAGE_DIR = os.getenv("STORAGE_DIR", "./data")
BASELINES_FILE = os.path.join(STORAGE_DIR, "privasense_baselines.json")

# EMA smoothing factor: alpha = 2 / (span + 1) where span = 7
EMA_ALPHA = 2 / (7 + 1)  # = 0.25


def _ensure_storage_dir() -> None:
    """Create storage directory if it doesn't exist."""
    os.makedirs(STORAGE_DIR, exist_ok=True)


def load_baselines() -> Dict:
    """
    Load all user baselines from storage.

    Returns:
        Dict with schema: { user_id: { "baseline": {feature: float}, "sessions": int } }
        Returns empty dict if file doesn't exist.
    """
    _ensure_storage_dir()

    if not os.path.exists(BASELINES_FILE):
        return {}

    try:
        with open(BASELINES_FILE, "r") as f:
            data = json.load(f)
        return data
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Error loading baselines: {e}")
        return {}


def save_baselines(baselines: Dict) -> None:
    """
    Save all user baselines to storage.

    Args:
        baselines: Dict with user baselines data
    """
    _ensure_storage_dir()

    try:
        with open(BASELINES_FILE, "w") as f:
            json.dump(baselines, f, indent=2)
    except IOError as e:
        logger.error(f"Error saving baselines: {e}")
        raise


def get_baseline(user_id: str, baselines: Dict) -> Dict[str, float]:
    """
    Get the baseline feature values for a specific user.

    Args:
        user_id: User identifier
        baselines: Full baselines dict from load_baselines()

    Returns:
        Dict of feature: value pairs. Empty dict if user not found.
    """
    user_data = baselines.get(user_id)
    if user_data is None:
        return {}
    return user_data.get("baseline", {})


def update_baseline(user_id: str, features: Dict[str, float], baselines: Dict) -> Dict:
    """
    Update a user's baseline with new feature values using EMA.

    First session: baseline = features.copy(), sessions = 1
    Subsequent: new_bl_i = alpha * f_i + (1 - alpha) * old_bl_i, sessions += 1

    Args:
        user_id: User identifier
        features: Current session features
        baselines: Full baselines dict from load_baselines()

    Returns:
        Updated baselines dict (also saves to disk)
    """
    if user_id not in baselines:
        # First session — initialize baseline
        baselines[user_id] = {
            "baseline": features.copy(),
            "sessions": 1,
        }
    else:
        # Subsequent session — EMA update
        user_data = baselines[user_id]
        old_baseline = user_data["baseline"]
        new_baseline = {}

        for feature_name, current_value in features.items():
            old_value = old_baseline.get(feature_name, current_value)
            new_baseline[feature_name] = EMA_ALPHA * current_value + (1 - EMA_ALPHA) * old_value

        # Ensure all old baseline features are preserved
        for feature_name in old_baseline:
            if feature_name not in new_baseline:
                new_baseline[feature_name] = old_baseline[feature_name]

        user_data["baseline"] = new_baseline
        user_data["sessions"] = user_data.get("sessions", 0) + 1

    # Save updated baselines
    save_baselines(baselines)

    return baselines