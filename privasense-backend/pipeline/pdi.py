"""
PDI (Privacy-first Decline Indicator) engine with SHAP attribution.
Computes weighted deviation from baseline and produces risk levels.
"""

import math
import logging
from typing import Dict, List, Tuple

from models.schemas import FeatureRow

logger = logging.getLogger(__name__)

# PDI feature weights
PDI_WEIGHTS = {
    "pause_rate": 0.25,
    "mean_pause_duration": 0.20,
    "speech_rate_wpm": 0.20,
    "filler_rate": 0.15,
    "lexical_diversity": 0.10,
    "pitch_variability": 0.10,
}

# Cognitive domain mapping
COGNITIVE_DOMAIN_MAP = {
    "pause_rate": "Language fluency",
    "mean_pause_duration": "Language fluency",
    "speech_rate_wpm": "Processing speed",
    "filler_rate": "Working memory",
    "lexical_diversity": "Memory retrieval",
    "pitch_variability": "Emotional regulation",
}

# Features where lower is worse (direction: positive when f < b)
LOWER_IS_WORSE = {"speech_rate_wpm", "lexical_diversity"}

# Risk thresholds
RISK_THRESHOLDS = {
    "LOW": (0.0, 0.25),
    "MEDIUM": (0.25, 0.50),
    "HIGH": (0.50, 1.0),
}


def compute_pdi(features: Dict[str, float], baseline: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
    """
    Compute PDI score and individual contributions.

    Args:
        features: Current session features
        baseline: User's baseline features

    Returns:
        Tuple of (pdi_score, contributions_dict)
    """
    eps = 1e-6
    contributions = {}

    for feature_name, weight in PDI_WEIGHTS.items():
        f_i = features.get(feature_name, 0.0)
        b_i = baseline.get(feature_name, 0.0)

        # Compute deviation
        deviation_i = abs(f_i - b_i) / (abs(b_i) + eps)

        # Determine direction sign
        # For speech_rate_wpm and lexical_diversity: worse if LOWER than baseline
        # For others: worse if HIGHER than baseline
        if feature_name in LOWER_IS_WORSE:
            # Positive contribution when f < b (lower is worse)
            direction_sign = 1.0 if f_i < b_i else -1.0
        else:
            # Positive contribution when f > b (higher is worse)
            direction_sign = 1.0 if f_i > b_i else -1.0

        contribution_i = weight * deviation_i * direction_sign
        contributions[feature_name] = contribution_i

    # Raw PDI = sum of contributions (positive is decline, negative is improvement)
    # We want to focus on the decline, so we take the sum and clip at 0
    # This means improvements can offset declines in other areas
    total_contribution = sum(contributions.values())
    raw_pdi = max(0.0, total_contribution)

    # Sigmoid normalization: pdi = 1 / (1 + exp(-10 * (raw_pdi - 0.2)))
    # Adjusted constants to make the score more sensitive to small declines
    pdi = 1.0 / (1.0 + math.exp(-10.0 * (raw_pdi - 0.2)))

    # Clamp to [0, 1]
    pdi = max(0.0, min(1.0, pdi))

    return pdi, contributions


def risk_label(pdi: float) -> str:
    """
    Determine risk level from PDI score.

    LOW:    pdi < 0.25
    MEDIUM: 0.25 <= pdi < 0.50
    HIGH:   pdi >= 0.50
    """
    if pdi < 0.25:
        return "LOW"
    elif pdi < 0.50:
        return "MEDIUM"
    else:
        return "HIGH"


def explain_with_shap(features: Dict[str, float], baseline: Dict[str, float]) -> Dict[str, float]:
    """
    Compute SHAP-like attribution values.

    Args:
        features: Current session features
        baseline: User's baseline features

    Returns:
        Dict mapping feature names to signed SHAP values (fractions)
    """
    _, contributions = compute_pdi(features, baseline)

    # Total absolute contribution
    total = sum(abs(c) for c in contributions.values())

    if total == 0.0:
        # No deviation, return zero SHAP values
        return {feature: 0.0 for feature in PDI_WEIGHTS}

    # SHAP = signed contribution / total absolute contribution
    shap_values = {}
    for feature_name, contribution in contributions.items():
        shap_values[feature_name] = contribution / total

    return shap_values


def build_feature_table(
    features: Dict[str, float],
    baseline: Dict[str, float],
    shap_vals: Dict[str, float],
) -> List[FeatureRow]:
    """
    Build a list of FeatureRow objects for the API response.

    Args:
        features: Current session features
        baseline: User's baseline features
        shap_vals: SHAP attribution values

    Returns:
        List of FeatureRow objects
    """
    rows = []

    for feature_name in PDI_WEIGHTS:
        today_val = features.get(feature_name, 0.0)
        baseline_val = baseline.get(feature_name, 0.0)
        shap_val = shap_vals.get(feature_name, 0.0)
        domain = COGNITIVE_DOMAIN_MAP.get(feature_name, "Unknown")

        # Determine direction
        if today_val > baseline_val:
            direction = "up"
        elif today_val < baseline_val:
            direction = "down"
        else:
            direction = "up"  # default

        rows.append(
            FeatureRow(
                feature=feature_name,
                today=round(today_val, 4),
                baseline=round(baseline_val, 4),
                shap=round(shap_val, 4),
                domain=domain,
                direction=direction,
            )
        )

    return rows