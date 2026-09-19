# ESP32-CAM Bill of Materials (BOM) & Electrical Specs

This document specifies the technical and electrical characteristics of all hardware components utilized in the OrthoNex Tele-Screening capture unit.

---

## 1. Module Technical Specifications

### AI-Thinker ESP32-CAM
| Parameter | Specification |
|:----------|:--------------|
| **Core Processor** | Tensilica Xtensa® 32-bit LX6 dual-core @ up to 240 MHz |
| **SRAM** | 520 KB Internal SRAM |
| **External PSRAM** | 4 MB Pseudo-Static RAM (enables high-res multi-buffering) |
| **Flash Memory** | 4 MB SPI Flash (Partitioned: 3MB No OTA / 1MB SPIFFS) |
| **Wi-Fi Protocol** | 802.11 b/g/n (802.11n up to 150 Mbps, 2.4 GHz only) |
| **Bluetooth** | BLE 4.2 BR/EDR (Disabled in firmware to maximize Wi-Fi RAM) |
| **Antenna** | Onboard PCB trace antenna + IPEX / U.FL connector for external antenna |
| **Dimensions** | 27 mm × 40.5 mm × 4.5 mm |
| **Weight** | ~10 grams |

### Omnivision OV2640 Image Sensor
| Parameter | Specification |
|:----------|:--------------|
| **Array Size** | UXGA 1600 × 1200 (2.0 Megapixel) |
| **Optical Format** | 1/4 inch |
| **Default Screening Resolution**| QVGA (320 × 240) / CIF (400 × 296) for cloud streaming |
| **Lens Focal Length** | 3.6 mm |
| **Field of View (FOV)** | Standard: 66° (Wide-angle variant: 120° or 160°) |
| **Shutter Type** | Electronic Rolling Shutter (ERS) |
| **Output Formats** | YUV422, RGB565, Raw RGB, Compressed JPEG |

### ESP32-CAM-MB Programmer Shield
| Parameter | Specification |
|:----------|:--------------|
| **USB-UART Controller** | WCH CH340G |
| **Connector** | Micro-USB Type-B Female |
| **Logic Level** | Auto 3.3V / 5V level conversion |
| **Auto-Programming** | Integrated NPN dual-transistor circuit controlling EN and GPIO 0 |
| **Onboard Buttons** | `RST` (Hardware Reset) and `IO0` (Bootloader Pull-down) |

---

## 2. Power Consumption & Electrical Characteristics

| Operating State | Typical Voltage | Current Draw (Average) | Peak Current (Bursts) | Power Consumption |
|:---|:---:|:---:|:---:|:---:|
| **Idle (Wi-Fi Connected, Camera off)** | 5.0 V | ~80 mA | 120 mA | ~0.40 W |
| **Video Streaming (QVGA @ 15 FPS)** | 5.0 V | ~180 mA | 240 mA | ~0.90 W |
| **Video Streaming + Flash LED (GPIO 4)** | 5.0 V | ~310 mA | 420 mA | ~1.55 W |
| **Wi-Fi Transmission Burst Peak** | 5.0 V | — | **up to 450 mA** | ~2.25 W (Transient) |

> [!CAUTION]
> **Power Supply Sizing:** Always use a power supply capable of supplying at least **1.5 A continuous current**. Standard PC USB 2.0 ports (limited to 500 mA) may occasionally cause brownouts during Flash LED activation or Wi-Fi TX bursts.

---

## 3. Bill of Materials (BOM) & Estimated Costs

| Item # | Component | Manufacturer / Part # | Typical Cost (INR) | Purpose |
|:------:|:----------|:---------------------:|:------------------:|:--------|
| **1** | ESP32-CAM + OV2640 Module + MB Shield Bundle | AI-Thinker / Robocraze / Robu | ₹450 – ₹650 | Core camera & streaming unit with USB programmer |
| **2** | Micro-USB Data Cable (1.0m to 1.5m) | Standard 28/24 AWG | ₹80 – ₹120 | Power supply & serial data connection |
| **3** | Mini Tripod / Phone Mount with 1/4" screw | Generic Mini Tripod | ₹150 – ₹250 | Stable sagittal camera positioning at 0.9m height |
| **4** | USB 5V 2A Regulated Wall Adapter | Generic BIS-certified adapter | ₹150 – ₹200 | Clean DC power rail |
| **Total** | **Complete Hardware Kit** | | **~₹830 – ₹1,220 (~$10–$14 USD)** | **Affordable, accessible clinical screening kit** |
