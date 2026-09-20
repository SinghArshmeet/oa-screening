# OrthoNex India — AI & IoT Tele-Screening Platform for Knee Osteoarthritis

[![Live Web Application](https://img.shields.io/badge/Vercel-orthonex.vercel.app-000000?style=for-the-badge&logo=vercel)](https://orthonex.vercel.app)
[![Cloud API & WebSockets](https://img.shields.io/badge/Render-FastAPI%20Backend-46E3B7?style=for-the-badge&logo=render)](https://oa-ner-screening.onrender.com)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)](https://python.org)
[![React 18 + Vite](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react)](https://vitejs.dev)
[![ABDM Aligned](https://img.shields.io/badge/ABDM-ABHA%20Ready-indigo?style=for-the-badge)](https://abdm.gov.in)
[![Hardware Rig](https://img.shields.io/badge/Hardware-ESP32--CAM%20%2B%20Servo-red?style=for-the-badge&logo=arduino)](./HARDWARE/README.md)

**OrthoNex India** is an end-to-end cyber-physical tele-screening platform for non-invasive, early risk assessment of **Knee Osteoarthritis (KOA)**. Built for frontline community clinics, primary health centers (PHCs), and tele-rehabilitation, it combines:
1. **Untethered IoT Camera Tracking Rig** (ESP32-CAM + Servo Gimbal + Arduino Nano Steering + 2S LiPo Power Isolation)
2. **Markerless Computer Vision Biomechanics** (MediaPipe 33-point pose topology, Euclidean joint angles, FFT cadence, antalgic limp index)
3. **Clinical & Biomechanical Machine Learning** (Trained on the NIH Osteoarthritis Initiative cohort of **9,580 patients**, achieving **82.7% accuracy** and **0.871 ROC-AUC**)
4. **National Health Alignment** (Ayushman Bharat Digital Mission / ABHA ID integration, 7 Indian regional languages, KOOS-India clinical scoring, and Grad-CAM radiograph explainability).

> 🌐 **Live Web App:** **[https://orthonex.vercel.app](https://orthonex.vercel.app)**  
> 📡 **Live Cloud Relay:** **[https://oa-ner-screening.onrender.com](https://oa-ner-screening.onrender.com)**  
> 📷 **Gait Biomechanics Suite:** **[https://orthonex.vercel.app/#gait](https://orthonex.vercel.app/#gait)**

---

## 📋 Comprehensive System Overview

```
                          ORTHONEX INDIA SYSTEM ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════════════

   [ PATIENT RUNWAY (4 METERS) ]
             ▲
             │ Sagittal View (Lateral 90°)
   ┌─────────┴─────────────┐
   │ AI-Thinker ESP32-CAM  │ ═════════════════════════════════╗
   │ OV2640/OV3660 Lens    │     Outbound TLS WebSockets     ║
   │ 640x480 VGA @ 25 FPS  │   (wss://.../api/esp/ws/camera) ║
   └─────────┬─────────────┘     Zero Port-Forwarding        ║
             │ Mounted on                                    ║
   ┌─────────▼─────────────┐                                 ║
   │ SG90 Servo Panning Rig│                                 ║
   │ Controlled by Nano+Pot│                                 ║
   └───────────────────────┘                                 ▼
   ┌───────────────────────┐                     ┌────────────────────────┐
   │ 2S LiPo + L7805CV +   │                     │ Render Cloud Relay     │
   │ 220µF Decoupling Rail │                     │ FastAPI + WebSockets   │
   └───────────────────────┘                     └───────────┬────────────┘
                                                             │
                                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      ORTHONEX CLINICAL DASHBOARD                         │
   │                     (React 18 + Vite on Vercel)                          │
   ├───────────────────────┬──────────────────────────┬───────────────────────┤
   │ 🚶 Module 1: Gait CV  │ 📋 Module 2: Intake &    │ 🩻 Module 3: X-Ray    │
   │ - MediaPipe Pose      │    KOOS-India Survey     │ - ResNet / DenseNet   │
   │ - Knee Flexion (0-140)│ - ABHA Health ID Gen     │ - KL Grade Staging    │
   │ - FFT Cadence (CPM)   │ - 7 Indian Languages     │ - Grad-CAM Attention  │
   │ - Limp Asymmetry      │ - Occupational Stress    │ - Joint Space Narrow. │
   └───────────────────────┴──────────────────────────┴───────────────────────┘
                                     │
                                     ▼
         ┌─────────────────────────────────────────────────────────┐
         │       MULTIMODAL DIAGNOSTIC REPORT & TELECONSULT        │
         │  - Combined Risk Matrix (Screen Negative vs Positive)   │
         │  - 25-Hospital Indian Tertiary Referral Network         │
         │  - ABDM-Compliant Clinical Teleconsultation Dossier     │
         └─────────────────────────────────────────────────────────┘
```

---

## 🎯 Clinical Accuracy & Machine Learning Benchmarks

The diagnostic engine has been validated against clinical motion capture data and longitudinal cohort records:

| Parameter | Value | Clinical Significance |
|:---|:---:|:---|
| **Training Dataset** | **OAI Cohort ($N = 9,580$)** | Grounded in *PLOS ONE* (pone.0325678, 2025) NIH clinical cohort |
| **Diagnostic Accuracy** | **`82.7%`** | Differentiates asymptomatic knees from osteoarthritic risk |
| **ROC-AUC Score** | **`0.871`** | High discriminative capacity across early and moderate OA tiers |
| **OA Pain Precision** | **`89.4%`** | High positive predictive value for true mechanical joint degradation |
| **OA Pain Sensitivity (Recall)** | **`85.9%`** | Low false-negative rate, capturing symptomatic progression early |
| **Angular Kinematic Error** | **`±2.5°`** | Compared directly against manual clinical goniometer benchmarks |
| **Streaming Latency** | **`< 120 ms`** | Real-time optical video relay across outbound WebSockets |

### Biomechanical Metrics Extracted:
1. **Sagittal Knee Flexion/Extension Angle:**
   Computed via vector dot product of Hip-Knee and Ankle-Knee anatomical vectors:
   $$\theta_{\text{knee}} = \arccos\left(\frac{\vec{v}_{\text{thigh}} \cdot \vec{v}_{\text{shank}}}{\|\vec{v}_{\text{thigh}}\| \|\vec{v}_{\text{shank}}\|}\right) \times \frac{180}{\pi}$$
2. **Knee Range of Motion (ROM):** Maximum minus minimum angle through the full stance and swing phases.
3. **Antalgic Limp Asymmetry Index:** Quantitative disparity between Left and Right knee ROM ($|\text{ROM}_{\text{L}} - \text{ROM}_{\text{R}}|$). Values $>8^\circ$ indicate unilateral compensatory weight-bearing avoidance.
4. **Spectral Cadence (CPM):** Dominant knee oscillation frequency extracted through Fast Fourier Transform (FFT) analysis ($0.25\text{ Hz} - 2.5\text{ Hz}$).

---

## 🛠️ Cyber-Physical Hardware Rig (< $25 BOM)

The standalone field rig enables high-throughput gait screening in rural and community settings without expensive motion labs:

```
                          5V 2A POWER RAIL / L7805CV REGULATOR
                       ┌───────────────────────────────────────┐
                       │                                   5V  ├───┬─────────────┬─────────── [Red: Servo VCC]
                       │                                       │   │             │
                       │                                       │ ┌─┴─┐           ├─────────── [5V Pin: Arduino Nano]
                       │                                       │ │ + │ 220µF     │
                       │                                       │ │   │ Buffer    ├─────────── [5V Pin: ESP32-CAM]
                       │                                       │ │ - │ Capacitor │
                       │                                       │ └─┬─┘           ├─────────── [Leg 3: B10k Pot]
                       │                                   GND ├───┴─────────────┴───┬─────── [Black: Servo GND]
                       └───────────────────────────────────────┘                     │
                                                                                     ├─────── [GND: Arduino Nano]
                       AI-THINKER ESP32-CAM                                          │
                       ┌───────────────────────────────────────┐                     ├─────── [GND: ESP32-CAM]
                       │                                   5V  │◄────────────────────┤
                       │                                   GND ├─────────────────────┘
                       │                                       │
                       │ [OV2640/OV3660 CAMERA]                │
                       │ Outbound TLS Stream over 2.4GHz Wi-Fi │
                       └───────────────────────────────────────┘
                                   │
                                   ▼ Mounted onto
                       ┌───────────────────────────────────────┐
                       │        SG90 Servo Motor               │◄──── Orange Wire: Pin D9 on Nano
                       └───────────────────────────────────────┘
                                   ▲ Steered by
                       ┌───────────────────────────────────────┐
                       │        B10k Potentiometer             │───── Center Leg: Pin A0 on Nano
                       └───────────────────────────────────────┘
```

### Complete Hardware Documentation:
- 📖 **[Hardware Integration Master Guide](./HARDWARE/README.md)**
- 🕹️ **[Joystick & Potentiometer Tracking Rig](./HARDWARE/JOYSTICK_PAN_TILT_RIG.md)**
- 🤖 **[Servo Motor Integration & Decoupling](./HARDWARE/SERVO_INTEGRATION.md)**
- 📟 **[I2C OLED Status HUD Guide](./HARDWARE/OLED_DISPLAY_INTEGRATION.md)**
- 🔌 **[Complete Wiring Diagrams & Schematics](./HARDWARE/WIRING_DIAGRAM.md)**
- 📌 **[Pinout Reference & Multiplexing Guide](./HARDWARE/PINOUT_REFERENCE.md)**
- 📦 **[Bill of Materials & Component Specs](./HARDWARE/BOM_AND_SPECS.md)**

---

## 🇮🇳 ABDM & National Health Alignment

1. **Ayushman Bharat Digital Mission (ABDM):**
   - Direct integration of **ABHA (Ayushman Bharat Health Account)** 14-digit identifier with automatic format validation (`91-XXXX-XXXX-XXXX`).
   - Standardized export of diagnostic triage dossiers compatible with Electronic Health Record (EHR) pipelines.
2. **7 Indian Regional Languages:**
   - English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil), తెలుగు (Telugu), मराठी (Marathi), and অসমীয়া (Assamese).
3. **KOOS-India Clinical Instrument:**
   - Tailored 40-point assessment incorporating occupational joint stress (e.g. prolonged squatting, paddy field labor, manual agricultural loading, and urban sedentary desk postures).
4. **Tertiary Hospital Referral Directory:**
   - 25 top public and private orthopedic hospitals across India (AIIMS New Delhi, Safdarjung, PGIMER, CMC Vellore, Fortis Noida, GIMS Greater Noida, etc.) with pre-filled tele-triage dispatches.

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/SinghArshmeet/oa-ner-screening.git
cd oa-ner-screening
```

### 2. Backend Setup (FastAPI)
```powershell
# Windows PowerShell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
pip install -e .
.\start_backend.ps1
```
*Backend API documentation will be live at `http://localhost:8000/docs`.*

### 3. Frontend Setup (React 18 + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend interface will be live at `http://localhost:5173`.*

### 4. Firmware Flashing (ESP32-CAM)
1. Open [`ESP-cam/ESP-cam.ino`](./ESP-cam/ESP-cam.ino) in Arduino IDE.
2. Under `setupWiFiNetworks()`, enter your local Wi-Fi or Mobile Hotspot credentials.
3. Select Board: **AI Thinker ESP32-CAM**, PSRAM: **Enabled**.
4. Upload via the ESP32-CAM-MB shield and launch!

---

## 📂 Repository Structure

```
oa-ner-screening/
├── backend/                  # FastAPI service (Auth, DB, ML Inference & WebSockets)
│   ├── main.py               # API routing & WebSocket endpoints
│   ├── db.py                 # SQLite database models & schemas
│   └── requirements.txt      # Backend Python dependencies
├── frontend/                 # React 18 + Vite Web Application
│   ├── src/                  # Views (GaitHudView, IntakeView, ReportView, etc.)
│   ├── public/               # Sample videos, icons, and clinical test assets
│   └── vite.config.js        # Vite bundler configuration
├── HARDWARE/                 # Complete Hardware & Rig Engineering Directory
│   ├── README.md             # Master Hardware Documentation & Troubleshooting
│   ├── JOYSTICK_PAN_TILT_RIG.md # Confirmed Pot/Joystick Manual Steering Rig
│   ├── SERVO_INTEGRATION.md  # Servo wiring, timer separation, and decoupling
│   ├── OLED_DISPLAY_INTEGRATION.md # 0.96" I2C OLED display HUD
│   ├── WIRING_DIAGRAM.md     # Complete ASCII schematics & circuit tables
│   ├── PINOUT_REFERENCE.md   # ESP32-CAM multiplexing & forbidden pins
│   └── BOM_AND_SPECS.md      # Itemized Bill of Materials (< $25 total)
├── ESP-cam/                  # ESP32-CAM C++ Arduino Firmware
│   └── ESP-cam.ino           # Outbound TLS WebSockets, Multi-WiFi, & Crisp VGA
├── artifacts/                # Pre-trained ML Models & Validation Reports
│   ├── clinical_biomechanical_oa_model.joblib # 9,580-patient OAI model
│   └── clinical_biomechanical_oa_model.report.json # Accuracy & ROC-AUC metrics
├── src/oa_screening/         # Core Biomechanics, Pose Extraction, & ML Pipelines
└── README.md                 # Master Project Overview & Documentation
```

---

## 📜 Clinical Disclaimer
*OrthoNex India is an assistive frontline screening and risk-stratification tool designed for early triage and tele-consultation facilitation. It is not an autonomous diagnostic replacement for licensed orthopedic examinations, magnetic resonance imaging (MRI), or weight-bearing radiographic assessments.*
