"""
MongoDB storage layer for PrivaSense.
Provides scalable data storage as an alternative to local JSON/CSV files.
"""

import os
import logging
from datetime import datetime
from typing import Dict, List, Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "privasense")

# Collections
COLLECTION_BASELINES = "baselines"
COLLECTION_HISTORY = "history"
COLLECTION_CAREGIVER_LINKS = "caregiver_links"
COLLECTION_ALERT_LOG = "alert_log"


class MongoStore:
    """MongoDB storage handler for PrivaSense data."""

    def __init__(self, uri: str = None, db_name: str = None):
        """
        Initialize MongoDB connection.

        Args:
            uri: MongoDB connection URI
            db_name: Database name
        """
        self.uri = uri or MONGO_URI
        self.db_name = db_name or MONGO_DB_NAME
        self.client = None
        self.db = None
        self._connect()

    def _connect(self) -> None:
        """Establish MongoDB connection."""
        try:
            self.client = MongoClient(
                self.uri,
                serverSelectionTimeoutMS=5000,
                connect=True
            )
            self.db = self.client[self.db_name]

            # Create indexes for better query performance
            self._create_indexes()

            logger.info(f"Connected to MongoDB: {self.db_name}")
        except ConnectionFailure as e:
            logger.warning(f"MongoDB connection failed: {e}")
            self.client = None
            self.db = None

    def _create_indexes(self) -> None:
        """Create indexes for optimal query performance."""
        try:
            # History collection indexes
            self.db[COLLECTION_HISTORY].create_index([("user_id", 1), ("timestamp", -1)])
            self.db[COLLECTION_HISTORY].create_index([("user_id", 1)])

            # Baselines collection indexes
            self.db[COLLECTION_BASELINES].create_index([("user_id", 1)], unique=True)

            # Caregiver links indexes
            self.db[COLLECTION_CAREGIVER_LINKS].create_index([("user_id", 1)], unique=True)

            # Alert log indexes
            self.db[COLLECTION_ALERT_LOG].create_index([("user_id", 1)], unique=True)
        except PyMongoError as e:
            logger.warning(f"Error creating indexes: {e}")

    def is_connected(self) -> bool:
        """Check if MongoDB connection is active."""
        if self.client is None:
            return False
        try:
            self.client.admin.command('ping')
            return True
        except Exception:
            return False

    # ============== Baselines ==============

    def load_baselines(self) -> Dict:
        """
        Load all user baselines from MongoDB.

        Returns:
            Dict with schema: { user_id: { "baseline": {feature: float}, "sessions": int } }
        """
        if not self.is_connected():
            return {}

        try:
            baselines = {}
            for doc in self.db[COLLECTION_BASELINES].find():
                user_id = doc["user_id"]
                baselines[user_id] = {
                    "baseline": doc["baseline"],
                    "sessions": doc["sessions"]
                }
            return baselines
        except PyMongoError as e:
            logger.warning(f"Error loading baselines: {e}")
            return {}

    def save_baselines(self, baselines: Dict) -> None:
        """
        Save all user baselines to MongoDB.

        Args:
            baselines: Dict with user baselines data
        """
        if not self.is_connected():
            return

        try:
            for user_id, data in baselines.items():
                self.db[COLLECTION_BASELINES].update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "baseline": data["baseline"],
                            "sessions": data["sessions"],
                            "updated_at": datetime.utcnow()
                        }
                    },
                    upsert=True
                )
        except PyMongoError as e:
            logger.error(f"Error saving baselines: {e}")

    def get_baseline(self, user_id: str, baselines: Dict = None) -> Dict[str, float]:
        """
        Get baseline for a specific user.

        Args:
            user_id: User identifier
            baselines: Optional pre-loaded baselines dict

        Returns:
            Dict of feature: value pairs
        """
        if baselines is not None:
            user_data = baselines.get(user_id)
            if user_data:
                return user_data.get("baseline", {})
            return {}

        if not self.is_connected():
            return {}

        try:
            doc = self.db[COLLECTION_BASELINES].find_one({"user_id": user_id})
            if doc:
                return doc.get("baseline", {})
            return {}
        except PyMongoError as e:
            logger.warning(f"Error getting baseline: {e}")
            return {}

    def update_baseline(self, user_id: str, features: Dict[str, float], baselines: Dict) -> Dict:
        """
        Update a user's baseline (EMA update).

        Args:
            user_id: User identifier
            features: Current session features
            baselines: Full baselines dict

        Returns:
            Updated baselines dict
        """
        from pipeline.baseline import EMA_ALPHA

        if user_id not in baselines:
            # First session
            baselines[user_id] = {
                "baseline": features.copy(),
                "sessions": 1
            }
        else:
            # EMA update
            user_data = baselines[user_id]
            old_baseline = user_data["baseline"]
            new_baseline = {}

            for feature_name, current_value in features.items():
                old_value = old_baseline.get(feature_name, current_value)
                new_baseline[feature_name] = EMA_ALPHA * current_value + (1 - EMA_ALPHA) * old_value

            # Preserve old features
            for feature_name in old_baseline:
                if feature_name not in new_baseline:
                    new_baseline[feature_name] = old_baseline[feature_name]

            user_data["baseline"] = new_baseline
            user_data["sessions"] = user_data.get("sessions", 0) + 1

        # Save to MongoDB
        self.save_baselines(baselines)

        return baselines

    # ============== History ==============

    def append_history(
        self,
        user_id: str,
        features: Dict[str, float],
        pdi: float,
        risk: str
    ) -> None:
        """
        Append a session to the history.

        Args:
            user_id: User identifier
            features: Dict of extracted features
            pdi: PDI score
            risk: Risk level string
        """
        if not self.is_connected():
            return

        try:
            document = {
                "user_id": user_id,
                "pdi": round(pdi, 4),
                "risk": risk,
                "features": {
                    "pause_rate": round(features.get("pause_rate", 0.0), 4),
                    "mean_pause_duration": round(features.get("mean_pause_duration", 0.0), 4),
                    "speech_rate_wpm": round(features.get("speech_rate_wpm", 0.0), 4),
                    "filler_rate": round(features.get("filler_rate", 0.0), 4),
                    "lexical_diversity": round(features.get("lexical_diversity", 0.0), 4),
                    "pitch_variability": round(features.get("pitch_variability", 0.0), 4),
                },
                "timestamp": datetime.utcnow()
            }

            self.db[COLLECTION_HISTORY].insert_one(document)
        except PyMongoError as e:
            logger.error(f"Error appending history: {e}")

    def get_user_history(self, user_id: str) -> List[Dict]:
        """
        Get all history entries for a user, sorted newest first.

        Args:
            user_id: User identifier

        Returns:
            List of dicts with session data
        """
        if not self.is_connected():
            return []

        try:
            cursor = self.db[COLLECTION_HISTORY].find(
                {"user_id": user_id}
            ).sort("timestamp", -1)

            sessions = []
            for doc in cursor:
                session = {
                    "timestamp": doc["timestamp"].isoformat(),
                    "user_id": doc["user_id"],
                    "pdi": doc["pdi"],
                    "risk": doc["risk"],
                }
                # Add individual features
                features = doc.get("features", {})
                for feature_name, value in features.items():
                    session[feature_name] = value
                sessions.append(session)

            return sessions
        except PyMongoError as e:
            logger.warning(f"Error reading history: {e}")
            return []

    # ============== Caregiver Links ==============

    def get_caregiver_chat_id(self, user_id: str) -> Optional[int]:
        """
        Get the caregiver Telegram chat ID for a user.

        Args:
            user_id: User identifier

        Returns:
            Telegram chat ID as int, or None if not linked
        """
        if not self.is_connected():
            return None

        try:
            doc = self.db[COLLECTION_CAREGIVER_LINKS].find_one({"user_id": user_id})
            if doc:
                return int(doc["caregiver_chat_id"])
            return None
        except PyMongoError as e:
            logger.warning(f"Error getting caregiver chat ID: {e}")
            return None

    def save_caregiver_link(self, user_id: str, caregiver_chat_id: int) -> None:
        """
        Save a caregiver link mapping.

        Args:
            user_id: User identifier
            caregiver_chat_id: Telegram chat ID of the caregiver
        """
        if not self.is_connected():
            return

        try:
            self.db[COLLECTION_CAREGIVER_LINKS].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "caregiver_chat_id": caregiver_chat_id,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
        except PyMongoError as e:
            logger.error(f"Error saving caregiver link: {e}")

    # ============== Alert Log ==============

    def load_alert_log(self) -> Dict:
        """
        Load the alert log.

        Returns:
            Dict with { user_id: ISO_timestamp } of last alert
        """
        if not self.is_connected():
            return {}

        try:
            alert_log = {}
            for doc in self.db[COLLECTION_ALERT_LOG].find():
                alert_log[doc["user_id"]] = doc["last_alert_time"]
            return alert_log
        except PyMongoError as e:
            logger.warning(f"Error loading alert log: {e}")
            return {}

    def save_alert_log(self, log: Dict) -> None:
        """
        Save the alert log.

        Args:
            log: Dict with alert timestamps
        """
        if not self.is_connected():
            return

        try:
            for user_id, timestamp in log.items():
                self.db[COLLECTION_ALERT_LOG].update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "last_alert_time": timestamp,
                            "updated_at": datetime.utcnow()
                        }
                    },
                    upsert=True
                )
        except PyMongoError as e:
            logger.error(f"Error saving alert log: {e}")

    def get_last_alert_time(self, user_id: str) -> Optional[datetime]:
        """
        Get the last alert time for a user.

        Args:
            user_id: User identifier

        Returns:
            datetime of last alert, or None if never alerted
        """
        if not self.is_connected():
            return None

        try:
            doc = self.db[COLLECTION_ALERT_LOG].find_one({"user_id": user_id})
            if doc:
                timestamp_str = doc.get("last_alert_time")
                if timestamp_str:
                    return datetime.fromisoformat(timestamp_str)
            return None
        except PyMongoError as e:
            logger.warning(f"Error getting last alert time: {e}")
            return None

    def record_alert(self, user_id: str) -> None:
        """
        Record that an alert was sent for a user.

        Args:
            user_id: User identifier
        """
        if not self.is_connected():
            return

        try:
            self.db[COLLECTION_ALERT_LOG].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "last_alert_time": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
        except PyMongoError as e:
            logger.error(f"Error recording alert: {e}")

    def close(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None


# Global MongoDB instance (lazy initialization)
_mongo_store: Optional[MongoStore] = None


def get_mongo_store() -> MongoStore:
    """
    Get or create the global MongoDB store instance.

    Returns:
        MongoStore instance
    """
    global _mongo_store
    if _mongo_store is None:
        _mongo_store = MongoStore()
    return _mongo_store