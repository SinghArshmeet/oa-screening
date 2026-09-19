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

WebsocketsClient client;
unsigned long lastFrameTime = 0;
const int TARGET_FRAME_DELAY_MS = 50; // ~20 FPS smooth streaming
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
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA; // Crisp 640x480 (eliminates pixelation)
    config.jpeg_quality = 10;            // High quality
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  Serial.println("[ESP-CAM] Initializing camera driver...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ESP-CAM] Camera init failed: 0x%x\n", err);
    delay(2000);
    ESP.restart();
  }

  // Safe sensor configuration (checking function pointers)
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    if (s->set_vflip) s->set_vflip(s, 1);
    if (s->set_brightness) s->set_brightness(s, 1);
    if (s->set_contrast) s->set_contrast(s, 1);
    if (s->set_saturation) s->set_saturation(s, 0);
  }

  Serial.println("[ESP-CAM] Camera initialized with crisp VGA presets!");
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
  Serial.begin(115200);
  Serial.println("\n================================================");
  Serial.println("  OrthoNex India — ESP32-CAM Crisp Cloud Relay  ");
  Serial.println("================================================");

  // Setup Flash LED
  pinMode(LED_GPIO_NUM, OUTPUT);
  setFlash(false);

  // Initialize Camera
  initCamera();

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);
  Serial.print("[ESP-CAM] Connecting to Wi-Fi: ");
  Serial.println(ssid);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[ESP-CAM] Wi-Fi Connected!");
  Serial.print("[ESP-CAM] Local IP Address: ");
  Serial.println(WiFi.localIP());

  // Connect to Cloud WebSocket
  connectToCloud();
}

void loop() {
  if (client.available()) {
    client.poll();

    // Stream video frame every 50ms (~20 FPS)
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
    // Retry connection if dropped
    delay(3000);
    connectToCloud();
  }
}