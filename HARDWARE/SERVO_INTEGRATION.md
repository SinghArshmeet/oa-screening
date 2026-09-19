# ESP32-CAM Servo Motor Integration (Pan / Tilt Tracking Rig)

This guide provides the complete electrical connections, pin selection rationale, power isolation guidelines, and code snippets for integrating one or two servo motors (**SG90** or **MG90S**) with the OrthoNex ESP32-CAM unit.

---

## 1. Overview & Purpose in Gait Screening

In clinical gait screening, a servo-actuated camera mount serves two purposes:
1. **Automated Patient Runway Tracking (Pan - Horizontal 0° to 180°):** The camera pivots smoothly to track a patient as they walk across the 4-meter corridor, keeping their hips and knees in frame without requiring a human operator to move the camera.
2. **Patient Height Calibration (Tilt - Vertical 0° to 60°):** Adjusts the pitch angle to align with the subject's hip joint level (pediatric vs. adult vs. elderly subjects).

---

## 2. Servo Pinout & Wire Color Codes

Standard micro-servos (TowerPro SG90, MG90S metal-gear) use a 3-pin DuPont connector:

| Wire Color | Signal Type | Connect To | Notes |
|:---:|:---:|:---|:---|
| 🔴 **Red** | **VCC (Power)** | **5V Pin** (from 5V 2A power rail) | ⚠️ **DO NOT connect to 3.3V!** Servos require 4.8V–6.0V. |
| 🟤 / ⚫ **Brown or Black** | **GND (Ground)** | **GND Pin** | Must share common ground with ESP32-CAM. |
| 🟠 / 🟡 **Orange or Yellow** | **PWM Signal** | **GPIO 13** (Pan) or **GPIO 14 / 15** (Tilt) | 50Hz PWM control signal (1ms–2ms pulse width). |

---

## 3. Which ESP32-CAM Pins Can Be Used for Servos?

Because the ESP32-CAM multiplexes almost all GPIOs for the camera sensor, PSRAM, and flash LED, pin selection is critical:

| Pin | Status for Servo | Reason |
|:---:|:---:|:---|
| **GPIO 13** | ✅ **RECOMMENDED (Primary / Pan)** | High-Speed SD line; 100% free when SD card is not in use. Has internal pull-up, safe at boot. |
| **GPIO 14** | ✅ **RECOMMENDED (Secondary / Tilt)** | Free when SD card is not in use. Generates clean PWM. |
| **GPIO 15** | ✅ **USABLE (Alternative Tilt)** | Free when SD card is not in use. (Must not be driven HIGH during flashing). |
| **GPIO 12** | ⚠️ **Use with Caution** | Boot strapping pin (MTDI). If pulled HIGH during boot, ESP32 will fail to start (VDD_SDIO voltage selection). |
| **GPIO 4** | ❌ **FORBIDDEN** | Hardwired to the onboard high-power Flash LED. |
| **GPIO 16** | ❌ **FORBIDDEN** | Hardwired to external 4MB PSRAM chip select (`CS`). Using this will immediately crash the camera driver! |
| **GPIO 0** | ❌ **FORBIDDEN** | Camera master clock (`XCLK` @ 20MHz) and bootloader strapping pin. |
| **GPIO 1 / 3** | ⚠️ **Avoid** | Hardware UART (U0TX / U0RX) used for debugging and USB programming. |

---

## 4. Electrical Connection Schematic

### Single Servo Setup (Horizontal Pan Runway Tracking)

```
        5V 2A Power Source / MB Shield
      ┌───────────────────────────────────┐
      │                               5V  ├───────┬─────────────────── [Red: Servo VCC]
      │                                   │       │
      │                                   │     ┌─┴─┐
      │                                   │     │ + │ 100µF to 470µF
      │                                   │     │   │ Electrolytic Capacitor
      │                                   │     │ - │ (Absorbs servo motor spikes)
      │                                   │     └─┬─┘
      │                               GND ├───────┴───────┬─────────── [Brown/Black: Servo GND]
      └───────────────────────────────────┘               │
                                                          │
        AI-Thinker ESP32-CAM                              │
      ┌───────────────────────────────────┐               │
      │                               GND ├───────────────┘
      │                           GPIO 13 ├─────────────────────────── [Orange: Servo Signal (PWM)]
      │                                   │
      │ [OV2640 / OV3660 LENS]            │
      └───────────────────────────────────┘
```

### Dual-Axis Pan & Tilt Gimbal Setup

| Component | Pin on ESP32-CAM | Wire Color on Servo | Description |
|:---|:---:|:---:|:---|
| **Pan Servo (Horizontal)** | **GPIO 13** | Orange / Yellow | Horizontal rotation (0° = Left, 90° = Center, 180° = Right) |
| **Tilt Servo (Vertical)** | **GPIO 14** (or **GPIO 15**) | Orange / Yellow | Vertical pitch (0° = Horizon, 45° = Downward Runway Angle) |
| **Servo Power Rails** | **5V Pin** | Red | Direct 5V power (Must supply at least 1.5A–2.0A) |
| **Common Ground** | **GND Pin** | Brown / Black | Shared ground across ESP32 and both servos |

---

## 5. Critical Power Warning: Servo Brownouts

> [!CAUTION]
> **Why Servos Cause Camera Reboots:**
> A typical SG90 micro servo draws **~100mA while moving**, but draws **500mA to 800mA stall/surge current** the millisecond it starts moving.
> If the servo is connected to the ESP32's onboard 3.3V rail, or if your USB power adapter provides less than 1.5A, the 5V rail will briefly drop below 4.4V, causing:
> `Brownout detector was triggered` -> **ESP32 reboots in an endless loop!**

### How to Prevent Brownouts:
1. **Always use a 5V 2A power adapter** plugged into the MB shield or 5V rail.
2. **Add a 220µF – 470µF electrolytic capacitor** directly between `5V` and `GND` across the servo power wires to buffer instantaneous inductive current surges.
3. **Smooth Servo Sweeping:** In software, never jump instantly from 0° to 180°. Use incremental stepping (`delay(15ms)` between 1° increments) to eliminate mechanical current spikes.

---

## 6. Arduino Firmware Code Snippet

To control servos on the ESP32 without timer conflicts with the camera's `LEDC_TIMER_0`:

### Recommended Library:
In Arduino IDE: **Sketch -> Include Library -> Manage Libraries** -> Search and install **`ESP32Servo`** by Kevin Harrington.

```cpp
#include <ESP32Servo.h>

Servo panServo;
Servo tiltServo;

#define PAN_PIN   13
#define TILT_PIN  14

void setupServos() {
  // Allocate timers for ESP32Servo (uses timers 1, 2, or 3, leaving timer 0 for camera XCLK)
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);

  panServo.setPeriodHertz(50);    // Standard 50Hz servo PWM
  panServo.attach(PAN_PIN, 500, 2400); // 500us to 2400us pulse width

  tiltServo.setPeriodHertz(50);
  tiltServo.attach(TILT_PIN, 500, 2400);

  // Set initial home position
  panServo.write(90);  // Center forward facing walkway
  tiltServo.write(45); // Centered clinical sagittal view
}

// Function to move servo smoothly (prevents power spikes)
void setPanAngleSmooth(int targetAngle) {
  static int currentAngle = 90;
  targetAngle = constrain(targetAngle, 0, 180);
  int step = (targetAngle > currentAngle) ? 1 : -1;
  while (currentAngle != targetAngle) {
    currentAngle += step;
    panServo.write(currentAngle);
    delay(10); // Smooth 10ms movement step
  }
}
```

---

## 7. Cloud WebSocket Command Dispatcher Integration

To steer the servo remotely from the OrthoNex web dashboard, handle the command in `onMessageCallback`:

```cpp
// In onMessageCallback(WebsocketsMessage msg):
if (data.indexOf("pan") >= 0) {
  int panIndex = data.indexOf("\"pan\":");
  if (panIndex >= 0) {
    int angle = data.substring(panIndex + 6).toInt();
    setPanAngleSmooth(angle);
  }
}
```
