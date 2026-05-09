"""
PrivaSense FastAPI backend — all REST routes for cognitive monitoring.
Includes security features: rate limiting, input validation, CORS.
"""

import os
import re
import tempfile
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import uvicorn

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import get_settings, Settings

# Load and validate settings
settings = get_settings()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Storage directory
STORAGE_DIR = settings.storage_dir
os.makedirs(STORAGE_DIR, exist_ok=True)

# Import pipeline components
from pipeline.transcriber import transcribe, synthetic_transcription
from pipeline.features import extract_all_features
from pipeline.pdi import compute_pdi, risk_label, explain_with_shap, build_feature_table
from pipeline.baseline import load_baselines, update_baseline, get_baseline

# Import storage adapter (supports both local and MongoDB)
from storage.adapter import (
    get_storage_adapter,
    append_history,
    get_user_history,
    save_caregiver_link,
)

# Import alert system
from privasense_telegram.alerts import maybe_send_alert

# ===========================================
# Rate Limiter Setup
# ===========================================
# Disable rate limiting if in debug mode
limiter = Limiter(
    key_func=get_remote_address,
    enabled=not settings.debug
)

# ===========================================
# Create FastAPI app
# ===========================================
app = FastAPI(
    title=settings.app_name,
    description="Privacy-first cognitive monitoring backend",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,  # Disable Swagger in production
    redoc_url="/redoc" if settings.debug else None,
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ===========================================
# CORS Configuration
# ===========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # Restricted to specific origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

class JoinCodeRequest(BaseModel):
    user_id: str = Field(..., min_length=3, max_length=50)

class JoinCodeVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    caregiver_chat_id: int

class CaregiverLink(BaseModel):
    user_id: str = Field(..., min_length=3, max_length=50)
    caregiver_chat_id: int = Field(..., gt=0)

# Temporary in-memory store for join codes (MVP - would be in Redis/Mongo normally)
join_codes = {}

@app.post("/generate_join_code")
def generate_join_code(req: JoinCodeRequest):
    import random
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    join_codes[code] = req.user_id
    return {"code": code, "expires_in": 600}

@app.post("/verify_join_code")
def verify_join_code(req: JoinCodeVerify):
    user_id = join_codes.get(req.code)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired join code")
    
    # Link the caregiver
    save_caregiver_link(user_id, req.caregiver_chat_id)
    # Remove code after use
    del join_codes[req.code]
    
    return {"ok": True, "user_id": user_id, "message": f"Successfully linked to {user_id}"}


# ===========================================
# Global Exception Handler
# ===========================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that returns generic error messages to clients
    while logging detailed errors internally.
    """
    # Log the detailed error for debugging
    logger.error(
        f"Unhandled error in {request.method} {request.url.path}: {exc}",
        exc_info=True,
        extra={
            "client_host": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
        }
    )
    
    # Return generic error to client
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. Please try again later.",
            "request_id": id(request),  # For tracking purposes
        },
    )


# ===========================================
# ROUTES
# ===========================================

@app.get("/health")
@limiter.limit("60/minute")  # Higher limit for health checks
def health_check(request: Request):
    """Health check endpoint."""
    return {"status": "ok", "service": "PrivaSense", "model": "whisper-tiny"}


@app.post("/analyze")
@limiter.limit("10/minute")  # Stricter limit for expensive operations
async def analyze_audio(
    request: Request,
    audio: UploadFile = File(...),
    user_id: str = Form(..., min_length=3, max_length=50),
):
    """
    Analyze an audio file for cognitive decline indicators.

    Accepts WAV/WebM/MP3/M4A/OGG audio files up to 25MB.
    Runs full pipeline: transcribe → extract features → compute PDI → update baseline → store history
    """
    # Validate user_id format
    if not re.match(r'^[a-zA-Z0-9_-]{3,50}$', user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid user_id format. Must be 3-50 alphanumeric characters, hyphens, or underscores."
        )
    
    # Validate file type
    allowed_extensions = {'.wav', '.webm', '.mp3', '.m4a', '.ogg'}
    if not audio.filename or not audio.filename.lower().endswith(tuple(allowed_extensions)):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid audio format. Supported: {', '.join(allowed_extensions)}"
        )
    
    # Check file size
    file_size = 0
    try:
        # Read file to check size
        content = await audio.read()
        file_size = len(content)
        
        if file_size > settings.max_upload_size:
            max_mb = settings.max_upload_size / (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {max_mb:.0f}MB"
            )
        
        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty audio file"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading uploaded audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to process audio file")
    
    # Save uploaded file temporarily
    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=os.path.splitext(audio.filename)[1]
        ) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
    except Exception as e:
        logger.error(f"Error saving uploaded audio: {e}")
        raise HTTPException(status_code=500, detail="Failed to process audio file")
    
    try:
        # Step 1: Transcribe
        try:
            transcription = transcribe(tmp_path)
        except ImportError as e:
            logger.error(f"Whisper import error: {e}")
            raise HTTPException(
                status_code=500, 
                detail="Speech recognition service unavailable"
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to transcribe audio"
            )

        # Step 2: Extract features
        features = extract_all_features(tmp_path, transcription)

        # Step 3: Load baselines and compute PDI
        baselines = load_baselines()
        user_baseline = get_baseline(user_id, baselines)

        # If no baseline exists, use current features as baseline for PDI calculation
        if not user_baseline:
            user_baseline = features.copy()

        pdi, contributions = compute_pdi(features, user_baseline)
        risk = risk_label(pdi)

        # Step 4: Compute SHAP attribution
        shap_values = explain_with_shap(features, user_baseline)

        # Step 5: Build feature table
        feature_table = build_feature_table(features, user_baseline, shap_values)

        # Step 6: Update baseline
        baselines = load_baselines()  # Reload to get latest
        baselines = update_baseline(user_id, features, baselines)

        # Get session count
        session_count = baselines.get(user_id, {}).get("sessions", 1)

        # Step 7: Append to history
        append_history(user_id, features, pdi, risk)

        # Step 8: Check for alerts
        result_dict = {
            "pdi": pdi,
            "risk": risk,
            "features": features,
        }
        alert_sent = maybe_send_alert(user_id, result_dict)

        # Build response
        response = {
            "user_id": user_id,
            "pdi": round(pdi, 4),
            "risk": risk,
            "transcript": transcription["text"],
            "features": [f.model_dump() for f in feature_table],
            "shap": {k: round(v, 4) for k, v in shap_values.items()},
            "sessions": session_count,
            "alert_sent": alert_sent,
        }

        logger.info(f"Analysis completed for user {user_id}: PDI={pdi:.4f}, risk={risk}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_audio for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. Please try again."
        )
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/demo")
@limiter.limit("20/minute")
async def demo_analysis(
    request: Request, 
    user_id: str = Form(..., min_length=3, max_length=50),
    motor_score: int = Form(None),
    speech_text: str = Form(None)
):
    """
    Comprehensive Demo analysis including 14-day plan generation.
    """
    from pipeline.planner import generate_14_day_plan
    
    # Validate user_id
    if not re.match(r'^[a-zA-Z0-9_-]{3,50}$', user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id")
    
    try:
        # Step 1-3: Process and get risk
        if speech_text:
            transcription = {"text": speech_text, "segments": [{"text": speech_text}]}
        else:
            transcription = synthetic_transcription()
            
        features = extract_all_features("__demo__", transcription)
        
        # Inject motor score into features
        if motor_score is not None:
            features["motor_score"] = motor_score
            
        baselines = load_baselines()
        user_baseline = get_baseline(user_id, baselines) or features.copy()
        
        pdi, contributions = compute_pdi(features, user_baseline)
        risk = risk_label(pdi)
        
        # Step 4-7: Updates
        shap_values = explain_with_shap(features, user_baseline)
        feature_table = build_feature_table(features, user_baseline, shap_values)
        update_baseline(user_id, features, load_baselines())
        append_history(user_id, features, pdi, risk)
        
        # Step 8: Generate 14-Day Plan
        plan = generate_14_day_plan(user_id, risk, pdi)
        # Store plan in adapter (MVP: we'll just return it for now)
        
        result_dict = {"pdi": pdi, "risk": risk, "features": features}
        alert_sent = maybe_send_alert(user_id, result_dict)

        response = {
            "user_id": user_id,
            "pdi": round(pdi, 4),
            "risk": risk,
            "transcript": transcription["text"],
            "features": [f.model_dump() for f in feature_table],
            "sessions": load_baselines().get(user_id, {}).get("sessions", 1),
            "alert_sent": alert_sent,
            "plan": plan
        }

        return response

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed")

@app.get("/plan/{user_id}")
async def get_plan(user_id: str):
    """Retrieve the latest 14-day plan for a user."""
    # In a real app, we'd fetch from DB. For demo, we'll re-generate if missing
    # or return a cached version. Let's just generate a fresh one for now.
    from pipeline.planner import generate_14_day_plan
    baselines = load_baselines()
    user_data = baselines.get(user_id, {})
    latest_pdi = user_data.get("latest_pdi", 0.4)
    risk = risk_label(latest_pdi)
    
    return {"user_id": user_id, "plan": generate_14_day_plan(user_id, risk, latest_pdi)}


@app.get("/history/{user_id}")
@limiter.limit("30/minute")
async def get_history(request: Request, user_id: str):
    """
    Get analysis history for a user.
    Returns sessions sorted by timestamp ascending.
    """
    # Validate user_id format
    if not re.match(r'^[a-zA-Z0-9_-]{3,50}$', user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid user_id format. Must be 3-50 alphanumeric characters, hyphens, or underscores."
        )
    
    history = get_user_history(user_id)

    # Reverse to get ascending order (oldest first)
    history.reverse()

    sessions = []
    for entry in history:
        sessions.append({
            "timestamp": entry["timestamp"],
            "pdi": float(entry["pdi"]),
            "risk": entry["risk"],
        })

    return {
        "user_id": user_id,
        "sessions": sessions,
    }


@app.get("/status/{user_id}")
@limiter.limit("30/minute")
async def get_status(request: Request, user_id: str):
    """
    Get latest status for a user: PDI, risk, last seen, total sessions.
    """
    # Validate user_id format
    if not re.match(r'^[a-zA-Z0-9_-]{3,50}$', user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid user_id format. Must be 3-50 alphanumeric characters, hyphens, or underscores."
        )
    
    history = get_user_history(user_id)

    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for user {user_id}"
        )

    # Get latest (first in list, sorted newest first)
    latest = history[0]
    baselines = load_baselines()
    user_data = baselines.get(user_id, {})
    sessions_total = user_data.get("sessions", len(history))

    # Calculate SHAP for the latest session
    latest_features = latest.copy()
    # Remove metadata
    for k in ["timestamp", "user_id", "pdi", "risk"]:
        latest_features.pop(k, None)
    
    from pipeline.baseline import get_baseline
    user_baseline = get_baseline(user_id, baselines) or latest_features
    
    from pipeline.pdi import explain_with_shap, build_feature_table
    shap_values = explain_with_shap(latest_features, user_baseline)
    feature_table = build_feature_table(latest_features, user_baseline, shap_values)

    return {
        "user_id": user_id,
        "latest_pdi": float(latest["pdi"]),
        "risk": latest["risk"],
        "last_seen": latest["timestamp"],
        "sessions_total": sessions_total,
        "history": history,
        "features": [f.model_dump() for f in feature_table]
    }


@app.post("/link")
@limiter.limit("10/minute")
async def link_caregiver(request: Request, link: CaregiverLink):
    """
    Link a caregiver to a user for alert notifications.
    Saves the mapping to caregiver_links.json.
    """
    try:
        save_caregiver_link(link.user_id, link.caregiver_chat_id)
        logger.info(f"Caregiver linked: user={link.user_id}, chat_id={link.caregiver_chat_id}")
        return {
            "ok": True,
            "message": f"Caregiver linked to {link.user_id}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking caregiver for user {link.user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to link caregiver")


# ===========================================
# STARTUP EVENTS
# ===========================================

@app.on_event("startup")
async def startup_event():
    """Log startup information when the server starts."""
    print("\n" + "="*60)
    print("  PrivaSense Backend - Starting Up")
    print("="*60)
    print(f"  [OK] API Server: http://{settings.host}:{settings.port}")
    print(f"  [OK] Storage: {STORAGE_DIR}")
    print(f"  [OK] CORS Origins: {', '.join(settings.cors_origins)}")
    print(f"  [OK] Rate Limit: {settings.rate_limit_per_minute} req/min")
    print(f"  [OK] Max Upload: {settings.max_upload_size / (1024*1024):.0f}MB")
    
    # Initialize and check storage adapter
    try:
        adapter = get_storage_adapter()
        if adapter.use_mongodb:
            print(f"  [OK] MongoDB: Connected to {settings.mongo_uri}")
        else:
            print(f"  [OK] Storage: Local file storage ({STORAGE_DIR})")
    except Exception as e:
        print(f"  [WARNING] Storage: Error initializing - {e}")
    
    if settings.telegram_bot_token:
        print(f"  [OK] Telegram Bot: Configured")
    else:
        print(f"  [WARNING] Telegram Bot: Not configured")
    
    print("="*60)
    print("  Ready to accept requests!")
    print("="*60 + "\n")
    logger.info("PrivaSense backend started successfully")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("  PrivaSense Backend - Starting...")
    print("="*60)
    print("  Starting Uvicorn server...")
    print("="*60 + "\n")
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
