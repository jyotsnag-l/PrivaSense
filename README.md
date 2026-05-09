<div align="center">

<br/>

```
██████╗ ██████╗ ██╗██╗   ██╗ █████╗ ███████╗███████╗███╗   ██╗███████╗███████╗
██╔══██╗██╔══██╗██║██║   ██║██╔══██╗██╔════╝██╔════╝████╗  ██║██╔════╝██╔════╝
██████╔╝██████╔╝██║██║   ██║███████║███████╗█████╗  ██╔██╗ ██║███████╗█████╗  
██╔═══╝ ██╔══██╗██║╚██╗ ██╔╝██╔══██║╚════██║██╔══╝  ██║╚██╗██║╚════██║██╔══╝  
██║     ██║  ██║██║ ╚████╔╝ ██║  ██║███████║███████╗██║ ╚████║███████║███████╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝
```

### A Privacy-First, Multi-Modal Cognitive Health Monitoring Platform

<br/>

[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind%204-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![AI Engine](https://img.shields.io/badge/AI-Whisper%20%7C%20SHAP%20%7C%20Librosa-FF6F00?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/research/whisper)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](CONTRIBUTING.md)

<br/>

> *"Cognitive decline is often detected too late. PrivaSense changes that."*

<br/>

[**Live Demo**](#)  · [**Report a Bug**](issues/new?template=bug_report.md) · [**Request a Feature**](issues/new?template=feature_request.md)

<br/>

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Why PrivaSense?](#-why-privasense)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Security & Privacy](#-security--privacy)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧠 Overview

**PrivaSense** is a clinical-grade cognitive health companion that bridges the gap between elderly patients and their caregivers. It leverages **multi-modal AI** — combining speech, vision, and motor analysis — to perform non-invasive, continuous monitoring of cognitive drift, surfacing actionable insights *before* severe decline occurs.

Unlike periodic clinical assessments that capture a single moment in time, PrivaSense builds a **longitudinal cognitive fingerprint** for each individual, enabling trend-based detection of early Alzheimer's and Dementia markers with full on-device audio processing — your data never leaves your control.

---

## 🎯 Why PrivaSense?

| The Problem | The PrivaSense Solution |
|---|---|
| Cognitive decline is detected at late, irreversible stages | Continuous tracking via the **Progressive Decline Index (PDI)** catches drift early |
| Clinical testing has high cost and access barriers | A senior-friendly web app replaces the need for frequent clinical visits |
| Audio-based AI tools send data to third-party clouds | All audio is processed **locally** via Whisper — zero external transmission |
| Caregivers lack real-time visibility into patient health | Telegram alerts and live dashboards keep families informed instantly |
| AI health tools are black boxes clinicians don't trust | **SHAP-based Explainable AI** breaks down every risk score decision |

---

## ✨ Key Features

### 👴 For Patients (The Elderly)

- **Multi-Lingual Interface** — Available in **English, Hindi, Tamil, Telugu, Bengali,** and **Kannada**, ensuring cultural comfort and accessibility for a diverse user base.
- **Voice & Motor Assessments** — Guided, easy-to-complete cognitive tasks including voice recordings and motor skill evaluations.
- **Adaptive 14-Day Wellness Plan** — AI-generated daily cognitive exercise routines that adapt dynamically to the latest assessment results.
- **Secure Caregiver Linking** — Time-bound, single-use **Join Codes** to share health history with authorized caregivers only — never with anyone else.

### 👥 For Caregivers & Clinicians

- **Clinical Dashboard** — Real-time visualization of PDI trends, risk labels, and granular cognitive markers over time.
- **Explainable AI (XAI)** — SHAP (SHapley Additive exPlanations) attribution clearly breaks down *why* a risk score changed — giving clinicians a transparent basis for decision-making.
- **Automated Telegram Alerts** — Asynchronous bot integration sends immediate notifications when an acute decline or anomaly is detected.
- **Exportable PDF Reports** — Professional, print-ready clinical reports containing full historical data and AI insights, formatted for doctor visits.

---

## 🏗️ System Architecture

PrivaSense uses a **decoupled client-server architecture** designed for privacy, scalability, and local processing.

```
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/38227f6f-6f53-49ad-a9e8-4dc7c09990fb" />

```

**Key Design Decisions:**

- 🔒 **Audio never leaves the device.** Whisper runs entirely on the backend server — no raw audio is ever forwarded to a third-party API.
- ⚡ **Async-first backend.** FastAPI's async architecture ensures assessments, alerts, and report generation don't block each other.
- 🗄️ **Storage-agnostic.** A pluggable storage adapter allows seamless switching between local JSON (dev/personal) and MongoDB (production/multi-tenant).

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite | SPA framework & fast bundling |
| **Styling** | TailwindCSS 4, Framer Motion | UI design & fluid animations |
| **Data Viz** | Recharts, jsPDF | Clinical charts & PDF report export |
| **Routing** | React Router | Client-side navigation |
| **Backend** | Python 3.10+, FastAPI, Uvicorn | Async REST API server |
| **Validation** | Pydantic | Request/response schema enforcement |
| **Rate Limiting** | SlowAPI | DDoS & brute-force protection |
| **Speech AI** | OpenAI Whisper, Librosa | Local audio transcription & signal analysis |
| **ML & XAI** | NumPy, SciPy, Pandas, SHAP | Feature extraction & explainability |
| **Storage** | Local JSON / MongoDB | Flexible data persistence |
| **Alerts** | Telegram Bot API | Real-time caregiver notifications |

---

## 🚀 Getting Started

### Prerequisites

Ensure the following are installed on your system:

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+
- [FFmpeg](https://ffmpeg.org/download.html) — required for audio processing with Whisper

```bash
# Verify your installations
node --version   # v18.x.x or higher
python --version # Python 3.10.x or higher
ffmpeg -version  # ffmpeg version x.x.x
```

---

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/privasense.git
cd privasense
```

---

### 2. Backend Setup

```bash
cd privasense-backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate       # macOS / Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt
```

Create your environment configuration:

```bash
# privasense-backend/.env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
DEBUG=True

# Optional: MongoDB connection string (defaults to local JSON storage)
# MONGODB_URI=mongodb://localhost:27017/privasense
```

Start the backend server:

```bash
python main.py
```

> ✅ Backend running at `http://localhost:8000`
> 📖 Interactive API docs at `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd ../privasense-frontend

# Install dependencies
npm install
```

Create your frontend environment file:

```bash
# privasense-frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

> ✅ Frontend running at `http://localhost:5173`

---

### 4. Quick Verification

Once both servers are running:

1. Open `http://localhost:5173` in your browser.
2. Register a patient profile.
3. Complete a voice assessment — the PDI score should appear on the dashboard.
4. (Optional) Link a caregiver using a generated Join Code.

---

## 🔒 Security & Privacy

PrivaSense is built with a **privacy-first, medical-grade** approach to sensitive data:

| Concern | Our Approach |
|---|---|
| **Audio Data** | Processed entirely on the local server via Whisper. Raw audio is **never** forwarded to external APIs or LLMs. |
| **Feature Data** | PDI models operate exclusively on extracted features (pause ratios, signal variance) — not on personally identifiable raw transcripts. |
| **Caregiver Access** | Linking is controlled via short-lived, single-use **Join Codes** — preventing unauthorized access to patient history. |
| **API Abuse** | All endpoints are rate-limited via SlowAPI and protected with strict CORS policies. |
| **Transport** | Designed for TLS/HTTPS deployment; all client-server communication should be encrypted in production. |

---

## 🤝 Contributing

Contributions, issues, and feature requests are warmly welcomed. Please follow these steps:

1. **Fork** the repository.
2. **Create** your feature branch: `git checkout -b feat/your-feature-name`
3. **Commit** your changes: `git commit -m 'feat: add some feature'`
4. **Push** to the branch: `git push origin feat/your-feature-name`
5. **Open** a Pull Request.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and development guidelines.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full terms.

---

<div align="center">

**PrivaSense** — Clinical intelligence. Complete privacy. Built for the ones who raised us.

<br/>

*If this project helped you or someone you care about, please consider giving it a ⭐*

<br/>

Made with ❤️ and a deep respect for cognitive dignity.

</div>
