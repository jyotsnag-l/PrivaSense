"""
Centralized configuration management using pydantic-settings.
Loads environment variables and validates them.
"""

import re
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ===========================================
    # Application Settings
    # ===========================================
    app_name: str = Field(default="PrivaSense API", description="Application name")
    debug: bool = Field(default=False, description="Debug mode")
    
    # ===========================================
    # Server Settings
    # ===========================================
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    
    # ===========================================
    # Storage Settings
    # ===========================================
    storage_dir: str = Field(default="./data", description="Directory for local storage")
    
    # ===========================================
    # Security Settings
    # ===========================================
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173,https://priva-sense-rho.vercel.app",
        description="Comma-separated list of allowed CORS origins"
    )
    
    # ===========================================
    # Rate Limiting
    # ===========================================
    rate_limit_per_minute: int = Field(
        default=30, 
        ge=1, 
        le=1000,
        description="Maximum requests per minute per IP"
    )
    
    # ===========================================
    # File Upload Settings
    # ===========================================
    max_upload_size: int = Field(
        default=26214400,  # 25MB
        ge=1024,
        le=104857600,  # Max 100MB
        description="Maximum file upload size in bytes"
    )
    
    # ===========================================
    # Telegram Settings
    # ===========================================
    telegram_bot_token: str = Field(default="", description="Telegram bot token")
    alert_chat_id: str = Field(default="", description="Default alert chat ID")
    
    # ===========================================
    # PDI Alert Settings
    # ===========================================
    pdi_alert_threshold: float = Field(default=0.50, ge=0.0, le=1.0)
    pdi_trend_window: int = Field(default=3, ge=1, le=30)
    
    # ===========================================
    # MongoDB Settings (Optional)
    # ===========================================
    use_mongodb: bool = Field(default=False, description="Use MongoDB instead of local storage")
    mongo_uri: str = Field(default="mongodb://localhost:27017", description="MongoDB connection URI")
    mongo_db_name: str = Field(default="privasense", description="MongoDB database name")
    
    # ===========================================
    # Validators
    # ===========================================
    
    @field_validator("cors_origins")
    @classmethod
    def parse_cors_origins(cls, v) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        if isinstance(v, list):
            return v
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    
    @field_validator("telegram_bot_token")
    @classmethod
    def validate_telegram_token(cls, v):
        """Validate Telegram bot token format."""
        if v and not re.match(r'^[0-9]+:[A-Za-z0-9_-]+$', v):
            raise ValueError(
                "Invalid TELEGRAM_BOT_TOKEN format. "
                "Expected format: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'"
            )
        return v
    
    @field_validator("storage_dir")
    @classmethod
    def validate_storage_dir(cls, v):
        """Ensure storage directory path is valid."""
        if not v or not v.strip():
            raise ValueError("STORAGE_DIR cannot be empty")
        return v
    
    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields not defined in the model


# Global settings instance
_settings: Settings = None


def get_settings() -> Settings:
    """
    Get or create the global settings instance.
    This ensures settings are loaded only once.
    """
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """Force reload settings from environment."""
    global _settings
    _settings = Settings()
    return _settings