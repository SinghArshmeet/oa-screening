# ESP32-CAM I2C OLED Display Integration (SSD1306 0.96")

This document details how to connect an I2C OLED display (0.96" SSD1306 / 128×64) to the standalone AI-Thinker ESP32-CAM module alongside the Pan/Tilt servo motor for live clinical status monitoring.

---

## 1. Purpose of the OLED Display in OrthoNex

When the ESP32-CAM is deployed untethered on a tripod (without a computer or serial monitor attached), the OLED screen provides instant real-time clinical telemetry:
1. **Wi-Fi Connection Status & Signal Strength (RSSI)**
2. **Assigned IP Address** (e.g., `192.168.1.45`)
3. **Cloud WebSocket Status** (`CONNECTED` / `STREAMING` / `RETRYING`)
4. **Live Video Streaming FPS** (Frames Per Second)
5. **Servo Pan Angle** (e.g., `Pan: 90°`)

---

## 2. OLED Display Pinout (4-Pin I2C SSD1306)

Standard 0.96-inch monochrome OLED displays use a 4-pin I2C header:

| OLED Pin | Description | Connect to ESP32-CAM / Power Rail |
|:---:|:---|:---|
| **GND** | Power Ground | Common **GND** |
| **VCC** | Power Supply (3.3V – 5.0V) | **3V3 Pin** or **5V Pin** |
| **SCL** | I2C Serial Clock | **GPIO 14** |
| **SDA** | I2C Serial Data | **GPIO 15** |

---

## 3. Coexistence with Servo Motor on ESP32-CAM

Because the camera sensor and PSRAM occupy most pins, this pin mapping allows the Camera, Servo, and OLED to run simultaneously without any hardware conflict:

| Peripheral | Function | Target GPIO on ESP32-CAM |
|:---|:---|:---:|
| **Servo Motor (SG90 / MG90S)** | Pan Control (PWM) | **GPIO 13** |
| **OLED Display (SSD1306)** | I2C SCL (Clock) | **GPIO 14** |
| **OLED Display (SSD1306)** | I2C SDA (Data) | **GPIO 15** |
| **Flash Light** | Onboard SMD LED | **GPIO 4** (Internal) |
| **External PSRAM** | 4MB High-Speed Framebuffer | **GPIO 16** (Internal - Do Not Touch) |
| **Camera Clock** | 20MHz Master Clock | **GPIO 0** (Do Not Touch) |

---

## 4. Full Electrical Wiring Schematic

```
                          5V 2A POWER SUPPLY / REGULATOR
                       ┌──────────────────────────────────┐
                       │                              5V  ├───┬─────────────┬─────────── [Red: Servo VCC]
                       │                                  │   │             │
                       │                                  │ ┌─┴─┐           ├─────────── [VCC: OLED Display (3.3V or 5V)]
                       │                                  │ │ + │ 220µF     │
                       │                                  │ │   │ Buffer    │
                       │                                  │ │ - │ Capacitor │
                       │                                  │ └─┬─┘           │
                       │                              GND ├───┴─────────────┴───┬─────── [Black: Servo GND]
                       └──────────────────────────────────┘                     │
                                                                                ├─────── [GND: OLED Display]
                       AI-THINKER ESP32-CAM                                     │
                       ┌──────────────────────────────────┐                     │
                       │                              5V  │◄────────────────────┤ (From 5V Rail)
                       │                              GND ├─────────────────────┘
                       │                                  │
                       │                          GPIO 13 ├───────────────────────────── [Orange: Servo PWM]
                       │                          GPIO 14 ├───────────────────────────── [SCL: OLED Clock]
                       │                          GPIO 15 ├───────────────────────────── [SDA: OLED Data]
                       │                                  │
                       │ [OV2640 CAMERA LENS]             │
                       └──────────────────────────────────┘
```

---

## 5. Arduino Firmware Integration

In Arduino IDE, install:
- **`Adafruit SSD1306`** by Adafruit
- **`Adafruit GFX Library`** by Adafruit

### Code Setup:

```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C // Standard I2C address for SSD1306

// Define custom I2C pins for ESP32-CAM
#define I2C_SDA 15
#define I2C_SCL 14

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setupOLED() {
  // Initialize I2C on GPIO 15 (SDA) and GPIO 14 (SCL)
  Wire.begin(I2C_SDA, I2C_SCL, 400000); // 400kHz fast I2C mode

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("SSD1306 OLED allocation failed");
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("ORTHONEX CLINICAL");
  display.println("Gait Screening Cam");
  display.println("Initializing...");
  display.display();
}

void updateOLEDStatus(const char* ip, const char* wsStatus, int fps, int panAngle) {
  display.clearDisplay();
  
  // Header
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("== ORTHONEX HUD ==");
  
  // Telemetry Rows
  display.setCursor(0, 16);
  display.printf("IP:  %s\n", ip);
  display.setCursor(0, 28);
  display.printf("WSS: %s\n", wsStatus);
  display.setCursor(0, 40);
  display.printf("FPS: %d  Pan: %d deg\n", fps, panAngle);
  
  display.display();
}
```
