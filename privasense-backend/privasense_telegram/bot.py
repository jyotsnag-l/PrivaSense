"""
Telegram bot entry point — registers all handlers and starts polling.
"""

import os
import logging
from typing import Optional

from dotenv import load_dotenv
from telegram.ext import Application, CommandHandler

from privasense_telegram.commands import (
    handle_start,
    handle_help,
    handle_link,
    handle_status,
    handle_report,
    handle_trend,
)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Bot configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Global application instance
_app: Optional[Application] = None


def create_application() -> Application:
    """
    Create and configure the Telegram bot application.

    Returns:
        Configured Application instance
    """
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError(
            "TELEGRAM_BOT_TOKEN not set in environment. "
            "Please set it in your .env file."
        )

    # Build application
    application = (
        Application.builder()
        .token(TELEGRAM_BOT_TOKEN)
        .build()
    )

    # Register command handlers
    application.add_handler(CommandHandler("start", handle_start))
    application.add_handler(CommandHandler("help", handle_help))
    application.add_handler(CommandHandler("link", handle_link))
    application.add_handler(CommandHandler("status", handle_status))
    application.add_handler(CommandHandler("report", handle_report))
    application.add_handler(CommandHandler("trend", handle_trend))

    return application


def get_bot_app() -> Application:
    """
    Get the bot application instance, creating it if needed.

    Returns:
        Application instance
    """
    global _app
    if _app is None:
        _app = create_application()
    return _app


def run_bot() -> None:
    """
    Start the Telegram bot polling loop.
    This function blocks until the bot is stopped.
    """
    global _app

    if not TELEGRAM_BOT_TOKEN:
        print("\n" + "="*60)
        print("  ⚠️  TELEGRAM_BOT_TOKEN not set!")
        print("  Please set TELEGRAM_BOT_TOKEN in your .env file.")
        print("="*60)
        logger.error(
            "TELEGRAM_BOT_TOKEN not set. "
            "Please set TELEGRAM_BOT_TOKEN in your .env file."
        )
        return

    try:
        _app = create_application()
        
        # Print startup banner
        print("\n" + "="*60)
        print("  PrivaSense Telegram Bot - Starting Up")
        print("="*60)
        print(f"  ✅ Bot Token: Configured")
        print(f"  ✅ Bot is running and listening for messages...")
        print(f"  ℹ️  Press Ctrl+C to stop")
        print("="*60 + "\n")
        
        logger.info("Starting PrivaSense Telegram bot...")
        _app.run_polling(allowed_updates=Update.ALL_TYPES)
    except Exception as e:
        logger.error(f"Bot polling error: {e}")
        print(f"\n❌ Bot error: {e}")
        raise


# Import Update for allowed_updates
from telegram import Update