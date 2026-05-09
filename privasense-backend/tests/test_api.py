"""
Tests for FastAPI endpoints in main.py
"""

import pytest
from fastapi.testclient import TestClient
import os
import json
import tempfile
from unittest.mock import patch, MagicMock

# We need to import main after setting up the environment
from main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def temp_storage(tmp_path):
    """Create a temporary storage directory."""
    with patch.dict(os.environ, {"STORAGE_DIR": str(tmp_path)}):
        yield tmp_path


class TestHealthCheck:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "PrivaSense"


class TestDemoAnalysis:
    def test_demo_analysis(self, client, temp_storage):
        response = client.post("/demo", data={"user_id": "test_user"})
        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == "test_user"
        assert "pdi" in data
        assert "risk" in data
        assert data["risk"] in ["LOW", "MEDIUM", "HIGH"]
        assert "transcript" in data
        assert "features" in data
        assert "shap" in data
        assert "sessions" in data
        assert "alert_sent" in data

    def test_demo_analysis_creates_history(self, client, temp_storage):
        # First demo call
        response = client.post("/demo", data={"user_id": "history_test"})
        assert response.status_code == 200

        # Check that history was created
        history_file = os.path.join(temp_storage, "privasense_history.csv")
        assert os.path.exists(history_file)

    def test_demo_invalid_user_id(self, client, temp_storage):
        """Test that invalid user_id is rejected."""
        # Too short
        response = client.post("/demo", data={"user_id": "ab"})
        assert response.status_code == 400
        
        # Invalid characters
        response = client.post("/demo", data={"user_id": "user@name!"})
        assert response.status_code == 400
        
        # Too long
        response = client.post("/demo", data={"user_id": "a" * 51})
        assert response.status_code == 400


class TestHistory:
    def test_history_empty(self, client, temp_storage):
        response = client.get("/history/nonexistent_user")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "nonexistent_user"
        assert data["sessions"] == []

    def test_history_with_data(self, client, temp_storage):
        # Create some data via demo
        client.post("/demo", data={"user_id": "history_user"})

        response = client.get("/history/history_user")
        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) >= 1
        assert "timestamp" in data["sessions"][0]
        assert "pdi" in data["sessions"][0]
        assert "risk" in data["sessions"][0]

    def test_history_invalid_user_id(self, client, temp_storage):
        """Test that invalid user_id is rejected."""
        response = client.get("/history/ab")
        assert response.status_code == 400


class TestStatus:
    def test_status_not_found(self, client, temp_storage):
        response = client.get("/status/nonexistent_user")
        assert response.status_code == 404

    def test_status_with_data(self, client, temp_storage):
        # Create data via demo
        client.post("/demo", data={"user_id": "status_user"})

        response = client.get("/status/status_user")
        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == "status_user"
        assert "latest_pdi" in data
        assert "risk" in data
        assert "last_seen" in data
        assert "sessions_total" in data

    def test_status_invalid_user_id(self, client, temp_storage):
        """Test that invalid user_id is rejected."""
        response = client.get("/status/ab")
        assert response.status_code == 400


class TestLink:
    def test_link_caregiver(self, client, temp_storage):
        payload = {"user_id": "linked_user", "caregiver_chat_id": 123456789}
        response = client.post("/link", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "linked_user" in data["message"]

        # Verify the link was saved
        links_file = os.path.join(temp_storage, "caregiver_links.json")
        assert os.path.exists(links_file)

        with open(links_file, "r") as f:
            links = json.load(f)
        assert links["linked_user"] == 123456789

    def test_link_invalid_user_id(self, client, temp_storage):
        """Test that invalid user_id is rejected."""
        payload = {"user_id": "ab", "caregiver_chat_id": 123456789}
        response = client.post("/link", json=payload)
        assert response.status_code == 422  # Validation error

    def test_link_invalid_chat_id(self, client, temp_storage):
        """Test that invalid chat_id is rejected."""
        payload = {"user_id": "valid_user", "caregiver_chat_id": -1}
        response = client.post("/link", json=payload)
        assert response.status_code == 422  # Validation error


class TestFileUpload:
    """Test file upload validation."""
    
    def test_analyze_invalid_file_type(self, client, temp_storage):
        """Test that invalid file types are rejected."""
        # Create a fake file with invalid extension
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"fake audio content")
            temp_path = f.name
        
        try:
            with open(temp_path, "rb") as f:
                response = client.post(
                    "/analyze",
                    files={"audio": ("test.txt", f, "text/plain")},
                    data={"user_id": "test_user"}
                )
            assert response.status_code == 400
            assert "Invalid audio format" in response.json()["detail"]
        finally:
            os.unlink(temp_path)

    def test_analyze_empty_file(self, client, temp_storage):
        """Test that empty files are rejected."""
        response = client.post(
            "/analyze",
            files={"audio": ("empty.wav", b"", "audio/wav")},
            data={"user_id": "test_user"}
        )
        assert response.status_code == 400
        assert "Empty audio file" in response.json()["detail"]