"""
Whisper-based transcription with synthetic fallback for demo mode.
"""

import numpy as np
from typing import Dict, List, Any


# Global model cache
_model = None

def get_model():
    """Lazy load and cache the Whisper model."""
    global _model
    if _model is None:
        try:
            import whisper
            _model = whisper.load_model("tiny")
        except ImportError:
            raise ImportError(
                "Whisper is not installed. Please install it with: pip install openai-whisper"
            )
    return _model

def transcribe(audio_path: str) -> Dict[str, Any]:
    """
    Transcribe audio file using OpenAI Whisper tiny model.
    """
    model = get_model()
    try:
        result = model.transcribe(audio_path)
        return {
            "text": result["text"],
            "segments": [
                {
                    "id": seg["id"],
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"],
                }
                for seg in result["segments"]
            ],
        }
    except Exception as e:
        raise ValueError(f"Invalid audio file: {e}")


def synthetic_transcription(duration_secs: float = 30.0) -> Dict[str, Any]:
    """
    Generate a synthetic transcription for demo/testing purposes.

    Uses a fixed transcript and splits it into chunks with realistic timing.
    Seeded with numpy random seed 42 for reproducibility in tests.

    Args:
        duration_secs: Target duration in seconds (used for timing distribution)

    Returns:
        Dict with 'text' (str) and 'segments' (list of dicts)
    """
    np.random.seed(42)

    full_text = (
        "Um, today I went to the market, uh, to buy some vegetables. "
        "I think I got tomatoes and, you know, some onions. "
        "Then I came back home and, uh, made lunch. "
        "It was, like, pretty good actually. Then I watched TV for a bit."
    )

    # Split into chunks of approximately 6 words each
    words = full_text.split()
    chunk_size = 6
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)

    # Generate segments with realistic timing
    segments = []
    current_time = 0.0

    for i, chunk in enumerate(chunks):
        # Estimate duration based on chunk length (roughly 2.5 words per second)
        word_count = len(chunk.split())
        segment_duration = word_count / 2.5 + np.random.uniform(0.1, 0.3)

        start_time = current_time
        end_time = current_time + segment_duration

        segments.append(
            {"id": i, "start": round(start_time, 3), "end": round(end_time, 3), "text": chunk}
        )

        # Add gap before next segment (0.2 to 1.2 seconds as per spec)
        current_time = end_time + np.random.uniform(0.2, 1.2)

    return {"text": full_text, "segments": segments}