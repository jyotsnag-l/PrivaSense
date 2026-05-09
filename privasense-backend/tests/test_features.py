"""
Tests for pipeline/features.py
"""

import pytest
from pipeline.features import (
    compute_pause_rate,
    compute_mean_pause_duration,
    compute_speech_rate_wpm,
    compute_filler_rate,
    compute_lexical_diversity,
    extract_all_features,
)


def make_transcription(text, segments):
    """Helper to create a transcription dict."""
    return {"text": text, "segments": segments}


class TestPauseRate:
    def test_no_segments(self):
        transcription = make_transcription("hello", [])
        assert compute_pause_rate(transcription) == 0.0

    def test_single_segment(self):
        segments = [{"id": 0, "start": 0.0, "end": 2.0, "text": "hello"}]
        transcription = make_transcription("hello", segments)
        assert compute_pause_rate(transcription) == 0.0

    def test_no_gaps(self):
        segments = [
            {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"},
            {"id": 1, "start": 1.0, "end": 2.0, "text": "world"},
        ]
        transcription = make_transcription("hello world", segments)
        assert compute_pause_rate(transcription) == 0.0

    def test_with_gaps(self):
        segments = [
            {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"},
            {"id": 1, "start": 1.5, "end": 2.5, "text": "world"},
        ]
        transcription = make_transcription("hello world", segments)
        # One gap of 0.5s in 2.5s total = 0.4
        assert abs(compute_pause_rate(transcription) - 0.4) < 0.01


class TestMeanPauseDuration:
    def test_no_gaps(self):
        segments = [
            {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"},
            {"id": 1, "start": 1.0, "end": 2.0, "text": "world"},
        ]
        transcription = make_transcription("hello world", segments)
        assert compute_mean_pause_duration(transcription) == 0.0

    def test_with_gaps(self):
        segments = [
            {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"},
            {"id": 1, "start": 1.5, "end": 2.5, "text": "world"},
        ]
        transcription = make_transcription("hello world", segments)
        assert compute_mean_pause_duration(transcription) == 0.5


class TestSpeechRateWpm:
    def test_basic(self):
        segments = [
            {"id": 0, "start": 0.0, "end": 60.0, "text": "one two three four five"},
        ]
        transcription = make_transcription("one two three four five", segments)
        # 5 words in 60 seconds = 5 wpm
        assert compute_speech_rate_wpm(transcription) == 5.0

    def test_empty_text(self):
        transcription = make_transcription("", [])
        assert compute_speech_rate_wpm(transcription) == 0.0


class TestFillerRate:
    def test_no_fillers(self):
        transcription = make_transcription("hello world today", [])
        assert compute_filler_rate(transcription) == 0.0

    def test_with_unigram_fillers(self):
        transcription = make_transcription("um hello uh world", [])
        # 2 fillers in 5 words = 0.4
        assert abs(compute_filler_rate(transcription) - 0.4) < 0.01

    def test_with_bigram_fillers(self):
        transcription = make_transcription("you know hello world", [])
        # 1 bigram filler in 4 words = 0.25
        assert abs(compute_filler_rate(transcription) - 0.25) < 0.01


class TestLexicalDiversity:
    def test_simple_ttr(self):
        # Less than 5 tokens uses simple TTR
        transcription = make_transcription("cat cat dog", [])
        # 2 unique / 3 total = 0.667
        assert abs(compute_lexical_diversity(transcription) - 0.667) < 0.01

    def test_mattr(self):
        # More than 5 tokens uses MATTR
        text = "the cat sat on the mat the cat was happy"
        transcription = make_transcription(text, [])
        result = compute_lexical_diversity(transcription)
        assert 0.0 <= result <= 1.0

    def test_empty(self):
        transcription = make_transcription("", [])
        assert compute_lexical_diversity(transcription) == 0.0


class TestExtractAllFeatures:
    def test_demo_mode(self):
        transcription = {
            "text": "hello world",
            "segments": [
                {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"},
                {"id": 1, "start": 1.5, "end": 2.5, "text": "world"},
            ],
        }
        features = extract_all_features("__demo__", transcription)

        expected_keys = {
            "pause_rate",
            "mean_pause_duration",
            "speech_rate_wpm",
            "filler_rate",
            "lexical_diversity",
            "pitch_variability",
        }
        assert set(features.keys()) == expected_keys

    def test_never_raises(self):
        # Even with bad input, should return zeros
        features = extract_all_features("__demo__", {})
        assert all(isinstance(v, float) for v in features.values())