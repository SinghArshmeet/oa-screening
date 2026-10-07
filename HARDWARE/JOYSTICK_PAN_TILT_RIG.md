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
  │  Pin D10 (PWM Servo Signal)         ├──────────────>│ Yellow / Orange: PWM Signal   │
  │                                     │               │ Red:    5V (from L7805CV)     │
  │                                     │               │ Brown / Black: GND (Common)   │
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
│ [OV3660 / OV2640 CAMERA]     │              │ YELLOW/ORANGE (PWM)  │◄────────────────────┤ Pin D10 (Servo PWM)  │
│ (Streams live video)         │              └──────────────────────┘                     │                      │
└──────────────────────────────┘                                                           │ Pin A0 (Pot Wiper)   │◄──┐
                                                                                           │ 5V Out               │──┐│
                                                                                           │ GND                  │─┐││
                                                                                           └──────────────────────┘ │││
                                                                                                                    │││
                                                                                           ┌──────────────────────┐ │││
                                                                                           │  B10k Potentiometer  │ │││
                                                                                           │                      │ │││
                                                                                           │ Leg 3 (+5V)          │◄─┘│
                                                                                           │ Leg 1 (GND)          │◄──┘
                                                                                           │ Leg 2 (Center Wiper) │───┘
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

### B. Arduino Nano Connections (Confirmed Working Setup)
| Arduino Nano Pin | Connect To | Function |
|:---:|:---|:---|
| **`5V` Pin** | **+5V Breadboard Rail** (from L7805CV) | Powers the Nano directly from regulated 5V |
| **`GND` Pin** | **Common GND Breadboard Rail** | **CRITICAL:** Must be on GND rail for common ground return |
| **`A0` Pin** | **Potentiometer Center Leg (Leg 2)** | Analog steering wiper signal (0 - 1023) |
| **`D10` Pin** | **SG90 Servo YELLOW / ORANGE Wire** | High-speed 50Hz PWM servo signal |

### C. B10k Potentiometer (Manual Steering Knob)
| Potentiometer Leg | Connect To | Notes |
|:---:|:---|:---|
| **Leg 1 (Outer Left)** | **Common GND Rail** | Ground reference |
| **Leg 2 (CENTER LEG)** | **Arduino Nano `A0` Pin** | Variable 0.0V - 5.00V steering voltage |
| **Leg 3 (Outer Right)** | **+5V Power Rail** | High reference (+5V) |

### D. SG90 Servo Motor
| Servo Wire Color | Connect To | Notes |
|:---:|:---|:---|
| 🔴 **Red Wire** | **+5V Breadboard Rail** | Motor power (buffered by 220µF cap) |
| 🟤 / ⚫ **Brown or Black Wire** | **Common GND Breadboard Rail** | Motor ground return |
| 🟡 / 🟠 **Yellow or Orange Wire** | **Arduino Nano `D10` Pin** | 50Hz PWM position signal (Pin D10) |

### E. AI-Thinker ESP32-CAM (Untethered Video Streaming)
| ESP32-CAM Pin | Connect To | Notes |
|:---:|:---|:---|
| **`5V` Pin** | **+5V Breadboard Rail** | Powers camera module & Wi-Fi via onboard AMS1117-3.3V |
| **`GND` Pin** | **Common GND Breadboard Rail** | Common ground |
| **`IO0` Pin** | **Leave Disconnected (Floating)** | Required for normal standalone boot |
| **`3V3` Pin** | **DO NOT CONNECT (Leave Empty)** | ⚠️ **NEVER connect 5V to 3V3!** Doing so bypasses the regulator and causes severe overheating. |

---

## 4. Arduino Nano Firmware (Potentiometer Direct Mapping)

This firmware reads the manual B10k potentiometer dial on analog pin `A0` and smoothly commands the SG90 pan servo on digital pin `D10`.

```cpp
#include <Servo.h>

Servo panServo;

// --- Pin Assignments ---
const int POT_PIN   = A0;  // Potentiometer Center Leg (Wiper) -> Pin A0
const int SERVO_PIN = 10;  // Servo Signal (Yellow / Orange Wire) -> Pin D10 (Confirmed Working)

void setup() {
  Serial.begin(115200);
  
  // Attach SG90 servo on Pin 10 with standard pulse bounds (544us - 2400us)
  panServo.attach(SERVO_PIN, 544, 2400);

  Serial.println("==========================================");
  Serial.println("  OrthoNex Potentiometer Servo Tracking   ");
  Serial.println("==========================================");
}

void loop() {
  // 1. Read the 10-bit analog voltage from the potentiometer (0 to 1023)
  int potVal = analogRead(POT_PIN);

  // 2. Map the potentiometer to smooth servo angles (10 to 170 degrees)
  // (Leaving 10 deg buffer on ends prevents the gears from hitting hard stops)
  int targetAngle = map(potVal, 0, 1023, 10, 170);

  // 3. Write position to servo
  panServo.write(targetAngle);

  // 4. Output to Serial Monitor for live verification (115200 baud)
  Serial.print("Pot ADC (A0): ");
  Serial.print(potVal);
  Serial.print("  -->  Servo Angle (D10): ");
  Serial.print(targetAngle);
  Serial.println(" deg");

  delay(20); // 50Hz update rate
}
```
