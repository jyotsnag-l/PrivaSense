"""
14-Day Cognitive Care Plan Generator.
Generates personalized tasks based on cognitive risk profile.
"""

import random
from typing import List, Dict

def generate_14_day_plan(user_id: str, risk: str, pdi: float) -> List[Dict]:
    """
    Generate a 14-day activity plan based on the PDI risk level.
    """
    activities = {
        "LOW": [
            "Read a challenging book for 30 mins",
            "Learn 5 new words in another language",
            "Solve a complex Sudoku or Crossword",
            "Go for a 20-min brisk walk in nature",
            "Call a friend for a 15-min conversation",
            "Try a new recipe for dinner",
            "Practice mindfulness for 10 mins"
        ],
        "MEDIUM": [
            "Listen to classical music and identify instruments",
            "Play a memory-matching card game",
            "Light stretching and deep breathing for 15 mins",
            "Write a 3-sentence journal entry about your day",
            "Sort items by color or size (organizing)",
            "Walk indoors for 10 mins guided by a caregiver",
            "Watch a nature documentary and name 3 animals"
        ],
        "HIGH": [
            "Gentle hand massage and moisturizing",
            "Listen to familiar childhood songs",
            "Simple color identification using cards",
            "Soft object squeezing for motor sensory",
            "Looking at family photo albums with caregiver",
            "Hydration check: drink 2 glasses of water",
            "Slow deep breathing exercise for 5 mins"
        ]
    }

    plan = []
    pool = activities.get(risk, activities["MEDIUM"])
    
    for day in range(1, 15):
        # Pick 2 activities per day
        daily_tasks = random.sample(pool, 2) if len(pool) >= 2 else pool
        plan.append({
            "day": day,
            "tasks": daily_tasks,
            "status": "pending"
        })
    
    return plan
