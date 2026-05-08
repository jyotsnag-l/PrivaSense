# PrivaSense

> Passive cognitive drift detection for elderly Indians. On-device. Hindi-first. Offline-ready.

![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Android-blue) ![ML Runtime](https://img.shields.io/badge/runtime-ONNX-orange) ![Status](https://img.shields.io/badge/status-alpha-yellow)

---

## Overview

Cognitive decline in Indian elderly goes undetected for years. Existing clinical tools rely on Western population norms, English language, and hospital visits — none of which fit rural India.

PrivaSense solves this by passively tracking personal cognitive drift in the user's own language, on their own device. When drift exceeds a threshold, family members are notified through an in-app alert — not a doctor, not a clinic.

---

## Features

| Module | Description |
|---|---|
| 🎙️ **Speech Biomarker Engine** | Whisper ASR captures pause frequency, lexical repetition, vocabulary richness, and Hindi-English code-switch degradation — fully local |
| ⌨️ **Keystroke Motor Signal** | Custom logger tracks key-hold duration, WPM, and backspace rate to monitor fine motor control passively |
| 👁️ **Visual Affect (MediaPipe)** | 468-point face mesh detects blink rate and affective flattening; zero data leaves the device |
| 📊 **Personal Drift Index (PDI)** | SHAP-weighted composite score comparing today's session to the user's Day-1 personal baseline — no Western norms |
| 🔔 **In-App Family Alert** | PDI ≥ 65 triggers a plain-language in-app notification to linked family members; zero raw biometric data is shared |
| ✈️ **True Edge ML** | Full inference pipeline runs on-device via ONNX Runtime; demo operates with Wi-Fi off |

---

## How It Works

```
Day 1 Baseline → Daily Voice Check-in → On-Device ONNX Inference
→ PDI Computed → Threshold Check (PDI ≥ 65?) → In-App Family Alert → Family views SHAP Report
```

No doctor. No hospital. No cloud upload.

---

## Tech Stack

| Layer | Technology |
|---|---|
| ASR | Whisper Small (fine-tuned, Hindi + code-mixed corpus) |
| Face Mesh | MediaPipe (468 landmarks, 30fps) |
| ML Runtime | ONNX Runtime (quantised for Android ≤3 GB RAM) |
| Explainability | SHAP (per-session feature attribution) |
| Alerts | In-app notification system |
| Language | Kotlin (Android) |

---

## Performance

- **PDI inference latency** — ~40ms on mid-range Android
- **Battery drain per session** — <2%
- **Raw biometric data uploaded** — 0 bytes
- **Indian languages in roadmap** — 22

---

## Privacy Design

PrivaSense is built zero-knowledge by design:

- All audio, video, and keystroke data is processed **on-device only**
- Only the PDI score and trigger timestamp are ever transmitted to the family alert system
- No biometric data is stored on any server
- Family members receive a plain-language summary — never raw signal data

---

## Project Structure

```
privasense/
├── app/
│   ├── src/
│   │   ├── biomarkers/
│   │   │   ├── speech/          # Whisper ASR + feature extraction
│   │   │   ├── keystroke/       # Motor signal logger
│   │   │   └── affect/          # MediaPipe face mesh
│   │   ├── pdi/
│   │   │   ├── engine/          # SHAP-weighted PDI computation
│   │   │   └── baseline/        # Day-1 personal baseline storage
│   │   ├── alerts/              # In-app family notification system
│   │   └── ui/                  # Hindi-first interface
├── models/
│   ├── whisper_small_hi.onnx
│   └── affect_mesh.onnx
├── docs/
└── README.md
```

---

## Getting Started

### Prerequisites

- Android Studio Hedgehog or later
- Android SDK 26+
- Device or emulator with camera + microphone

### Installation

```bash
git clone https://github.com/your-org/privasense.git
cd privasense
```

Open in Android Studio, sync Gradle, and run on a physical device (camera and mic permissions required).

### Offline Demo

The app runs entirely without internet. Enable airplane mode before launching to verify the full offline inference pipeline.

---

## Roadmap

- [ ] Expand ASR fine-tuning to Tamil, Bengali, Telugu
- [ ] iOS port (Core ML runtime)
- [ ] ICMR ethics review and longitudinal pilot (300 participants, rural UP + Tamil Nadu)
- [ ] Caregiver dashboard with trend visualisation
- [ ] GP referral pathway (opt-in, family-gated)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE)

---

## Research & Ethics

PrivaSense is not a medical device and does not provide clinical diagnoses. It is designed as an early-warning tool for families. ICMR ethics review is currently pending. If you are a researcher interested in collaboration, please open an issue or reach out directly.

---

*Built for the last mile. Hindi-first. Works offline.*
