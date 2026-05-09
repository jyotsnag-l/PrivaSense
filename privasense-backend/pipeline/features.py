"""
Feature extraction for cognitive monitoring from speech.
Extracts 6 features: pause_rate, mean_pause_duration, speech_rate_wpm,
filler_rate, lexical_diversity, pitch_variability.
"""

import re
import warnings
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


def compute_pause_rate(transcription: Dict[str, Any]) -> float:
    """
    FEATURE 1 — pause_rate
    Source: Whisper segment timestamps
    Method: gaps > 0.3s between segment[i].end and segment[i+1].start
    Formula: count(gaps) / total_duration_seconds
    Domain: Language fluency
    """
    try:
        segments = transcription.get("segments", [])
        if len(segments) < 2:
            return 0.0

        total_duration = segments[-1]["end"] - segments[0]["start"]
        if total_duration <= 0:
            return 0.0

        gap_count = 0
        for i in range(len(segments) - 1):
            gap = segments[i + 1]["start"] - segments[i]["end"]
            if gap > 0.3:
                gap_count += 1

        return gap_count / total_duration
    except Exception as e:
        logger.warning(f"Error computing pause_rate: {e}")
        return 0.0


def compute_mean_pause_duration(transcription: Dict[str, Any]) -> float:
    """
    FEATURE 2 — mean_pause_duration
    Source: same gaps list as pause_rate
    Formula: mean(gaps) in seconds; 0.0 if no gaps
    Domain: Language fluency
    """
    try:
        segments = transcription.get("segments", [])
        if len(segments) < 2:
            return 0.0

        gaps = []
        for i in range(len(segments) - 1):
            gap = segments[i + 1]["start"] - segments[i]["end"]
            if gap > 0.3:
                gaps.append(gap)

        if not gaps:
            return 0.0

        return sum(gaps) / len(gaps)
    except Exception as e:
        logger.warning(f"Error computing mean_pause_duration: {e}")
        return 0.0


def compute_speech_rate_wpm(transcription: Dict[str, Any]) -> float:
    """
    FEATURE 3 — speech_rate_wpm
    Source: transcript word count + segment timestamps
    Formula: word_count / (total_duration_seconds / 60)
    Domain: Processing speed
    """
    try:
        text = transcription.get("text", "")
        segments = transcription.get("segments", [])

        if not text or not segments:
            return 0.0

        word_count = len(text.split())
        total_duration = segments[-1]["end"] - segments[0]["start"]

        if total_duration <= 0:
            return 0.0

        return word_count / (total_duration / 60.0)
    except Exception as e:
        logger.warning(f"Error computing speech_rate_wpm: {e}")
        return 0.0


def compute_filler_rate(transcription: Dict[str, Any]) -> float:
    """
    FEATURE 4 — filler_rate
    Source: transcript text (lowercased)
    Filler set (unigrams): um, uh, er, ah, hmm
    Filler set (bigrams): you know, i mean, kind of, sort of
    Formula: (unigram_hits + bigram_hits) / max(total_words, 1)
    Domain: Working memory
    """
    try:
        text = transcription.get("text", "").lower()

        if not text:
            return 0.0

        # Unigram fillers
        unigram_fillers = {"um", "uh", "er", "ah", "hmm"}

        # Bigram fillers
        bigram_fillers = {"you know", "i mean", "kind of", "sort of"}

        # Count unigram hits
        words = re.findall(r'\b\w+\b', text)
        unigram_hits = sum(1 for word in words if word in unigram_fillers)

        # Count bigram hits
        bigram_hits = 0
        text_for_bigrams = text
        for bigram in bigram_fillers:
            bigram_hits += text_for_bigrams.count(bigram)

        total_words = len(words)
        return (unigram_hits + bigram_hits) / max(total_words, 1)
    except Exception as e:
        logger.warning(f"Error computing filler_rate: {e}")
        return 0.0


def compute_lexical_diversity(transcription: Dict[str, Any]) -> float:
    """
    FEATURE 5 — lexical_diversity
    Source: transcript text
    Method: MATTR (Moving Average Type-Token Ratio), window = min(25, len(tokens))
    Formula: mean TTR across all windows; use simple TTR if tokens < 5
    Tokenise: lowercase, strip punctuation
    Domain: Memory retrieval
    """
    try:
        text = transcription.get("text", "").lower()

        if not text:
            return 0.0

        # Tokenize: lowercase, strip punctuation
        tokens = re.findall(r'\b\w+\b', text)

        if len(tokens) < 5:
            # Use simple TTR for very short texts
            if not tokens:
                return 0.0
            return len(set(tokens)) / len(tokens)

        # MATTR with window size
        window_size = min(25, len(tokens))
        ttr_values = []

        for i in range(len(tokens) - window_size + 1):
            window = tokens[i : i + window_size]
            ttr = len(set(window)) / len(window)
            ttr_values.append(ttr)

        if not ttr_values:
            return len(set(tokens)) / len(tokens)

        return sum(ttr_values) / len(ttr_values)
    except Exception as e:
        logger.warning(f"Error computing lexical_diversity: {e}")
        return 0.0


def compute_pitch_variability(audio_path: str) -> float:
    """
    FEATURE 6 — pitch_variability
    Source: audio file path
    Method: librosa.pyin → std dev of voiced F0 frames
    If librosa not installed OR audio is "__demo__": return 0.0 silently
    Domain: Emotional regulation
    """
    try:
        # Skip if demo mode
        if audio_path == "__demo__":
            return 0.0

        import librosa

        # Load audio
        y, sr = librosa.load(audio_path, sr=None)

        # Extract pitch using pyin
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr,
        )

        # Get voiced frames only
        voiced_f0 = f0[voiced_flag]

        if len(voiced_f0) < 2:
            return 0.0

        return float(np.std(voiced_f0))

    except ImportError:
        # librosa not installed, return 0.0 silently
        return 0.0
    except Exception as e:
        logger.warning(f"Error computing pitch_variability: {e}")
        return 0.0


def extract_all_features(audio_path: str, transcription: Dict[str, Any]) -> Dict[str, float]:
    """
    Main entry point — extract all 6 features.

    Args:
        audio_path: Path to audio file (or "__demo__" for demo mode)
        transcription: Dict with 'text' and 'segments' from Whisper or synthetic

    Returns:
        Dict with all 6 feature keys. Never raises — catches all exceptions
        per feature, logs warning, substitutes 0.0.
    """
    features = {}

    # Features from transcription only
    feature_extractors = [
        ("pause_rate", lambda: compute_pause_rate(transcription)),
        ("mean_pause_duration", lambda: compute_mean_pause_duration(transcription)),
        ("speech_rate_wpm", lambda: compute_speech_rate_wpm(transcription)),
        ("filler_rate", lambda: compute_filler_rate(transcription)),
        ("lexical_diversity", lambda: compute_lexical_diversity(transcription)),
    ]

    for name, extractor in feature_extractors:
        try:
            features[name] = extractor()
        except Exception as e:
            logger.warning(f"Error computing {name}: {e}")
            features[name] = 0.0

    # Feature from audio file
    try:
        features["pitch_variability"] = compute_pitch_variability(audio_path)
    except Exception as e:
        logger.warning(f"Error computing pitch_variability: {e}")
        features["pitch_variability"] = 0.0

    return features


# Import numpy at module level for pitch_variability
import numpy as np