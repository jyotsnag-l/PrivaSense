"""
Tests for Telegram bot commands and alerts.
"""

import pytest
import os
import json
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta

from storage.local_store import (
    append_history,
    save_caregiver_link,
    record_alert,
)


@pytest.fixture
def temp_storage(tmp_path):
    """Create a temporary storage directory."""
    with patch.dict(os.environ, {"STORAGE_DIR": str(tmp_path)}):
        yield tmp_path


class MockUpdate:
    """Mock Telegram Update object."""

    def __init__(self, message_text="", chat_id=123, args=None):
        self.message = MagicMock()
        self.message.text = message_text
        self.message.reply_text = AsyncMock()
        self.effective_chat = MagicMock()
        self.effective_chat.id = chat_id
        self.context = MagicMock()
        self.context.args = args or []


class TestCommands:
    @pytest.mark.asyncio
    async def test_handle_start(self, temp_storage):
        from telegram.commands import handle_start

        update = MockUpdate()
        context = MagicMock()

        await handle_start(update, context)

        update.message.reply_text.assert_called_once_with(
            "Welcome to PrivaSense Caregiver Bot. Use /help to see commands."
        )

    @pytest.mark.asyncio
    async def test_handle_help(self, temp_storage):
        from telegram.commands import handle_help

        update = MockUpdate()
        context = MagicMock()

        await handle_help(update, context)

        assert update.message.reply_text.called
        # Check that the response contains command info
        call_args = update.message.reply_text.call_args[0][0]
        assert "/link" in call_args
        assert "/status" in call_args

    @pytest.mark.asyncio
    async def test_handle_link_no_args(self, temp_storage):
        from telegram.commands import handle_link

        update = MockUpdate(args=[])
        context = MagicMock()

        await handle_link(update, context)

        update.message.reply_text.assert_called_with("Usage: /link <user_id>")

    @pytest.mark.asyncio
    async def test_handle_link_with_args(self, temp_storage):
        from telegram.commands import handle_link

        update = MockUpdate(args=["test_user"])
        context = MagicMock()

        await handle_link(update, context)

        update.message.reply_text.assert_called_with(
            "You are now linked to monitoring updates for test_user."
        )

        # Verify link was saved
        links_file = os.path.join(temp_storage, "caregiver_links.json")
        with open(links_file, "r") as f:
            links = json.load(f)
        assert links["test_user"] == 123

    @pytest.mark.asyncio
    async def test_handle_status_no_data(self, temp_storage):
        from telegram.commands import handle_status

        update = MockUpdate(args=["nonexistent"])
        context = MagicMock()

        await handle_status(update, context)

        update.message.reply_text.assert_called_with("No data found for nonexistent.")

    @pytest.mark.asyncio
    async def test_handle_status_with_data(self, temp_storage):
        from telegram.commands import handle_status

        # Create some history data
        append_history("status_test", {"pause_rate": 0.5}, 0.3, "LOW")

        update = MockUpdate(args=["status_test"])
        context = MagicMock()

        await handle_status(update, context)

        response = update.message.reply_text.call_args[0][0]
        assert "status_test" in response
        assert "PDI Score" in response

    @pytest.mark.asyncio
    async def test_handle_trend_not_enough_data(self, temp_storage):
        from telegram.commands import handle_trend

        update = MockUpdate(args=["new_user"])
        context = MagicMock()

        await handle_trend(update, context)

        update.message.reply_text.assert_called_with(
            "Not enough data for trend. Need at least 2 sessions."
        )


class TestAlerts:
    def test_alert_cooldown(self, temp_storage):
        from telegram.alerts import _should_send_alert

        # First time should return True
        assert _should_send_alert("test_user") is True

        # Record an alert
        record_alert("test_user")

        # Should now be in cooldown
        assert _should_send_alert("test_user") is False

    def test_alert_cooldown_expires(self, temp_storage):
        from telegram.alerts import _should_send_alert, get_last_alert_time
        from storage.local_store import load_alert_log, save_alert_log
        from datetime import datetime, timedelta

        # Set an old alert time
        log = {"old_user": (datetime.utcnow() - timedelta(hours=7)).isoformat()}
        save_alert_log(log)

        # Should have expired
        assert _should_send_alert("old_user") is True