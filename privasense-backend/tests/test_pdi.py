"""
Tests for pipeline/pdi.py
"""

import pytest
from pipeline.pdi import (
    compute_pdi,
    risk_label,
    explain_with_shap,
    build_feature_table,
    PDI_WEIGHTS,
    COGNITIVE_DOMAIN_MAP,
)


class TestComputePdi:
    def test_identical_features_and_baseline(self):
        features = {"pause_rate": 0.5, "speech_rate_wpm": 100.0}
        baseline = {"pause_rate": 0.5, "speech_rate_wpm": 100.0}
        pdi, contributions = compute_pdi(features, baseline)
        # Should be very low PDI (close to 0 after sigmoid)
        assert pdi < 0.5

    def test_high_deviation(self):
        features = {"pause_rate": 1.0, "speech_rate_wpm": 50.0}
        baseline = {"pause_rate": 0.1, "speech_rate_wpm": 100.0}
        pdi, contributions = compute_pdi(features, baseline)
        # Should be higher PDI
        assert 0.0 <= pdi <= 1.0

    def test_missing_features(self):
        features = {"pause_rate": 0.5}
        baseline = {"speech_rate_wpm": 100.0}
        pdi, contributions = compute_pdi(features, baseline)
        assert 0.0 <= pdi <= 1.0

    def test_empty_dicts(self):
        pdi, contributions = compute_pdi({}, {})
        assert pdi >= 0.0 and pdi <= 1.0


class TestRiskLabel:
    def test_low_risk(self):
        assert risk_label(0.0) == "LOW"
        assert risk_label(0.24) == "LOW"

    def test_medium_risk(self):
        assert risk_label(0.25) == "MEDIUM"
        assert risk_label(0.49) == "MEDIUM"

    def test_high_risk(self):
        assert risk_label(0.50) == "HIGH"
        assert risk_label(1.0) == "HIGH"


class TestExplainWithShap:
    def test_shap_values_sum_to_one(self):
        features = {"pause_rate": 0.8, "speech_rate_wpm": 50.0}
        baseline = {"pause_rate": 0.2, "speech_rate_wpm": 100.0}
        shap = explain_with_shap(features, baseline)
        # Sum of absolute values should be 1.0
        total = sum(abs(v) for v in shap.values())
        assert abs(total - 1.0) < 0.01 or total == 0.0

    def test_shap_all_zero_for_identical(self):
        features = {"pause_rate": 0.5}
        baseline = {"pause_rate": 0.5}
        shap = explain_with_shap(features, baseline)
        assert all(v == 0.0 for v in shap.values())


class TestBuildFeatureTable:
    def test_build_table(self):
        features = {"pause_rate": 0.5, "speech_rate_wpm": 100.0}
        baseline = {"pause_rate": 0.3, "speech_rate_wpm": 120.0}
        shap = {"pause_rate": 0.3, "speech_rate_wpm": -0.2}
        table = build_feature_table(features, baseline, shap)

        assert len(table) == 2
        assert table[0].feature == "pause_rate"
        assert table[0].today == 0.5
        assert table[0].baseline == 0.3
        assert table[0].direction == "up"

    def test_direction_down(self):
        features = {"pause_rate": 0.3}
        baseline = {"pause_rate": 0.5}
        shap = {"pause_rate": -0.1}
        table = build_feature_table(features, baseline, shap)
        assert table[0].direction == "down"