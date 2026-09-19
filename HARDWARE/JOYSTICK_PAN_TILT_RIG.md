# OrthoNex Joystick-Controlled Physical Tracking Rig (Way 1)

This document provides the complete wiring schematic, pin mapping, power isolation, and Arduino firmware for the **manual joystick tracking camera rig**.

---

## 1. System Architecture & Rationale

In clinical gait screening, an operator uses a physical analog joystick to smoothly pan the camera along the 4-meter walkway as the patient walks.

```
       [ OPERATOR DESK / HANDHELD ]                         [ CAMERA RIG ON TRIPOD ]
  ┌─────────────────────────────────────┐               ┌───────────────────────────────┐
  │           Single Joystick           │               │      AI-Thinker ESP32-CAM     │
  │  VCC   GND   VRx (X-Axis Analog)    │               │      (Mounted on Servo)       │
  └───┬─────┬──────┬────────────────────┘               │                               │
      │     │      │                                    │  5V & GND from L7805CV Rail   │
      ▼     ▼      ▼                                    │  Outbound TLS Stream to Cloud │
  ┌─────────────────────────────────────┐               └───────────────┬───────────────┘
  │        Arduino Nano / Uno           │                               │ Mounted onto
  │                                     │                               ▼ Servo Horn
  │  5V     GND    A0                   │               ┌───────────────────────────────┐
  │                                     │               │       SG90 Servo Motor        │
  │  Pin D9 (PWM Servo Signal)          ├──────────────>│ Orange: PWM Signal            │
  │                                     │               │ Red:    5V (from L7805CV)     │
  │                                     │               │ Black:  GND (Common)          │
  └─────────────────────────────────────┘               └───────────────────────────────┘
```

### Why this design is superior:
1. **Zero Camera Interference:** The ESP32-CAM does **only video streaming** over Wi-Fi. It has no analog reads, zero timer clashes, and zero GPIO collisions with the camera clock.
2. **True 10-bit Analog Resolution:** The Arduino Nano's onboard ADC (10-bit, 0 to 1023) reads the joystick with buttery-smooth accuracy.
3. **No Brownouts:** The servo receives high-current power from the **L7805CV + 220 µF capacitor**, completely buffered from the microcontrollers.

---

## 2. Complete Wiring Schematic

```
                            2S LiPo Battery (~7.4V)
                           ┌───────────────────────┐
                           │               (+) RED ├───[ Toggle Switch ]───┬──────────────────────────┐
                           │                       │                       │                          │
                           │             (–) BLACK ├───┬───────────────────┼──────────────────────────┼───────────────┐
                           └───────────────────────┘   │                   │                          │               │
                                                       │                   ▼                          │               │
                                                       │        ┌─────────────────────┐               │               │
                                                       │        │   L7805CV Regulator │               │               │
                                                       │        │  Pin 1: IN (+7.4V)  │               │               │
                                                       │        │  Pin 2: GND         │               │               │
                                                       │        │  Pin 3: OUT (+5.0V) │               │               │
                                                       │        └──────────┬──────────┘               │               │
                                                       │                   │                          │               │
                                                       │            [+5V Power Rail]                  │               │
                                                       │                   │                          │               │
                                                       │                 ┌─┴─┐                        │               │
                                                       │                 │ + │ 220 µF                 │               │
                                                       │                 │   │ Capacitor              │               │
                                                       │                 │ - │                        │               │
                                                       │                 └─┬─┘                        │               │
                                                       ▼                   ▼                          ▼               │
                         COMMON GND RAIL ──────────────┴───────────────────┴──────────────────────────┴───────────────┤
                                  │                                                                   │               │
           ┌──────────────────────┴──────────────────────┬────────────────────────────────────────────┤               │
           │                                             │                                            │               │
           ▼                                             ▼                                            ▼               │
┌──────────────────────────────┐              ┌──────────────────────┐                     ┌──────────────────────┐   │
│     AI-Thinker ESP32-CAM     │              │   SG90 Servo Motor   │                     │  Arduino Nano / Uno  │   │
│                              │              │                      │                     │                      │   │
│ 5V Pin  ◄────────────────────┼──────────────┤ RED   (from 5V Rail) │                     │ VIN (from Switch +)  │◄──┘
│ GND Pin ◄────────────────────┤              │ BLACK (Common GND)   │◄────────────────────┤ GND (Common GND)     │
│                              │              │                      │                     │                      │
│ [OV3660 / OV2640 CAMERA]     │              │ ORANGE (PWM Signal)  │◄────────────────────┤ Pin D9 (Servo PWM)   │
│ (Streams live video)         │              └──────────────────────┘                     │                      │
└──────────────────────────────┘                                                           │ Pin A0 (VRx Input)   │◄──┐
                                                                                           │ 5V Out               │──┐│
                                                                                           │ GND                  │─┐││
                                                                                           └──────────────────────┘ │││
                                                                                                                    │││
                                                                                           ┌──────────────────────┐ │││
                                                                                           │   Single Joystick    │ │││
                                                                                           │                      │ │││
                                                                                           │ VCC                  │◄─┘│
                                                                                           │ GND                  │◄──┘
                                                                                           │ VRx (X-Axis)         │───┘
                                                                                           │ VRy (Not used / opt) │
                                                                                           │ SW  (Not used)       │
                                                                                           └──────────────────────┘
```

---

## 3. Pin Connection Tables

### A. Power Section
| From Component | Pin | To Component | Pin | Notes |
|:---|:---:|:---|:---:|:---|
| **2S LiPo Battery** | (+) Red | **Toggle Switch** | Pin 1 | Main raw power (+7.4V) |
| **Toggle Switch** | Pin 2 | **L7805CV** | Pin 1 (IN) | Switched 7.4V input |
| **Toggle Switch** | Pin 2 | **Arduino Nano** | **VIN Pin** | Nano has onboard 5V regulator |
| **2S LiPo Battery** | (–) Black | **Common GND Rail** | GND | Ground bus for all parts |
| **L7805CV** | Pin 2 (GND) | **Common GND Rail** | GND | |
| **L7805CV** | Pin 3 (OUT) | **+5V Power Rail** | +5V | Clean regulated 5.00V |
| **220 µF Capacitor** | (+) Long leg | **+5V Power Rail** | +5V | Buffers servo motor surges |
| **220 µF Capacitor** | (–) Short leg | **Common GND Rail** | GND | Side marked with stripe |

### B. ESP32-CAM (Camera Video Unit)
| ESP32-CAM Pin | Connect To | Notes |
|:---:|:---|:---|
| **5V** | **+5V Power Rail** (L7805CV) | Powers camera board |
| **GND** | **Common GND Rail** | Ground |
| **IO0** | *Leave completely disconnected* | Must float for normal boot |

### C. SG90 Servo (Gimbal Actuator)
| Servo Wire Color | Connect To | Notes |
|:---:|:---|:---|
| 🔴 **Red** | **+5V Power Rail** (L7805CV) | Motor power from 5V rail |
| 🟤 / ⚫ **Brown / Black** | **Common GND Rail** | Motor ground |
| 🟠 / 🟡 **Orange / Yellow** | **Arduino Nano Pin D9** | PWM control signal |

### D. Single Joystick (Operator Controller)
| Joystick Pin | Connect To | Notes |
|:---:|:---|:---|
| **VCC** | **Arduino Nano 5V Pin** | Logic reference voltage |
| **GND** | **Arduino Nano GND Pin** | Ground reference |
| **VRx** | **Arduino Nano Pin A0** | Analog horizontal axis |
| **VRy** | *Optional / Unconnected* | For 2nd tilt servo if added |
| **SW** | *Unconnected* | Pushbutton switch |

---

## 4. Arduino Nano Firmware

You have two control mode choices in this sketch:
- **Mode 1 (Proportional):** Tilting the joystick left tilts the camera left; letting go returns to center (90°).
- **Mode 2 (Slew / Pan & Hold - Recommended for Gait Tracking):** Pushing the joystick left rotates the camera left; when you let go, **the camera stays at that angle** so you don't have to hold tension on the stick!

```cpp
#include <Servo.h>

Servo panServo;

const int JOY_PIN = A0;     // Analog input from Joystick VRx
const int SERVO_PIN = 9;    // Digital PWM output to SG90

// Set to true for Pan & Hold (smooth tracking); false for Direct angle mapping
const bool PAN_AND_HOLD_MODE = true; 

float currentAngle = 90.0;  // Start centered (90 degrees)

void setup() {
  Serial.begin(115200);
  panServo.attach(SERVO_PIN, 544, 2400); // Standard SG90 micro-servo range
  panServo.write((int)currentAngle);
  delay(500);
}

void loop() {
  int joyVal = analogRead(JOY_PIN); // 0 (Left) to 512 (Center) to 1023 (Right)

  if (PAN_AND_HOLD_MODE) {
    // Mode 2: Deadzone in center (480 - 540)
    int offset = joyVal - 512;
    if (abs(offset) > 30) {
      // Calculate smooth rotational speed based on how far stick is pushed
      float speed = (float)offset / 350.0; // Adjustable speed factor
      currentAngle += speed;
      currentAngle = constrain(currentAngle, 10.0, 170.0); // Safe servo travel limits
      panServo.write((int)currentAngle);
    }
    delay(20); // 50Hz update loop
  } 
  else {
    // Mode 1: Direct 1-to-1 angle mapping
    int targetAngle = map(joyVal, 0, 1023, 10, 170);
    panServo.write(targetAngle);
    delay(15);
  }
}
```
