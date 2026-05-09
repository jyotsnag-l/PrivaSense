import os
import random
import logging
from datetime import datetime, timedelta
from storage.adapter import get_storage_adapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_day13_data(user_id="ayush_demo"):
    adapter = get_storage_adapter()
    
    # 2. Define baseline features (Healthy state)
    baseline_features = {
        "pause_rate": 0.2,
        "mean_pause_duration": 0.5,
        "speech_rate_wpm": 130.0,
        "filler_rate": 0.02,
        "lexical_diversity": 0.85,
        "pitch_variability": 25.0
    }
    
    # 3. Initialize baseline
    adapter.update_baseline(user_id, baseline_features, adapter.load_baselines())
    
    # 4. Generate 13 days of history
    # Day 1-7: Stable (Baseline ± 5%)
    # Day 8-13: Gradual decline (Drift)
    
    for day in range(1, 14):
        # Create a timestamp spread over 13 days
        # Day 1 is 13 days ago, Day 13 is today
        days_ago = 13 - day
        timestamp = datetime.utcnow() - timedelta(days=days_ago)
        
        # Calculate drift factor
        if day <= 7:
            drift = 1.0 + random.uniform(-0.05, 0.05)
        else:
            # Gradually worsening after day 7
            drift = 1.0 + (day - 7) * 0.10  # ~60% drift by day 13
            
        # Apply drift to features
        current_features = {
            "pause_rate": baseline_features["pause_rate"] * drift,
            "mean_pause_duration": baseline_features["mean_pause_duration"] * drift,
            "speech_rate_wpm": baseline_features["speech_rate_wpm"] / drift,
            "filler_rate": baseline_features["filler_rate"] * drift,
            "lexical_diversity": baseline_features["lexical_diversity"] / (drift * 0.5 + 0.5),
            "pitch_variability": baseline_features["pitch_variability"] / drift
        }
        
        # Calculate PDI (Simple linear simulation for seeding)
        pdi = (drift - 1.0) * 0.9 # 0.0 to ~0.54
        risk = "LOW"
        if pdi >= 0.50: risk = "HIGH"
        elif pdi >= 0.25: risk = "MEDIUM"
        
        # Append to history via adapter
        if adapter.use_mongodb:
            from storage.mongo_store import COLLECTION_HISTORY
            # Correct document structure for MongoStore.append_history
            document = {
                "user_id": user_id,
                "pdi": round(pdi, 4),
                "risk": risk,
                "features": {k: round(v, 4) for k, v in current_features.items()},
                "timestamp": timestamp
            }
            adapter.mongo_store.db[COLLECTION_HISTORY].insert_one(document)
        else:
            # Local store
            from storage.local_store import load_json, save_json
            history_file = f"history_{user_id}.json"
            data_dir = os.path.join(os.getcwd(), "data")
            os.makedirs(data_dir, exist_ok=True)
            
            history = load_json(history_file) if os.path.exists(os.path.join(data_dir, history_file)) else []
            history.insert(0, {
                "timestamp": timestamp.isoformat(),
                "features": current_features,
                "pdi": pdi,
                "risk": risk
            })
            save_json(history_file, history)
            
        logger.info(f"Seeded Day {day} for {user_id}: PDI={pdi:.2f}, Risk={risk}")

    logger.info("Successfully seeded 13 days of cognitive monitoring data.")

if __name__ == "__main__":
    seed_day13_data()
