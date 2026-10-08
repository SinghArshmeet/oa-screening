/**
 * OrthoNex India — ESP32-CAM Crisp Cloud Relay (VGA 640x480)
 * 
 * Streams live camera frames directly to the cloud backend on Render:
 * wss://oa-ner-screening.onrender.com/api/esp/ws/camera
 * 
 * Target Website: https://orthonex.vercel.app/#gait
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include "esp_camera.h"
#include <ArduinoWebsockets.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

using namespace websockets;

// ============================================================================
// 1. Wi-Fi Multi-Network Setup (Auto-Switching)
// Configure your primary and backup Wi-Fi credentials below.
// The ESP32-CAM will scan and connect to whichever network is available.
// NOTE: For mobile hotspots, ensure your phone's hotspot is set to 2.4 GHz!
// ============================================================================
WiFiMulti wifiMulti;

void setupWiFiNetworks() {
  // Primary: User Wi-Fi network (Configure with your local Wi-Fi SSID and Password)
  wifiMulti.addAP("YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD");
}

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

WebsocketsClient client;
unsigned long lastFrameTime = 0;
const int TARGET_FRAME_DELAY_MS = 40; // Silky ~25 FPS low-latency stream
bool flashState = false;

void setFlash(bool state) {
  flashState = state;
  digitalWrite(LED_GPIO_NUM, state ? HIGH : LOW);
  Serial.printf("[ESP-CAM] Flash LED: %s\n", state ? "ON" : "OFF");
}

void initCamera() {
  camera_config_t config;
  memset(&config, 0, sizeof(camera_config_t)); // Safe zero-initialization

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
  config.xclk_freq_hz = 10000000; // 10MHz prevents I2C / SCCB timeout
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count     = 1;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  Serial.println("[ESP-CAM] Initializing camera driver...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ESP-CAM] Camera init failed: 0x%x\n", err);
    delay(2000);
    ESP.restart();
  }

  Serial.println("[ESP-CAM] Camera initialized successfully!");
}

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
  if (s != NULL && data.indexOf("vflip") >= 0 && s->set_vflip) {
    s->set_vflip(s, data.indexOf("\"val\":1") >= 0 ? 1 : 0);
  }

  // Live H-Mirror adjustment
  if (s != NULL && data.indexOf("hmirror") >= 0 && s->set_hmirror) {
    s->set_hmirror(s, data.indexOf("\"val\":1") >= 0 ? 1 : 0);
  }
}

void onEventsCallback(WebsocketsEvent event, String data) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("\n***************************************************");
    Serial.println("  >>> CLOUD WEBSOCKET CONNECTED SUCCESSFULLY! <<<  ");
    Serial.println("***************************************************\n");
    // Quick blink to confirm cloud connection
    setFlash(true);
    delay(200);
    setFlash(false);
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("[ESP-CAM] Cloud WebSocket Connection Closed");
  }
}

void connectToCloud() {
  Serial.println("[ESP-CAM] Connecting to Cloud WebSocket Relay...");
  Serial.print("[ESP-CAM] URL: ");
  Serial.println(ws_server_url);

  client.setInsecure();
  client.onMessage(onMessageCallback);
  client.onEvent(onEventsCallback);

  // Connect over SSL (WSS)
  bool connected = client.connect(ws_server_url);
  if (connected) {
    Serial.println("[ESP-CAM] Handshake complete, streaming active!");
  } else {
    Serial.println("[ESP-CAM] Connection failed. Retrying in 3 seconds (Render may be spinning up)...");
  }
}

void setup() {
  // Disable brownout detector to prevent restart loops on battery / power bank
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  Serial.println("\n================================================");
  Serial.println("  OrthoNex India — ESP32-CAM Crisp Cloud Relay  ");
  Serial.println("================================================");

  // Setup Flash LED
  pinMode(LED_GPIO_NUM, OUTPUT);
  
  // Instant Power-On Blink: Confirms CPU booted & switch is ON
  digitalWrite(LED_GPIO_NUM, HIGH);
  delay(150);
  digitalWrite(LED_GPIO_NUM, LOW);
  setFlash(false);

  // 1. Connect to Wi-Fi first (calibrates power rail before camera starts)
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_17dBm); // Safe power level to prevent brownouts
  Serial.println("[ESP-CAM] Connecting to Wi-Fi: Paaji");

  WiFi.begin("Paaji", "12345678");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts % 20 == 0) {
      Serial.printf("\n[ESP-CAM] Still connecting to Wi-Fi (status: %d)...\n", WiFi.status());
      // Re-trigger association if initial burst missed
      WiFi.disconnect();
      delay(200);
      WiFi.begin("Paaji", "12345678");
    }
  }

  Serial.println("\n[ESP-CAM] Wi-Fi Connected Successfully!");
  Serial.printf("[ESP-CAM] Connected to SSID: %s\n", WiFi.SSID().c_str());
  Serial.printf("[ESP-CAM] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
  Serial.print("[ESP-CAM] Local IP Address: ");
  Serial.println(WiFi.localIP());

  // Confirm Wi-Fi connection with brief flash blinks
  setFlash(true); delay(100); setFlash(false); delay(100);
  setFlash(true); delay(100); setFlash(false);

  // 2. Initialize Camera (on fully stabilized power)
  initCamera();

  // 3. Connect to Cloud WebSocket Relay
  connectToCloud();
}

void loop() {
  if (client.available()) {
    client.poll();

    // Stream video frame every 40ms (~25 FPS)
    unsigned long now = millis();
    if (now - lastFrameTime >= TARGET_FRAME_DELAY_MS) {
      lastFrameTime = now;

      camera_fb_t *fb = esp_camera_fb_get();
      if (fb) {
        // Send binary JPEG frame directly to Render cloud
        client.sendBinary((const char *)fb->buf, fb->len);
        esp_camera_fb_return(fb);
      }
    }
  } else {
    // Retry connection if dropped (keeps checking Wi-Fi status)
    if (WiFi.status() == WL_CONNECTED) {
      delay(2000);
      connectToCloud();
    } else {
      delay(500);
    }
  }
}