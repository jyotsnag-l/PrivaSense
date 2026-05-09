"""
Tests for pipeline/baseline.py
"""

import pytest
import os
import json
import tempfile
from unittest.mock import patch

from pipeline.baseline import (
    load_baselines,
    save_baselines,
    get_baseline,
    update_baseline,
    EMA_ALPHA,
)


@pytest.fixture
def temp_storage(tmp_path):
    """Create a temporary storage directory."""
    with patch.dict(os.environ, {"STORAGE_DIR": str(tmp_path)}):
        yield tmp_path


class TestLoadBaselines:
    def test_empty_when_no_file(self, temp_storage):
        baselines = load_baselines()
        assert baselines == {}

    def test_loads_existing_file(self, temp_storage):
        data = {"user1": {"baseline": {"pause_rate": 0.5}, "sessions": 3}}
        baselines_file = os.path.join(temp_storage, "privasense_baselines.json")
        with open(baselines_file, "w") as f:
            json.dump(data, f)

        baselines = load_baselines()
        assert baselines == data


class TestSaveBaselines:
    def test_saves_to_file(self, temp_storage):
        data = {"user1": {"baseline": {"pause_rate": 0.5}, "sessions": 1}}
        save_baselines(data)

        baselines_file = os.path.join(temp_storage, "privasense_baselines.json")
        assert os.path.exists(baselines_file)

        with open(baselines_file, "r") as f:
            loaded = json.load(f)
        assert loaded == data


class TestGetBaseline:
    def test_returns_empty_for_unknown_user(self):
        baselines = {}
        result = get_baseline("unknown_user", baselines)
        assert result == {}

    def test_returns_baseline_for_known_user(self):
        baselines = {
            "user1": {"baseline": {"pause_rate": 0.5, "speech_rate_wpm": 100}, "sessions": 2}
        }
        result = get_baseline("user1", baselines)
        assert result == {"pause_rate": 0.5, "speech_rate_wpm": 100}


class TestUpdateBaseline:
    def test_first_session(self, temp_storage):
        baselines = {}
        features = {"pause_rate": 0.5, "speech_rate_wpm": 100.0}

        result = update_baseline("user1", features, baselines)

        assert "user1" in result
        assert result["user1"]["sessions"] == 1
        assert result["user1"]["baseline"] == features

    def test_subsequent_session(self, temp_storage):
        # First session
        baselines = {}
        features1 = {"pause_rate": 0.5, "speech_rate_wpm": 100.0}
        baselines = update_baseline("user1", features1, baselines)

        # Second session with different values
        features2 = {"pause_rate": 0.7, "speech_rate_wpm": 90.0}
        baselines = update_baseline("user1", features2, baselines)

        assert baselines["user1"]["sessions"] == 2

        # Check EMA was applied
        expected_pause = EMA_ALPHA * 0.7 + (1 - EMA_ALPHA) * 0.5
        assert abs(baselines["user1"]["baseline"]["pause_rate"] - expected_pause) < 0.001

    def test_preserves_unseen_features(self, temp_storage):
        baselines = {}
        features1 = {"pause_rate": 0.5, "old_feature": 1.0}
        baselines = update_baseline("user1", features1, baselines)

        # Update with new feature set (missing old_feature)
        features2 = {"pause_rate": 0.7, "new_feature": 2.0}
        baselines = update_baseline("user1", features2, baselines)

        assert "old_feature" in baselines["user1"]["baseline"]
        assert baselines["user1"]["baseline"]["old_feature"] == 1.0