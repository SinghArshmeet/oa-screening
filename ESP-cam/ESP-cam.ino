/**
 * OrthoNex India — ESP32-CAM Cloud WebSocket Relay v3.0
 * 
 * Configured with User-Calibrated Zero-Lag OV3660 Presets:
 * - Clock (XCLK): 12 MHz
 * - Frame Size:   QVGA (320x240)
 * - JPEG Quality: 10 (High quality, low latency)
 * - Brightness:   +1
 * - Contrast:     +1
 * - Saturation:    0
 * - Sharpness:     0
 * - De-Noise:      2
 * - AWB:          Enabled (Advanced)
 * - AEC & AGC:    Enabled
 * - Gamma & Lenc: Enabled
 * - V-Flip:       ON (True orientation)
 * - H-Mirror:     OFF
 * - Flash LED:    ON (Toggleable live from web HUD)
 * 
 * Streams live directly to OrthoNex Cloud Backend:
 * wss://oa-ner-screening.onrender.com/api/esp/ws/camera
 */

#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include <ArduinoWebsockets.h>

using namespace websockets;

// ==========================================
// 1. Wi-Fi Credentials
// ==========================================
const char *ssid     = "SEXY_PAAJI_KA_WIFI";
const char *password = "703sexypaajiskira";

// ==========================================
// 2. Cloud Server Settings (Render Backend)
// ==========================================
const char *ws_server_url = "wss://oa-ner-screening.onrender.com/api/esp/ws/camera";

// ==========================================
// 3. AI-Thinker Camera Pins
// ==========================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5

#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#define LED_GPIO_NUM       4 // Onboard High-Power Flash LED

// ==========================================
// 4. Runtime State & Objects
// ==========================================
WebsocketsClient client;
unsigned long lastFrameTime = 0;
const int TARGET_FRAME_DELAY_MS = 33; // Target ~30 FPS zero-lag streaming
bool flashState = true;               // Default Flash ON as calibrated

void setFlash(bool state) {
  flashState = state;
  digitalWrite(LED_GPIO_NUM, state ? HIGH : LOW);
  Serial.printf("[ESP-CAM] Flash LED: %s\n", state ? "ON" : "OFF");
}

void initCameraWithPresets() {
  // Hard power-cycle the camera sensor to clear any I2C bus lockup
  pinMode(PWDN_GPIO_NUM, OUTPUT);
  digitalWrite(PWDN_GPIO_NUM, HIGH); // Power DOWN
  delay(200);
  digitalWrite(PWDN_GPIO_NUM, LOW);  // Power UP
  delay(200);

  // Clear I2C bus lines
  pinMode(SIOC_GPIO_NUM, OUTPUT);
  pinMode(SIOD_GPIO_NUM, INPUT_PULLUP);
  for (int i = 0; i < 9; i++) {
    digitalWrite(SIOC_GPIO_NUM, HIGH);
    delayMicroseconds(10);
    digitalWrite(SIOC_GPIO_NUM, LOW);
    delayMicroseconds(10);
  }
  delay(50);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 16000000; // 16 MHz clock for fast, crisp video readout
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;  // Calibrated 640x480 (4x sharper than QVGA)
  config.jpeg_quality = 10;             // High clarity (eliminates pixelation)
  config.fb_count     = 2;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  Serial.println("[ESP-CAM] Initializing OV3660 sensor with custom presets...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ESP-CAM] Init failed at 16MHz (0x%x). Retrying at 12MHz...\n", err);
    config.xclk_freq_hz = 12000000;
    err = esp_camera_init(&config);
  }

  if (err != ESP_OK) {
    Serial.printf("[ESP-CAM] FATAL: Camera init failed: 0x%x\n", err);
    delay(2000);
    ESP.restart();
  }

  // ==========================================
  // Apply User-Calibrated Sensor Tuning
  // ==========================================
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_framesize(s, FRAMESIZE_VGA); // 640x480 (Crisp & non-pixelated)
    s->set_quality(s, 10);              // High quality
    s->set_brightness(s, 1);            // Brightness +1
    s->set_contrast(s, 1);              // Contrast +1
    s->set_saturation(s, 0);            // Saturation 0
    s->set_sharpness(s, 0);             // Sharpness 0
    s->set_denoise(s, 2);               // De-noise
    s->set_ae_level(s, 0);              // Exposure level 0
    s->set_gainceiling(s, (gainceiling_t)0); // Gainceiling 0
    s->set_special_effect(s, 0);        // No effect
    s->set_whitebal(s, 1);              // AWB enabled
    s->set_dcw(s, 1);                   // Advanced AWB enabled
    s->set_awb_gain(s, 0);              // Manual AWB off
    s->set_exposure_ctrl(s, 1);         // AEC enabled
    s->set_gain_ctrl(s, 1);             // AGC enabled
    s->set_raw_gma(s, 1);               // GMA enabled
    s->set_lenc(s, 1);                  // Lens correction enabled
    s->set_hmirror(s, 0);               // H-Mirror OFF
    s->set_vflip(s, 1);                 // V-Flip ON

    Serial.println("[ESP-CAM] All custom presets successfully applied to sensor!");
  }
}

// ==========================================
// 5. Cloud WebSocket Callbacks
// ==========================================
void onMessageCallback(WebsocketsMessage msg) {
  String data = msg.data();
  Serial.print("[Cloud Command]: ");
  Serial.println(data);

  sensor_t *s = esp_camera_sensor_get();

  // Flash LED toggle
  if (data.indexOf("flash") >= 0) {
    if (data.indexOf("\"val\":1") >= 0 || data.indexOf("\"flash\":1") >= 0 || data.indexOf("true") >= 0) {
      setFlash(true);
    } else if (data.indexOf("\"val\":0") >= 0 || data.indexOf("\"flash\":0") >= 0 || data.indexOf("false") >= 0) {
      setFlash(false);
    }
  }

  // Live Resolution adjustment
  if (s != NULL && data.indexOf("framesize") >= 0) {
    if (data.indexOf("QVGA") >= 0 || data.indexOf("\"val\":5") >= 0) {
      s->set_framesize(s, FRAMESIZE_QVGA);
    } else if (data.indexOf("CIF") >= 0 || data.indexOf("\"val\":6") >= 0) {
      s->set_framesize(s, FRAMESIZE_CIF);
    } else if (data.indexOf("VGA") >= 0 || data.indexOf("\"val\":8") >= 0) {
      s->set_framesize(s, FRAMESIZE_VGA);
    } else if (data.indexOf("SVGA") >= 0 || data.indexOf("\"val\":9") >= 0) {
      s->set_framesize(s, FRAMESIZE_SVGA);
    } else if (data.indexOf("HD") >= 0 || data.indexOf("\"val\":11") >= 0) {
      s->set_framesize(s, FRAMESIZE_HD);
    }
  }

  // Live V-Flip adjustment
  if (s != NULL && data.indexOf("vflip") >= 0) {
    s->set_vflip(s, data.indexOf("\"val\":1") >= 0 ? 1 : 0);
  }

  // Live H-Mirror adjustment
  if (s != NULL && data.indexOf("hmirror") >= 0) {
    s->set_hmirror(s, data.indexOf("\"val\":1") >= 0 ? 1 : 0);
  }
}

void onEventsCallback(WebsocketsEvent event, String data) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("\n*************************************************************");
    Serial.println("  >>> CLOUD WEBSOCKET CONNECTED WITH CUSTOM PRESETS! <<<     ");
    Serial.println("*************************************************************\n");
    // Visual confirmation blink
    setFlash(false);
    delay(100);
    setFlash(true);
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("[ESP-CAM] WebSocket Connection Closed.");
  } else if (event == WebsocketsEvent::GotPing) {
    client.pong();
  }
}

void connectToCloud() {
  Serial.println("[ESP-CAM] Connecting to Cloud WebSocket Relay...");
  Serial.print("[ESP-CAM] URL: ");
  Serial.println(ws_server_url);

  client.setInsecure(); // Bypass TLS cert verification
  client.onMessage(onMessageCallback);
  client.onEvent(onEventsCallback);

  bool connected = client.connect(ws_server_url);
  if (connected) {
    Serial.println("[ESP-CAM] Handshake complete, zero-lag streaming active!");
  } else {
    Serial.println("[ESP-CAM] Connection failed. Retrying in 3 seconds...");
  }
}

// ==========================================
// 6. Setup & Main Loop
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=======================================================");
  Serial.println("  OrthoNex India — ESP32-CAM Zero-Lag Cloud Relay v3   ");
  Serial.println("=======================================================");

  // Setup Flash LED (starts ON as per user preset)
  pinMode(LED_GPIO_NUM, OUTPUT);
  setFlash(true);

  // Initialize Camera with custom presets
  initCameraWithPresets();

  // Connect to Wi-Fi
  Serial.printf("[ESP-CAM] Connecting to Wi-Fi: %s", ssid);
  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // Disable Wi-Fi sleep for lowest transmission latency

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }

  Serial.println("\n[ESP-CAM] Wi-Fi connected successfully!");
  Serial.print("[ESP-CAM] IP Address: ");
  Serial.println(WiFi.localIP());

  // Connect to Cloud Relay
  connectToCloud();
}

void loop() {
  // Maintain WebSocket heartbeat and process cloud commands
  if (client.available()) {
    client.poll();
  } else {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 3000) {
      lastReconnect = millis();
      Serial.println("[ESP-CAM] Reconnecting to Cloud WebSocket...");
      client.connect(ws_server_url);
    }
    return;
  }

  // Stream frames at calibrated target rate (~30 FPS)
  unsigned long now = millis();
  if (now - lastFrameTime >= TARGET_FRAME_DELAY_MS) {
    lastFrameTime = now;

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[ESP-CAM] Frame capture failed");
      return;
    }

    // Send binary JPEG frame directly over WebSocket
    if (client.available()) {
      client.sendBinary((const char *)fb->buf, fb->len);
    }

    esp_camera_fb_return(fb);
  }
}