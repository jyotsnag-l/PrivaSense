"""
Storage adapter that intelligently switches between local and MongoDB storage.
Falls back to local storage if MongoDB is unavailable.
"""

import os
import logging
from typing import Dict, List, Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
USE_MONGODB = os.getenv("USE_MONGODB", "false").lower() == "true"

# Local imports
from storage.local_store import (
    load_json as local_load_json,
    save_json as local_save_json,
    append_history as local_append_history,
    get_user_history as local_get_user_history,
    get_caregiver_chat_id as local_get_caregiver_chat_id,
    save_caregiver_link as local_save_caregiver_link,
    load_alert_log as local_load_alert_log,
    save_alert_log as local_save_alert_log,
    get_last_alert_time as local_get_last_alert_time,
    record_alert as local_record_alert,
)

# MongoDB imports (conditional)
try:
    from storage.mongo_store import MongoStore, get_mongo_store
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False
    logger.warning("pymongo not installed. MongoDB storage unavailable.")


class StorageAdapter:
    """
    Unified storage interface that switches between local and MongoDB backends.
    Automatically falls back to local storage if MongoDB is unavailable.
    """

    def __init__(self):
        """Initialize the storage adapter."""
        self.use_mongodb = USE_MONGODB and MONGO_AVAILABLE
        self.mongo_store = None

        if self.use_mongodb:
            try:
                self.mongo_store = get_mongo_store()
                if self.mongo_store.is_connected():
                    logger.info("Using MongoDB for data storage")
                else:
                    logger.warning("MongoDB connection failed, falling back to local storage")
                    self.use_mongodb = False
            except Exception as e:
                logger.warning(f"MongoDB initialization failed: {e}, using local storage")
                self.use_mongodb = False

        if not self.use_mongodb:
            logger.info("Using local file storage")

    # ============== Baselines ==============

    def load_baselines(self) -> Dict:
        """Load all user baselines."""
        if self.use_mongodb:
            return self.mongo_store.load_baselines()
        return local_load_json("privasense_baselines.json")

    def save_baselines(self, baselines: Dict) -> None:
        """Save all user baselines."""
        if self.use_mongodb:
            self.mongo_store.save_baselines(baselines)
        else:
            local_save_json("privasense_baselines.json", baselines)

    def get_baseline(self, user_id: str, baselines: Dict) -> Dict[str, float]:
        """Get baseline for a specific user."""
        if self.use_mongodb:
            return self.mongo_store.get_baseline(user_id, baselines)
        return local_get_baseline_from_dict(user_id, baselines)

    def update_baseline(self, user_id: str, features: Dict[str, float], baselines: Dict) -> Dict:
        """Update a user's baseline."""
        from pipeline.baseline import update_baseline as local_update_baseline

        # Use the local update logic (works with both backends)
        updated_baselines = local_update_baseline(user_id, features, baselines)

        # Save to the appropriate backend
        if self.use_mongodb:
            self.mongo_store.save_baselines(updated_baselines)
        else:
            local_save_json("privasense_baselines.json", updated_baselines)

        return updated_baselines

    # ============== History ==============

    def append_history(
        self,
        user_id: str,
        features: Dict[str, float],
        pdi: float,
        risk: str
    ) -> None:
        """Append a session to the history."""
        if self.use_mongodb:
            self.mongo_store.append_history(user_id, features, pdi, risk)
        else:
            local_append_history(user_id, features, pdi, risk)

    def get_user_history(self, user_id: str) -> List[Dict]:
        """Get all history entries for a user."""
        if self.use_mongodb:
            return self.mongo_store.get_user_history(user_id)
        return local_get_user_history(user_id)

    # ============== Caregiver Links ==============

    def get_caregiver_chat_id(self, user_id: str) -> Optional[int]:
        """Get the caregiver Telegram chat ID for a user."""
        if self.use_mongodb:
            return self.mongo_store.get_caregiver_chat_id(user_id)
        return local_get_caregiver_chat_id(user_id)

    def save_caregiver_link(self, user_id: str, caregiver_chat_id: int) -> None:
        """Save a caregiver link mapping."""
        if self.use_mongodb:
            self.mongo_store.save_caregiver_link(user_id, caregiver_chat_id)
        else:
            local_save_caregiver_link(user_id, caregiver_chat_id)

    # ============== Alert Log ==============

    def load_alert_log(self) -> Dict:
        """Load the alert log."""
        if self.use_mongodb:
            return self.mongo_store.load_alert_log()
        return local_load_alert_log()

    def save_alert_log(self, log: Dict) -> None:
        """Save the alert log."""
        if self.use_mongodb:
            self.mongo_store.save_alert_log(log)
        else:
            local_save_alert_log(log)

    def get_last_alert_time(self, user_id: str) -> Optional["datetime"]:
        """Get the last alert time for a user."""
        if self.use_mongodb:
            return self.mongo_store.get_last_alert_time(user_id)
        return local_get_last_alert_time(user_id)

    def record_alert(self, user_id: str) -> None:
        """Record that an alert was sent for a user."""
        if self.use_mongodb:
            self.mongo_store.record_alert(user_id)
        else:
            local_record_alert(user_id)

    def close(self) -> None:
        """Close any open connections."""
        if self.mongo_store:
            self.mongo_store.close()


# Helper function for local baseline retrieval
def local_get_baseline_from_dict(user_id: str, baselines: Dict) -> Dict[str, float]:
    """Get baseline from a baselines dict."""
    user_data = baselines.get(user_id)
    if user_data is None:
        return {}
    return user_data.get("baseline", {})


# Import datetime for type hint
from datetime import datetime


# Global adapter instance
_storage_adapter: Optional[StorageAdapter] = None


def get_storage_adapter() -> StorageAdapter:
    """
    Get or create the global storage adapter instance.

    Returns:
        StorageAdapter instance
    """
    global _storage_adapter
    if _storage_adapter is None:
        _storage_adapter = StorageAdapter()
    return _storage_adapter


# ============== Convenience Functions ==============
# These mirror the local_store functions for easy migration

def load_json(filename: str) -> Dict:
    """Load a JSON file (always uses local storage)."""
    return local_load_json(filename)


def save_json(filename: str, data: Dict) -> None:
    """Save a JSON file (always uses local storage)."""
    local_save_json(filename, data)


def append_history(user_id: str, features: Dict[str, float], pdi: float, risk: str) -> None:
    """Append to history using the adapter."""
    get_storage_adapter().append_history(user_id, features, pdi, risk)


def get_user_history(user_id: str) -> List[Dict]:
    """Get user history using the adapter."""
    return get_storage_adapter().get_user_history(user_id)


def get_caregiver_chat_id(user_id: str) -> Optional[int]:
    """Get caregiver chat ID using the adapter."""
    return get_storage_adapter().get_caregiver_chat_id(user_id)


def save_caregiver_link(user_id: str, caregiver_chat_id: int) -> None:
    """Save caregiver link using the adapter."""
    get_storage_adapter().save_caregiver_link(user_id, caregiver_chat_id)


def load_alert_log() -> Dict:
    """Load alert log using the adapter."""
    return get_storage_adapter().load_alert_log()


def save_alert_log(log: Dict) -> None:
    """Save alert log using the adapter."""
    get_storage_adapter().save_alert_log(log)


def get_last_alert_time(user_id: str) -> Optional[datetime]:
    """Get last alert time using the adapter."""
    return get_storage_adapter().get_last_alert_time(user_id)


def record_alert(user_id: str) -> None:
    """Record alert using the adapter."""
    get_storage_adapter().record_alert(user_id)