from pydantic import BaseModel
from typing import List, Dict


class FeatureRow(BaseModel):
    feature: str
    today: float
    baseline: float
    shap: float
    domain: str
    direction: str  # "up" | "down"


class AnalyzeResponse(BaseModel):
    user_id: str
    pdi: float  # sigmoid-normalised 0.0–1.0
    risk: str  # "LOW" | "MEDIUM" | "HIGH"
    transcript: str
    features: List[FeatureRow]
    shap: Dict[str, float]
    sessions: int
    alert_sent: bool  # True if Telegram alert was fired this session


class HistorySession(BaseModel):
    timestamp: str
    pdi: float
    risk: str


class HistoryResponse(BaseModel):
    user_id: str
    sessions: List[HistorySession]


class CaregiverLink(BaseModel):
    user_id: str
    caregiver_chat_id: int  # Telegram chat ID of the caregiver


class StatusResponse(BaseModel):
    user_id: str
    latest_pdi: float
    risk: str
    last_seen: str  # ISO timestamp of last analysis
    sessions_total: int