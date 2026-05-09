# PrivaSense Backend

Privacy-first, on-device cognitive monitoring system that passively detects early signs of cognitive decline using voice biomarkers, with Telegram bot integration for caregiver alerting.

## Overview

PrivaSense analyzes speech patterns to extract cognitive biomarkers and compute a Privacy-first Decline Indicator (PDI) score. The system tracks changes over time and alerts caregivers when concerning patterns are detected — all while keeping data on-device for maximum privacy.

## Features

- **Voice Analysis**: Extracts 6 cognitive biomarkers from speech
- **PDI Scoring**: Weighted deviation from personal baseline (0.0–1.0)
- **Risk Levels**: LOW, MEDIUM, HIGH classification
- **Trend Detection**: Identifies rising PDI patterns over time
- **Telegram Alerts**: Automatic notifications to caregivers
- **Privacy-First**: All processing on-device, no cloud dependencies

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` and configure the following settings:

```bash
# ===========================================
# Required: Telegram Configuration
# ===========================================

TELEGRAM_BOT_TOKEN=your_bot_token_here
ALERT_CHAT_ID=your_caregiver_chat_id_here

# ===========================================
# Optional: Security Configuration
# ===========================================

# CORS Origins (comma-separated list of allowed frontend URLs)
CORS_ORIGINS=http://localhost:3000,https://yourapp.vercel.app

# Rate Limiting (requests per minute per IP)
RATE_LIMIT_PER_MINUTE=30

# ===========================================
# Optional: PDI Alert Configuration
# ===========================================

PDI_ALERT_THRESHOLD=0.50
PDI_TREND_WINDOW=3

# ===========================================
# Optional: Storage Configuration
# ===========================================

STORAGE_DIR=./data

# MongoDB Configuration (optional - for scalable storage)
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=privasense
USE_MONGODB=false
```

### 3. MongoDB Setup (Optional - for scalable storage)

By default, PrivaSense uses local JSON/CSV files for storage. For production deployments with multiple users, MongoDB is recommended.

**Install MongoDB:**
- **Ubuntu/Debian:** `sudo apt-get install mongodb-org`
- **macOS:** `brew install mongodb-community`
- **Docker:** `docker run -d -p 27017:27017 --name mongodb mongo:latest`

**Configure MongoDB in `.env`:**
```
USE_MONGODB=true
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=privasense
```

**MongoDB Atlas (Cloud):**
For cloud-hosted MongoDB, use MongoDB Atlas:
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Get your connection string
3. Update `.env`:
```
USE_MONGODB=true
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/privasense
```

The storage adapter automatically falls back to local files if MongoDB is unavailable.

### 3. Getting a Telegram Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Give your bot a name (e.g., "PrivaSense Alerts") and username
4. BotFather will give you a token — copy it to your `.env` file

## Running the System

### Start the API Server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Start the Telegram Bot (separate terminal)

```bash
python -m telegram.bot
```

## Quick Start Guide

### 1. Set up your environment

```bash
# Clone and navigate to the project
cd privasense-backend

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### 2. Configure your environment

Edit `.env` and set:
- `TELEGRAM_BOT_TOKEN=<your-bot-token>`
- `CORS_ORIGINS=http://localhost:3000`

### 3. Start the server

```bash
uvicorn main:app --reload --port 8000
```

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Demo analysis
curl -X POST http://localhost:8000/demo -F "user_id=test_user"
```

### 5. Connect your frontend

```javascript
const formData = new FormData();
formData.append('user_id', 'user123');
formData.append('audio', audioFile);

fetch('http://localhost:8000/analyze', {
  method: 'POST',
  body: formData
});
```

## API Endpoints

### Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{"status": "ok", "service": "PrivaSense", "model": "whisper-tiny"}
```

### Analyze Audio

```bash
curl -X POST http://localhost:8000/analyze \
  -F "user_id=user123" \
  -F "audio=@recording.wav"
```

**File Constraints:**
- Supported formats: WAV, WebM, MP3, M4A, OGG
- Maximum file size: 25MB
- Rate limit: 10 requests per minute

### Demo Mode (no audio required)

```bash
curl -X POST http://localhost:8000/demo \
  -F "user_id=user123"
```

### Get User History

```bash
curl http://localhost:8000/history/user123
```

### Get User Status

```bash
curl http://localhost:8000/status/user123
```

### Link Caregiver

```bash
curl -X POST http://localhost:8000/link \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123", "caregiver_chat_id": 123456789}'
```

### JavaScript/Fetch Example

```javascript
const formData = new FormData();
formData.append('user_id', 'user123');
formData.append('audio', audioFile);

const response = await fetch('http://localhost:8000/analyze', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

### Python Example

```python
import requests

BASE_URL = "http://localhost:8000"

# Demo analysis
response = requests.post(
    f"{BASE_URL}/demo",
    data={"user_id": "user123"}
)
print(response.json())

# Analyze audio file
with open("recording.wav", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/analyze",
        files={"audio": f},
        data={"user_id": "user123"}
    )
print(response.json())
```

## Telegram Bot Commands

### `/start`
Welcome message and introduction.

### `/help`
List all available commands.

### `/link <user_id>`
Link yourself to receive alerts for a specific user.

```
/link user123
```

### `/status <user_id>`
Get latest PDI score and risk level.

```
/status user123
```

### `/report <user_id>`
Get detailed feature breakdown for the latest session.

```
/report user123
```

### `/trend <user_id>`
View PDI trend over the last 7 sessions with sparkline visualization.

```
/trend user123
```

## How It Works

### 1. Audio Processing Pipeline

1. **Transcription**: Whisper tiny model converts speech to text
2. **Feature Extraction**: 6 cognitive biomarkers computed
3. **PDI Calculation**: Weighted deviation from baseline
4. **Baseline Update**: EMA smoothing for personal baseline
5. **History Storage**: Session data appended to CSV
6. **Alert Check**: Triggers if HIGH risk or rising trend

### 2. Cognitive Biomarkers

| Feature | Domain | Description |
|---------|--------|-------------|
| `pause_rate` | Language fluency | Pauses >0.3s per second |
| `mean_pause_duration` | Language fluency | Average pause length |
| `speech_rate_wpm` | Processing speed | Words per minute |
| `filler_rate` | Working memory | Filler words ratio |
| `lexical_diversity` | Memory retrieval | Vocabulary variety (MATTR) |
| `pitch_variability` | Emotional regulation | F0 standard deviation |

### 3. PDI Calculation

```
For each feature:
  deviation = |current - baseline| / (|baseline| + ε)
  contribution = weight × deviation × direction

raw_pdi = sum(|contributions|)
pdi = sigmoid(5 × (raw_pdi - 0.5))  # Maps to 0.0–1.0
```

### 4. Risk Levels

- **LOW**: PDI < 0.25
- **MEDIUM**: 0.25 ≤ PDI < 0.50
- **HIGH**: PDI ≥ 0.50

### 5. Alert Triggers

Alerts are sent when:
1. Single session PDI indicates HIGH risk, OR
2. Last 3 sessions show consecutive PDI increases (all MEDIUM/HIGH)

De-duplication: Max one alert per user every 6 hours.

## Project Structure

```
privasense-backend/
├── main.py                  # FastAPI app + REST routes
├── pipeline/
│   ├── __init__.py
│   ├── transcriber.py       # Whisper + synthetic fallback
│   ├── features.py          # 6 feature extractors
│   ├── pdi.py               # PDI engine + SHAP
│   └── baseline.py          # EMA baseline management
├── storage/
│   ├── __init__.py
│   ├── local_store.py       # JSON/CSV storage helpers
│   ├── mongo_store.py       # MongoDB storage layer
│   └── adapter.py           # Storage adapter (auto-switches between local/MongoDB)
├── telegram/
│   ├── __init__.py
│   ├── bot.py               # Bot entry point
│   ├── commands.py          # /start /link /status etc.
│   └── alerts.py            # Alert engine
├── models/
│   └── schemas.py           # Pydantic models
├── tests/
│   ├── __init__.py
│   ├── test_features.py
│   ├── test_pdi.py
│   ├── test_baseline.py
│   ├── test_api.py
│   └── test_telegram.py
├── .env.example
├── requirements.txt
└── README.md
```

## Running Tests

```bash
pytest tests/ -v
```

## Data Storage

### Local Storage (Default)
By default, data is stored in the `./data` directory:
- `privasense_baselines.json` — User baselines with session counts
- `privasense_history.csv` — Append-only session history
- `caregiver_links.json` — User → caregiver chat ID mappings
- `alert_log.json` — Last alert timestamps for de-duplication

### MongoDB (Production)
For scalable deployments, set `USE_MONGODB=true` in `.env` to use MongoDB instead. The storage adapter automatically falls back to local files if MongoDB is unavailable.

MongoDB Collections:
- `baselines` — User baselines with EMA tracking
- `history` — Session history with indexed queries
- `caregiver_links` — User to caregiver mappings
- `alert_log` — Alert timestamps for de-duplication

## License

MIT License — see LICENSE file for details.

## Disclaimer

⚠️ **Not a Medical Device**: PrivaSense is for research and wellness monitoring only. It is not intended to diagnose, treat, or prevent any medical condition. Always consult healthcare professionals for clinical assessment.