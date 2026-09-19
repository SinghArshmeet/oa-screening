# ESP32-CAM Technical Pinout & Multiplexing Reference

The AI-Thinker ESP32-CAM has 16 exposed header pins. Because the ESP32-S chip connects internally to the **OV2640 camera**, **4MB external PSRAM**, and **Micro-SD card socket**, many GPIO pins are multiplexed.

---

## 1. Complete Header Pinout Table

| Header Pin | Pin Label | Primary Function in OrthoNex | Internal Shared Connection | Usable for External Peripherals? |
|:----------:|:---------:|:----------------------------:|:--------------------------:|:--------------------------------:|
| **1**      | **5V**    | 5V DC Power Input (Main Rail)| Direct to AMS1117-3.3 LDO  | **Power Input Only** |
| **2**      | **GND**   | System Ground                | PCB Ground Plane           | **Ground Only** |
| **3**      | **U0R**   | Serial RX (Debug / Flash)    | GPIO 3 (UART0 RX)          | Yes (after flashing / boot) |
| **4**      | **U0T**   | Serial TX (Debug / Flash)    | GPIO 1 (UART0 TX)          | Yes (after flashing / boot) |
| **5**      | **GPIO 4**| Onboard High-Power Flash LED | S8050 NPN Transistor Base  | **Dedicated to Flash LED** |
| **6**      | **GPIO 2**| Internal Boot Strapping      | HS2_DATA0 (SD Card)        | No (tied to SD/boot) |
| **7**      | **GPIO 14**| High Speed SD Card Bus      | HS2_CLK (SD Card)          | No (reserved for SD / internal) |
| **8**      | **GPIO 15**| High Speed SD Card Bus      | HS2_CMD (SD Card)          | No (reserved for SD / internal) |
| **9**      | **GPIO 13**| High Speed SD Card Bus      | HS2_DATA2 (SD Card)        | No (reserved for SD / internal) |
| **10**     | **GPIO 12**| High Speed SD Card Bus      | HS2_DATA1 (SD Card)        | No (reserved for SD / internal) |
| **11**     | **GPIO 4** | Duplicate Flash LED pin     | Tied to Pin 5              | No |
| **12**     | **GPIO 2** | Duplicate SD Data0 pin      | Tied to Pin 6              | No |
| **13**     | **GND**    | System Ground               | PCB Ground Plane           | **Ground Only** |
| **14**     | **GPIO 0** | Bootloader Strapping Pin    | High = Run, Low = Flash    | **Must be LOW to program** |
| **15**     | **GPIO 16**| External PSRAM CS           | AP_3216 4MB SPI PSRAM      | **Do NOT use (Crashes PSRAM)** |
| **16**     | **3V3**    | 3.3V Regulated Output Rail  | Output of AMS1117-3.3      | Max 100mA auxiliary output |

---

## 2. Internal Camera Bus Connections (OV2640 DVP)

These pins are wired directly from the ESP32-S SoC to the 24-pin FPC camera connector. **They cannot be used for any other purpose:**

| Camera Signal | ESP32 GPIO | Description |
|:-------------:|:----------:|:------------|
| **Y2 (D0)**   | GPIO 5     | Camera 8-bit Data Bus Bit 0 |
| **Y3 (D1)**   | GPIO 18    | Camera 8-bit Data Bus Bit 1 |
| **Y4 (D2)**   | GPIO 19    | Camera 8-bit Data Bus Bit 2 |
| **Y5 (D3)**   | GPIO 21    | Camera 8-bit Data Bus Bit 3 |
| **Y6 (D4)**   | GPIO 36    | Camera 8-bit Data Bus Bit 4 |
| **Y7 (D5)**   | GPIO 39    | Camera 8-bit Data Bus Bit 5 |
| **Y8 (D6)**   | GPIO 34    | Camera 8-bit Data Bus Bit 6 |
| **Y9 (D7)**   | GPIO 35    | Camera 8-bit Data Bus Bit 7 |
| **XCLK**      | GPIO 0     | Camera External Master Clock (20MHz) |
| **PCLK**      | GPIO 22    | Pixel Clock |
| **VSYNC**     | GPIO 25    | Vertical Sync (Frame Boundary) |
| **HREF**      | GPIO 23    | Horizontal Reference (Line Boundary) |
| **SIOD**      | GPIO 26    | SCCB (I2C) Serial Data |
| **SIOC**      | GPIO 27    | SCCB (I2C) Serial Clock |
| **PWDN**      | GPIO 32    | Power Down Control (Active High) |
| **RESET**     | -1 (NC)    | Hardwired to 3.3V rail |

---

## 3. Onboard Actuators & LEDs

| Component | Control GPIO | Logic Level | Hardware Circuitry |
|:---------:|:------------:|:-----------:|:-------------------|
| **Flash Light** | **GPIO 4** | Active HIGH (`HIGH` = ON, `LOW` = OFF) | Driven via S8050 NPN transistor switch with flyback resistor. Draws ~150mA when fully on. |
| **Status LED** | **GPIO 33** | Inverted (`LOW` = ON, `HIGH` = OFF) | Tiny SMD red LED on the backside of the module. Useful as a visual heartbeat/connection indicator. |

---

## 4. Boot Mode Selection (Strapping Pins)

| Mode | GPIO 0 State | Behavior on Reset |
|:-----|:------------:|:------------------|
| **Flashing / Download Boot** | `0` (GND) | ESP32 ROM bootloader awaits firmware via UART0 (U0R/U0T). |
| **Normal SPI Flash Boot** | `1` (Floating / 3.3V via internal pullup) | Module boots firmware stored in onboard SPI Flash memory and starts OrthoNex Cloud Relay. |
