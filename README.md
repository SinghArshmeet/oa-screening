# OrthoNex India — AI & IoT Tele-Screening Platform for Knee Osteoarthritis

[![Live Web Application](https://img.shields.io/badge/Vercel-orthonex.vercel.app-000000?style=for-the-badge&logo=vercel)](https://orthonex.vercel.app)
[![Cloud API & WebSockets](https://img.shields.io/badge/Render-FastAPI%20Backend-46E3B7?style=for-the-badge&logo=render)](https://oa-ner-screening.onrender.com)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)](https://python.org)
[![React 18 + Vite](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react)](https://vitejs.dev)
[![ABDM Aligned](https://img.shields.io/badge/ABDM-ABHA%20Ready-indigo?style=for-the-badge)](https://abdm.gov.in)
[![Hardware Rig](https://img.shields.io/badge/Hardware-ESP32--CAM%20%2B%20Servo-red?style=for-the-badge&logo=arduino)](./HARDWARE/README.md)

**OrthoNex India** is an end-to-end cyber-physical tele-screening platform for non-invasive, early risk assessment of **Knee Osteoarthritis (KOA)**. Purpose-built for frontline community clinics, primary health centers (PHCs), and rural health sub-centres across India, it unifies:
1. **Untethered IoT Camera Rig:** AI-Thinker ESP32-CAM + Servo Gimbal + Arduino Nano steering + 2S LiPo power rail with capacitive brownout decoupling.
2. **Markerless Biomechanical Computer Vision:** Real-time 33-point MediaPipe pose topology, bilateral included angles ($170^\circ-180^\circ$), dynamic bilateral ROM ($^\circ$), frontal coronal axis classification (Genu Varum / Valgum), spectral cadence (CPM), and antalgic limp asymmetry index.
3. **Tri-Modal Clinical Risk Fusion Engine:** Multimodal late fusion combining gait kinematics, KOOS-India symptom burdens, and PyTorch ResNet-18 radiograph Kellgren-Lawrence (KL 0–4) staging with Grad-CAM explainability.
4. **National Health Alignment (ABDM & NHM):** 14-digit ABHA ID integration, 7 Indian regional languages, 25-hospital tertiary referral directory, and official print-ready hospital referral dossier with physician sign-off seal.

> 🌐 **Live Web Application:** **[https://orthonex.vercel.app](https://orthonex.vercel.app)**  
> 📡 **Live Cloud API & Relay:** **[https://oa-ner-screening.onrender.com](https://oa-ner-screening.onrender.com)**  
> 🚶 **Live Biomechanics Suite:** **[https://orthonex.vercel.app/#gait](https://orthonex.vercel.app/#gait)**  
> 📋 **Diagnostic Report & ABDM Referral:** **[https://orthonex.vercel.app/#report](https://orthonex.vercel.app/#report)**

---

## 📋 System Architecture

```
                          ORTHONEX INDIA SYSTEM ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════════════

    [ PATIENT GAIT RUNWAY (3-4 METERS) ]
              ▲
              │ Sagittal (Lateral 90°) & Coronal (Frontal 0°)
    ┌─────────┴─────────────┐
    │ AI-Thinker ESP32-CAM  │ ═════════════════════════════════╗
    │ OV2640/OV3660 Sensor  │     Outbound TLS WebSockets     ║
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
    │ - MediaPipe Pose (33) │    KOOS-India Survey     │ - PyTorch ResNet-18   │
    │ - Included Angles     │ - ABHA Health ID Gen     │ - KL Grade (0-4)      │
    │ - Dynamic ROM (L/R)   │ - 7 Indian Languages     │ - Grad-CAM Attention  │
    │ - Coronal Alignment   │ - Occupational Stress    │ - Bilateral Joint     │
    │ - FFT Cadence (CPM)   │ - VAS Pain & Stiffness   │   Space Width (mm)    │
    │ - Limp Asymmetry      │ - Functional ADL Limits  │ - Osteophyte Density  │
    ├───────────────────────┴──────────────────────────┴───────────────────────┤
    │ ⚙️ Interactive Doctor Calibration Sandbox (Pain, Stiff, Asym, KL, Coronal)│
    └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
          ┌─────────────────────────────────────────────────────────┐
          │       MULTIMODAL DIAGNOSTIC REPORT & TELECONSULT        │
          │  - Multimodal Convergence Formula (Risk Index 0-100%)   │
          │  - Dynamic 1-Click Clinical Prescription Macros         │
          │  - 25-Hospital Indian Tertiary Referral Network         │
          │  - Official ABDM / NHM Printable Tele-Referral Dossier   │
          │    (Physician Attestation, Reg No, & Health Centre Seal)│
          └─────────────────────────────────────────────────────────┘
```

---

## 🔬 Mathematical & Biomechanical Specifications

### 1. Knee Included Angle & Sagittal Flexion Deviation
The included anatomical angle between the thigh and shank is computed via Euclidean vector dot product of Hip ($H$), Knee ($K$), and Ankle ($A$) 3D coordinates:

$$\vec{v}_{\text{thigh}} = H - K, \quad \vec{v}_{\text{shank}} = A - K$$

$$\theta_{\text{included}} = \arccos\left(\frac{\vec{v}_{\text{thigh}} \cdot \vec{v}_{\text{shank}}}{\|\vec{v}_{\text{thigh}}\| \|\vec{v}_{\text{shank}}\|}\right) \times \frac{180}{\pi}$$

* **Included Angle Notation:** $170^\circ - 180^\circ$ represents full stance extension; values decrease to $130^\circ - 140^\circ$ during mid-swing flexion.
* **Flexion Deviation Notation:** $\theta_{\text{flex}} = 180^\circ - \theta_{\text{included}}$, where $0^\circ - 10^\circ$ indicates neutral extension and $40^\circ - 50^\circ$ indicates peak swing flexion.

### 2. Bilateral Dynamic Range of Motion (ROM)
Extracted continuously across a sliding 120-frame gait sequence ($4.0\text{ seconds}$ at $30\text{ FPS}$):

$$\text{ROM}_{\text{limb}} = \max_{t \in T}\left(\theta_{\text{included}}[t]\right) - \min_{t \in T}\left(\theta_{\text{included}}[t]\right)$$

* **Healthy Baseline:** $\text{ROM} \ge 28.0^\circ$
* **Mild-Moderate Restriction:** $20.0^\circ \le \text{ROM} < 28.0^\circ$
* **Marked Joint Rigidity:** $\text{ROM} < 20.0^\circ$

### 3. Antalgic Limp Asymmetry Index
Quantifies unilateral offloading between Left and Right limbs:

$$\Delta\text{Asymmetry} = |\text{ROM}_{\text{Left}} - \text{ROM}_{\text{Right}}|$$

* **Symmetric Gait:** $\Delta\text{Asymmetry} < 6.0^\circ$
* **Compensatory Offload:** $6.0^\circ \le \Delta\text{Asymmetry} < 12.0^\circ$
* **Severe Antalgic Limp:** $\Delta\text{Asymmetry} \ge 12.0^\circ$

### 4. Frontal Coronal Axis Malalignment (Genu Varum / Valgum)
Determined from hip-knee-ankle coronal vector intersections:

$$\theta_{\text{coronal}} = \arctan2(A_x - K_x, A_y - K_y) - \arctan2(H_x - K_x, H_y - K_y)$$

* **Genu Varum (Bow-Leg):** Medial angulation with coronal deficit $> 5.0^\circ$. Induces excessive medial compartment compressive stress and accelerates medial meniscus/cartilage degeneration (+15 points in kinematic score).
* **Genu Valgum (Knock-Knee):** Lateral angulation with coronal deviation $> 5.0^\circ$. Induces lateral joint space narrowing (+15 points in kinematic score).
* **Normal Neutral Axis:** Balanced mechanical axis ($175^\circ - 185^\circ$).

### 5. Spectral Cadence (CPM) & Velocity
Extracted using temporal zero-crossing peak analysis and Fast Fourier Transform (FFT) over the knee angular velocity signal $\omega(t) = \frac{d\theta}{dt}$:

$$\text{Cadence (CPM)} = f_{\text{dom}} \times 60 \times 2$$

$$\text{Velocity } v = \frac{\Delta x_{\text{stride}}}{\Delta t_{\text{stride}}} \quad (\text{m/s})$$

---

## ⚖️ Tri-Modal Multimodal Risk Convergence Formula

The clinical risk stratification engine executes a weighted late-fusion convergence algorithm:

$$\text{Combined Risk Index } (R) = \begin{cases} 0.35 \cdot K + 0.30 \cdot S + 0.35 \cdot X & \text{if Radiograph Staged} \\ 0.55 \cdot K + 0.45 \cdot S & \text{if Frontline Optical Only} \end{cases}$$

### Module Scoring Formulations:

1. **Kinematic Deficit Score ($K \in [0, 100]$):**
   $$K = \min\left(100, \left(\frac{\Delta\text{Asymmetry}}{18} \times 45\right) + P_v + P_c + P_{\text{coronal}}\right)$$
   * $P_v$ (Velocity Penalty): $25$ if $v \le 0.7\text{ m/s}$, $18$ if $v \le 0.9$, $10$ if $v \le 1.1$, $4$ otherwise.
   * $P_c$ (Cadence Penalty): $18$ if $\text{CPM} < 92$, $10$ if $\text{CPM} < 102$, $4$ otherwise.
   * $P_{\text{coronal}}$: $15$ if Genu Varum or Genu Valgum present; $0$ if normal neutral axis.

2. **Symptom Burden Score ($S \in [0, 100]$):**
   $$S = \min\left(100, \left(\frac{\text{VAS Pain}}{10} \times 45\right) + P_{\text{stiff}} + P_{\text{age}} + P_{\text{work}} + 1.5 \cdot (\text{Diff}_{\text{walk}} + \text{Diff}_{\text{stairs}})\right)$$
   * $P_{\text{stiff}}$: $20$ if stiffness $\ge 45\text{ min}$, $15$ if $\ge 30$, $10$ if $\ge 15$, $3$ otherwise.
   * $P_{\text{age}}$: $15$ if age $\ge 65$, $10$ if $\ge 55$, $5$ if $\ge 45$, $2$ otherwise.
   * $P_{\text{work}}$: $12$ for heavy manual occupation (squatting, agricultural labor, tea plucking); $4$ otherwise.

3. **Radiographic Staging Score ($X \in [0, 100]$):**
   * **KL Grade 0:** $8$ (Normal Joint Mechanics)
   * **KL Grade 1:** $24$ (Doubtful JSN, Possible Osteophytes)
   * **KL Grade 2:** $50$ (Definite Osteophytes, Mild JSN)
   * **KL Grade 3:** $76$ (Multiple Moderate Osteophytes, Marked JSN)
   * **KL Grade 4:** $98$ (Severe Joint Space Loss, Marked Subchondral Sclerosis)

### Triage Risk Stratification:
* **High Risk ($R \ge 65.0\%$):** *Screen Positive (Suspected OA)* — Marked uncompensated mechanical loading and high-burden symptom presentation. Trigger urgent tertiary tele-referral.
* **Moderate Risk ($30.0\% \le R < 65.0\%$):** *Early Functional Joint Strain* — Early sagittal/coronal compensation. Prescribe structured quadriceps rehabilitation, VMO conditioning, and PHC review in 12 weeks.
* **Low Risk ($R < 30.0\%$):** *Screen Negative* — Preserved biomechanical symmetry and low symptom loading. Routine joint preservation education.

---

## 🎯 Clinical Accuracy & Machine Learning Benchmarks

Validated against motion capture benchmarks and longitudinal NIH cohort records:

| Parameter | Value | Clinical Significance |
|:---|:---:|:---|
| **Training Cohort** | **NIH OAI ($N = 9,580$)** | Grounded in *PLOS ONE* (pone.0325678, 2025) longitudinal cohort |
| **Model Architecture** | **RandomForest Multi-Sensor** | 200 estimators, balanced class weights, Gini impurity splitting |
| **Diagnostic Accuracy** | **`82.7%`** | Differentiates asymptomatic knees from osteoarthritic risk |
| **ROC-AUC Score** | **`0.871`** | High discriminative capacity across early and moderate OA tiers |
| **OA Pain Precision** | **`89.4%`** | High positive predictive value for true mechanical joint degradation |
| **OA Pain Sensitivity (Recall)** | **`85.9%`** | Low false-negative rate, capturing symptomatic progression early |
| **Angular Kinematic Error** | **`±2.5°`** | Validated directly against physical clinical goniometers |
| **X-Ray Deep Learning Model** | **PyTorch ResNet-18** | 5-class Kellgren-Lawrence staging with Grad-CAM heatmaps |
| **Streaming Latency** | **`< 120 ms`** | Real-time optical video relay across outbound WebSockets |

---

## 🛠️ Cyber-Physical Hardware Rig (< $25 Total BOM)

The standalone field rig enables high-throughput gait screening in rural and community settings without motion capture laboratories:

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

### Hardware Specifications:
* **Microcontroller:** AI-Thinker ESP32-CAM (Xtensa Dual-Core 32-bit LX6 @ 240MHz, 520KB SRAM + 4MB external PSRAM).
* **Firmware Tasking:** FreeRTOS dual-core allocation:
  * **Core 0:** High-speed DMA camera frame acquisition (`fb = esp_camera_fb_get()`).
  * **Core 1:** TLS WebSocket transport & frame packetization.
* **Camera Sensor:** OV2640 2-Megapixel CMOS sensor configured for VGA resolution ($640 \times 480$) at JPEG quality 12.
* **Servo Gimbal:** TowerPro SG90 9g micro servo motor ($180^\circ$ panning sweep) driven by 50Hz PWM from Arduino Nano pin `D9`.
* **Brownout Elimination:** Dedicated L7805CV voltage regulator backed by a $220\mu\text{F}$ low-ESR electrolytic capacitor across 5V-GND rails, isolating servo inductive inrush spikes from the ESP32 radio.

### Hardware Documentation:
- 📖 **[Master Hardware Guide](./HARDWARE/README.md)**
- 🕹️ **[Joystick & Potentiometer Steering Rig](./HARDWARE/JOYSTICK_PAN_TILT_RIG.md)**
- 🤖 **[Servo Motor Integration & Decoupling](./HARDWARE/SERVO_INTEGRATION.md)**
- 📟 **[I2C OLED Status HUD Guide](./HARDWARE/OLED_DISPLAY_INTEGRATION.md)**
- 🔌 **[Complete Wiring Diagrams & Schematics](./HARDWARE/WIRING_DIAGRAM.md)**
- 📌 **[Pinout Reference & Multiplexing Guide](./HARDWARE/PINOUT_REFERENCE.md)**
- 📦 **[Bill of Materials & Component Specs](./HARDWARE/BOM_AND_SPECS.md)**

---

## 🇮🇳 ABDM Alignment & Printable Tele-Referral Dossier

### 1. Ayushman Bharat Digital Mission (ABDM) Compliance
* **14-Digit ABHA ID:** Real-time syntax verification (`91-XXXX-XXXX-XXXX`) and biometric-ready indexing.
* **7 Indian Languages:** UI localization across English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil), తెలుగు (Telugu), मराठी (Marathi), and অসমীয়া (Assamese).
* **KOOS-India Clinical Instrument:** Tailored symptom assessment incorporating cultural joint loading factors (e.g., ground squatting, paddy field labor, tea plucking, and floor sitting).

### 2. Official Printable Referral Dossier (`@media print`)
When generating paper slips or PDF records via browser print (`Ctrl+P`):
* **National Health Mission Header:** Renders Government of India / Ayushman Bharat tele-triage referral banner.
* **Patient Metadata Dossier:** Name, Age, Gender, ABHA ID, District, Primary Health Centre, and Screening Date.
* **Kinematic & Radiographic Summary:** Full breakdown of Cadence, Velocity, Included Knee Angles, Dynamic ROM, Coronal Axis, and KL Grade.
* **1-Click Clinical Recommendations:** Interventions toggled by the examining physician.
* **Physical Attestation Block:**
  * Examining Registered Medical Officer signature line & NMC / State Council Registration Number.
  * Official CHC / Health Sub-Centre circular seal box.
  * Tertiary Specialist Intake Hospital acknowledgment block.
* **Automatic Clean Print:** Hides all interactive controls, video canvas feeds, sliders, and navigation headers.

---

## 🔌 API & WebSocket Specifications

### REST Endpoints

| Endpoint | Method | Description | Request Body / Params | Response |
|:---|:---:|:---|:---|:---|
| `/api/patients` | `GET` | List active screening patients | `?search=&region=` | `Patient[]` |
| `/api/patients` | `POST` | Register patient with ABHA ID | `PatientCreate` schema | `Patient` |
| `/api/survey/submit` | `POST` | Ingest KOOS-India survey | `SurveyInput` schema | `{ status, symptomScore, risk }` |
| `/api/analyze-xray` | `POST` | Deep-learning radiograph staging | `multipart/form-data` (`image`) | `{ kl_grade, confidence, probabilities, medial_jsw_mm, gradcam_base64 }` |
| `/api/triage/referrals` | `GET` | 25-Hospital Indian referral directory | `?specialty=ortho` | `HospitalDirectory[]` |
| `/api/health` | `GET` | Service telemetry & model status | None | `{ status: "ok", models_loaded: true }` |

### WebSocket Endpoints

| Endpoint | Protocol | Purpose |
|:---|:---:|:---|
| `/api/esp/ws/camera` | `WSS` | Outbound stream ingestion from ESP32-CAM (raw JPEG buffer) |
| `/ws/live-stream` | `WSS` | Bi-directional client stream relay with 33-point pose landmark telemetry |

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/SinghArshmeet/oa-screening.git
cd oa-screening
```

### 2. Backend Setup (FastAPI + PyTorch)
```powershell
# Windows PowerShell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
pip install -e .
.\start_backend.ps1
```
*Backend API docs live at `http://localhost:8000/docs`.*

### 3. Frontend Setup (React 18 + Vite)
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
*Frontend interface live at `http://localhost:5173`.*

### 4. Build for Production
```powershell
cd frontend
npm.cmd run build
```

### 5. ESP32-CAM Firmware Upload
1. Open [`ESP-cam/ESP-cam.ino`](./ESP-cam/ESP-cam.ino) in Arduino IDE.
2. Configure local Wi-Fi SSIDs in `setupWiFiNetworks()`.
3. Select Board: **AI Thinker ESP32-CAM**, PSRAM: **Enabled**.
4. Connect via the FTDI / ESP32-CAM-MB shield and click **Upload**.

---

## 📂 Repository Structure

```
oa-screening/
├── backend/                  # FastAPI service (Auth, DB, ML Inference & WebSockets)
│   ├── main.py               # API routing, ResNet inference & WebSocket endpoints
│   ├── db.py                 # SQLite database models & schemas
│   └── requirements.txt      # Backend Python dependencies
├── frontend/                 # React 18 + Vite Web Application
│   ├── src/
│   │   ├── views/            # GaitHudView, DiagnosticReportView, IntakeView, etc.
│   │   ├── utils/            # usePoseTracker.js, api.js, language context
│   │   └── components/       # Reusable UI controls, cards, and modal dialogs
│   ├── public/               # Sample clinical videos, radiograph assets, icons
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
│   └── ESP-cam.ino           # Outbound TLS WebSockets, Multi-WiFi, & FreeRTOS tasks
├── artifacts/                # Pre-trained ML Models & Validation Reports
│   ├── clinical_biomechanical_oa_model.joblib # 9,580-patient OAI model
│   └── clinical_biomechanical_oa_model.report.json # Accuracy & ROC-AUC metrics
├── src/oa_screening/         # Core Biomechanics, Pose Extraction, & ML Pipelines
├── docs/                     # Additional Architectural & Clinical Documentation
└── README.md                 # Master Project Overview & Technical Specifications
```

---

## 📜 Clinical Governance & Statutory Disclaimer
*OrthoNex India operates as an AI-powered Clinical Decision Support System (CDSS) for frontline triage, mobility screening, and tele-rehabilitation prioritization in accordance with ICMR and National Health Mission guidelines. It does not provide autonomous medical diagnoses. Final diagnostic confirmation, prescription of pharmacological agents, and surgical triage rest exclusively with a licensed Registered Medical Practitioner (RMP).*
