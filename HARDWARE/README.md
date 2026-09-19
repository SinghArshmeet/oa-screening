# OrthoNex Hardware Integration & Setup Guide

This directory contains complete documentation, wiring schematics, pinout references, and bill of materials (BOM) for the **OrthoNex ESP32-CAM Cloud Tele-Screening Unit**.

---

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Bill of Materials (BOM)](#bill-of-materials-bom)
3. [Connection Methods](#connection-methods)
   - [Method 1: ESP32-CAM-MB Shield (Recommended / Plug-and-Play)](#method-1-esp32-cam-mb-shield-recommended)
   - [Method 2: Standalone FTDI / USB-to-TTL Programmer](#method-2-standalone-ftdi--usb-to-ttl-programmer)
4. [Camera Sensor Installation & Alignment](#camera-sensor-installation--alignment)
5. [Clinical Rig & Physical Setup Guide](#clinical-rig--physical-setup-guide)
6. [Power Specifications & Decoupling](#power-specifications--decoupling)
7. [Hardware Troubleshooting Matrix](#hardware-troubleshooting-matrix)

---

## 🔬 System Overview

The OrthoNex screening system leverages an **AI-Thinker ESP32-CAM** module to deliver real-time, low-latency side-view (sagittal) gait video streams directly to the OrthoNex cloud platform over secure WebSockets (WSS).

```
   ┌───────────────────────┐
   │    OV2640 2MP Lens    │
   └──────────┬────────────┘
              │ 8-bit DVP Ribbon
   ┌──────────▼────────────┐       2.4 GHz Wi-Fi         ┌───────────────────────────┐
   │  AI-Thinker ESP32-CAM │ ══════════════════════════> │    OrthoNex Cloud Relay   │
   │  (Dual-Core 240MHz,   │    Outbound TLS WebSocket   │   (FastAPI / Render.com)  │
   │   4MB External PSRAM) │ <══════════════════════════ │  /api/esp/ws/camera (WSS) │
   └──────────┬────────────┘     Hardware Controls       └─────────────┬─────────────┘
              │                  (Flash Light, FPS)                    │
   ┌──────────▼────────────┐                                           │ Low-Latency
   │   ESP32-CAM-MB Shield │                                           │ Binary Frames
   │  (CH340G USB-UART)    │                                           ▼
   └──────────┬────────────┘                             ┌───────────────────────────┐
              │ Micro-USB Cable                          │   OrthoNex Web Platform   │
   ┌──────────▼────────────┐                             │ (Vercel React + MediaPipe)│
   │  5V 2A Power Source   │                             │  /gait HUD Live Analysis  │
   └───────────────────────┘                             └───────────────────────────┘
```

### Key Hardware Capabilities
- **Capture Resolution:** QVGA (320×240) / CIF (400×296) optimized for cloud transmission at ~15-20 FPS.
- **Onboard Lighting:** Ultra-bright SMD Flash LED on **GPIO 4** controllable via web interface for low-light clinical environments.
- **Bi-directional Tele-Control:** Remote Flash trigger, resolution adjustment, and status telemetry.
- **Cloud-Ready:** Uses outbound TLS WebSockets—**no port forwarding, static IP, or router configuration required**.

---

## 📦 Bill of Materials (BOM)

| # | Item | Description | Purpose | Required? |
|---|------|-------------|---------|-----------|
| 1 | **AI-Thinker ESP32-CAM** | Dual-core ESP32-S module with 4MB PSRAM & OV2640 camera | Main processing & video capture | **Mandatory** |
| 2 | **OV2640 Camera Module** | 2-Megapixel camera sensor (66°–120° FOV, DVP interface) | Image capture | **Mandatory** (bundled) |
| 3 | **ESP32-CAM-MB Shield** | Dual-deck daughterboard with CH340G chip, RST + IO0 buttons | USB programming, power & auto-reset | **Highly Recommended** |
| 4 | **Micro-USB Cable** | High-quality 4-wire data & power cable | Flashing and continuous 5V power | **Mandatory** |
| 5 | **5V / 2A Power Adapter** | Clean DC regulated USB power source (phone charger / powerbank) | Prevents brownouts during Wi-Fi transmission | **Mandatory** |
| 6 | *FT232RL FTDI Adapter* | 3.3V/5V USB-to-TTL serial converter | Alternative programmer (only if MB shield is unavailable) | Optional fallback |
| 7 | *DuPont Jumper Wires* | Female-to-Female jumper cables | Wiring FTDI programmer to ESP32 pins | Optional fallback |
| 8 | *Mini Tripod / Stand* | 0.8m to 1.0m height camera stand | Stable positioning for patient gait capture | Recommended |

---

## 🔌 Connection Methods

### Method 1: ESP32-CAM-MB Shield (Recommended)

The **ESP32-CAM-MB** daughterboard plugs directly underneath the ESP32-CAM. It integrates:
- **CH340G USB-to-UART converter**
- Auto-programming transistor logic (handles GPIO 0 pulling to GND automatically during flashing)
- Hardware Reset (**RST**) and Boot (**IO0**) buttons
- Direct Micro-USB connector

```
             ┌─────────────────────────────┐
             │       AI-Thinker ESP32-CAM  │
             │   ┌─────────────────────┐   │
             │   │    OV2640 CAMERA    │   │
             │   └─────────────────────┘   │
             │ [Flash LED]                 │
             └──────────────┬──────────────┘
                       MALE HEADER PINS
                            ▼  ▼
                      FEMALE HEADERS
             ┌──────────────┴──────────────┐
             │      ESP32-CAM-MB SHIELD    │
             │  [CH340G]      [RST]  [IO0] │
             │                             │
             │         [MICRO-USB]         │
             └──────────────┬──────────────┘
                            │
                   Micro-USB Data Cable
                            ▼
                    PC / 5V 2A Adapter
```

#### Step-by-Step Installation:
1. Align the 8 pins on each side of the ESP32-CAM with the 8 sockets on each side of the MB shield.
2. **Double check orientation:** The micro-USB port faces the **same direction as the micro-SD card slot**.
3. Firmly press down until both boards are fully seated.
4. Plug in the Micro-USB cable to your computer.
5. In Arduino IDE, select:
   - **Board:** `AI Thinker ESP32-CAM`
   - **Port:** `COMx` (Windows) or `/dev/ttyUSBx` (Linux/macOS)
6. Hit **Upload** — the board flashes automatically without requiring manual buttons or jumper wires!

---

### Method 2: Standalone FTDI / USB-to-TTL Programmer

If you are using a standard USB-to-Serial converter (FTDI FT232RL, CP2102, or CH340) without an MB shield:

```
FTDI Programmer                   ESP32-CAM Module
┌──────────────────┐              ┌───────────────────────────┐
│              VCC ├──────────────┤ 5V (or 3V3)               │
│              GND ├──────┬───────┤ GND                       │
│               RX ├──────┼───────┤ U0T (GPIO 1 / TX)         │
│               TX ├──────┼───────┤ U0R (GPIO 3 / RX)         │
│                  │      │       │                           │
│                  │      │  ┌────┤ GPIO 0                    │
│                  │      └──┴───>│ (Connect to GND for flash)│
└──────────────────┘              └───────────────────────────┘
```

#### Pin Connection Matrix (Flashing Mode):
| FTDI / Serial Pin | ESP32-CAM Pin | Color Code Suggestion | Function |
|:-----------------:|:-------------:|:---------------------:|:---------|
| **VCC (5V)**      | **5V**        | 🔴 Red                | 5V Power Supply Rail |
| **GND**           | **GND**       | ⚫ Black              | Common Ground |
| **RXD**           | **U0T (TX0)** | 🟡 Yellow             | Serial Data (ESP Transmit -> FTDI Receive) |
| **TXD**           | **U0R (RX0)** | 🟢 Green              | Serial Data (FTDI Transmit -> ESP Receive) |
| *Jumper Wire*     | **GPIO 0**    | 🔵 Blue               | **Connect to GND for Flashing** |

> [!IMPORTANT]
> **Flashing Procedure:**
> 1. Bridge **GPIO 0** to **GND** using a jumper wire.
> 2. Press the **RST** button on the bottom of the ESP32-CAM to put it in bootloader mode.
> 3. Click **Upload** in Arduino IDE.
> 4. Once uploading completes, **DISCONNECT GPIO 0 from GND**.
> 5. Press the **RST** button again to enter normal operating mode.

---

## 📷 Camera Sensor Installation & Alignment

The OV2640 camera uses a delicate 24-pin Flexible Printed Circuit (FPC) ribbon cable.

```
       Step 1: Release Lock           Step 2: Insert Ribbon        Step 3: Secure Latch
          ┌─────────────┐                ┌─────────────┐             ┌─────────────┐
          │   [BLACK]   │  LIFT UP       │░░░░░░░░░░░░░│  INSERT     │▓▓▓▓▓▓▓▓▓▓▓▓▓│  PUSH DOWN
          │   ┌─────┐   │  ───▲───>      │  [RIBBON]   │  ───▼───>   │   [LATCH]   │  TO LOCK
          │   └─────┘   │                │   CONTACTS  │             │             │
          └─────────────┘                └─────────────┘             └─────────────┘
```

1. **Open the connector:** Carefully lift the black plastic latch bar on the FPC connector upward using a fingernail or tweezers (it pivots up by ~90°).
2. **Insert the ribbon:** Orient the gold contact pins toward the ESP32 circuit board (away from the camera lens). Insert the ribbon flat until it stops.
3. **Lock the connector:** Press the black plastic latch back down until it snaps flush against the connector housing.
4. **Orientation:** The lens should point forward, unobstructed by any wires or capacitors.

---

## 🚶 Clinical Rig & Physical Setup Guide

For clinical gait screening, consistent camera positioning is critical for accurate MediaPipe landmark extraction (hip, knee, and ankle joint angles).

```
                      ORTHONEX CLINICAL GAIT RUNWAY
 ──────────────────────────────────────────────────────────────────────────

                               PATIENT WALKING LINE
                   ◄──────────────────────────────────────►
                                 4 to 6 METERS

                       │                            │
                       │                            │
                       │    3.0 to 4.0 METERS       │
                       │    CAPTURE DISTANCE        │
                       ▼                            ▼
                 ┌───────────┐
                 │ ESP32-CAM │  Mounted on Tripod
                 │  MODULE   │  Height: 0.85m – 0.95m (Hip Level)
                 └─────┬─────┘  Angle: Perpendicular 90° (True Sagittal Plane)
                       │
                 ┌─────┴─────┐
                 │  TRIPOD   │
                 └───────────┘
```

### Setup Requirements
1. **Camera Height:** Mount the camera on a tripod at **0.85m – 0.95m** from the floor (approximate adult hip level).
2. **Distance:** Position the tripod **3.0m to 4.0m** away from the walking corridor. This allows full-body view (head to feet) through the entire stride cycle.
3. **Walking Corridor:** Provide a straight, level, non-slippery walkway at least **5 meters long**.
4. **Lighting:** Ensure even diffuse lighting. If the patient has cast shadows, toggle the **Onboard Flash LED (GPIO 4)** from the OrthoNex web dashboard.
5. **Background:** A plain wall or uncluttered background improves MediaPipe pose extraction accuracy.

---

## ⚡ Power Specifications & Decoupling

ESP32-CAM modules are sensitive to power voltage drops. During Wi-Fi calibration and frame transmission bursts, the radio draws up to **310mA peaks**.

### Power Checklist:
- **Voltage:** Regulated **5.0V** applied to the 5V pin (the onboard AMS1117-3.3 regulator converts this to 3.3V for the ESP32 and camera).
- **Current:** Use a power supply rated for at least **1.5A to 2.0A**.
- **Decoupling Capacitor:** If you experience random reboots (`Brownout detector was triggered`), solder a **100µF to 470µF electrolytic capacitor** directly between **5V** and **GND** pins on the ESP32-CAM to absorb current spikes.

---

## 🛠️ Hardware Troubleshooting Matrix

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| `Brownout detector was triggered` | Insufficient current or low-quality USB cable causing voltage drop below 4.5V | Use a 5V 2A wall adapter and thick data cable; add 220µF/470µF capacitor across 5V & GND. |
| `Camera init failed with error 0x20003` | OV2640 ribbon cable loose or upside down | Re-seat the FPC ribbon cable with gold contacts facing towards the board. |
| `Camera init failed with error 0x105` | PSRAM not enabled or defective | In Arduino IDE: Tools -> **PSRAM: "Enabled"**. |
| `Failed to connect to ESP32: Timed out` | GPIO 0 not grounded or wrong COM port | On MB shield: hold IO0 while clicking Upload. On FTDI: ensure GPIO 0 is connected to GND during boot. |
| Camera connects to Wi-Fi but drops WebSocket | Weak 2.4GHz Wi-Fi signal or slow ping | Place module within 5m of Wi-Fi router. Note: ESP32 only supports **2.4 GHz** Wi-Fi networks (not 5 GHz). |
| Flash LED stays on dim red | GPIO 33 status LED indicator | Normal operation: GPIO 33 is inverted logic (LOW = ON, HIGH = OFF). |

---

## 📁 Additional Hardware Documentation
- [Wiring Schematics & Circuit Diagrams](file:///c:/Users/Arshmeet/OneDrive/Desktop/Projects/OA_NER%20Screening/HARDWARE/WIRING_DIAGRAM.md)
- [Complete Pinout & GPIO Multiplexing Reference](file:///c:/Users/Arshmeet/OneDrive/Desktop/Projects/OA_NER%20Screening/HARDWARE/PINOUT_REFERENCE.md)
- [Bill of Materials & Technical Specifications](file:///c:/Users/Arshmeet/OneDrive/Desktop/Projects/OA_NER%20Screening/HARDWARE/BOM_AND_SPECS.md)
