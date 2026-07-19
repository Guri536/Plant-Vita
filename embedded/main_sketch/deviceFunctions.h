#ifndef DEVICE_FUNCTIONS_H
#define DEVICE_FUNCTIONS_H

#include <config.h>
#include <Arduino.h>
#include "httpEndpoints.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <TFTScreen.h>
#include <TFT_eSPI.h>

void factoryReset() {
  Serial.println("\nFactory reseting the device");

  digitalWrite(RED_LED_PIN, PIN_LED_ON);
  digitalWrite(GREEN_LED_PIN, !PIN_LED_ON);

  clearPreferences("wifi-creds");

  for (int i = 0; i < 5; i++) {
    digitalWrite(RED_LED_PIN, !PIN_LED_ON);
    delay(100);
    digitalWrite(RED_LED_PIN, PIN_LED_ON);
    delay(100);
  }

  Serial.println("Restarting system...");
  ESP.restart();
}

void checkResetButton() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    unsigned long startTime = millis();
    bool longPress = false;

    while (digitalRead(RESET_BUTTON_PIN) == LOW) {
      if (millis() - startTime > BUTTON_LONG_PRESS_MS) {
        factoryReset();
        longPress = true;
      }
      delay(10);
    }

    unsigned long pressedDuration = millis() - startTime;

    if (pressedDuration > 50 && !longPress) {
      Serial.println("\nRebooting Triggered");
      delay(100);
      ESP.restart();
    }
  }
}

void smartDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    checkResetButton();
    delay(1);
  }
}

void shutDownSystem() {
  Serial.println("Shutting down");
  digitalWrite(GREEN_LED_PIN, !PIN_LED_ON);
  digitalWrite(RED_LED_PIN, PIN_LED_ON);
  server.stop();
  WiFi.softAPdisconnect(true);
  showStatus("Error", "Reset the device", TFT_RED);
  while (true) {
    checkResetButton();
  }
}

void handleLoginFailure(String reason) {
  Serial.println("\nWiFi Connection Failed! Reason: " + reason);
  Serial.println("Erasing bad credentials and restarting...");

  // clearPreferences("wifi-creds");

  for (int i = 0; i < 10; i++) {
    digitalWrite(RED_LED_PIN, PIN_LED_ON);
    delay(100);
    digitalWrite(RED_LED_PIN, !PIN_LED_ON);
    delay(100);
  }

  ESP.restart();
}

void getWifiCredsFromAP() {
  Serial.println("Starting Access point");
  WiFi.mode(WIFI_AP_STA);

  WiFi.softAP("Plant-Vita-Setup");
  Serial.println("AP started; IP: " + WiFi.softAPIP().toString());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/scan", HTTP_GET, scanWifiNetworks);
  server.on("/save", HTTP_POST, saveWifiCreds);

  server.begin();

  unsigned long startTime = millis();
  bool ledState = false;
  unsigned long lastBlinkTime = 0;

  while (millis() - startTime < SETUP_TIMEOUT) {
    server.handleClient();

    if (gotWifiCreds) {
      Serial.println("Creds saved, restarting device");
      delay(2000);
      ESP.restart();
    }

    int stationCount = WiFi.softAPgetStationNum();

    if (stationCount > 0) {
      digitalWrite(GREEN_LED_PIN, PIN_LED_ON);
      lastBlinkTime = millis();
    } else if (millis() - lastBlinkTime > WAITING_FOR_HOTSPOT_CONNECTION) {
      lastBlinkTime = millis();
      ledState = !ledState;
      digitalWrite(GREEN_LED_PIN, ledState ? PIN_LED_ON : !PIN_LED_ON);
    }
    delay(10);
  }

  shutDownSystem();
}

void setupSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  if (bh1750.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 initialized");
  } else {
    Serial.println("Error initializing BH1750");
  }
}

float getLightLevel() {
  if (bh1750.measurementReady()) {
    return bh1750.readLightLevel();
  }
  return -1.0;
}

int getAirQuality() {
  int rawValue = analogRead(MQ135_PIN);
  rawValue = constrain(rawValue, 0, MQ135_MAX_RAW);
  int qualityPercent = map(rawValue, 0, MQ135_MAX_RAW, 0, 100);

  return qualityPercent;
}

float getPPM() {
  int raw_adc = analogRead(MQ135_PIN);

  // 1. Convert ADC reading to Voltage at the ESP32 Pin (0 - 3.3V)
  float voltage_at_pin = raw_adc * (3.3 / 4095.0);

  // 2. Reconstruct the Sensor's Output Voltage (0 - 5V)
  // Because you used a 10k/10k divider, the sensor output is 2x the pin voltage.
  float sensor_volt = voltage_at_pin * 2.0;

  // Safety clamp to prevent divide-by-zero or negative resistance errors
  if (sensor_volt == 0) sensor_volt = 0.1;
  if (sensor_volt >= 5.0) sensor_volt = 4.9;

  // 3. Calculate Sensor Resistance (Rs)
  // The sensor forms a voltage divider with an internal load resistor (RL).
  // Formula: Rs = RL * (Vcc - Vout) / Vout
  // We can treat RL as "1" for the ratio calculation if RZero uses the same unit.
  float RS_gas = (5.0 - sensor_volt) / sensor_volt;

  // 4. Calculate Ratio (Rs / Ro)
  float ratio = RS_gas / RZERO;

  // 5. Calculate PPM using Power Law: PPM = a * ratio^b
  float ppm = PARA * pow(ratio, PARB);

  return ppm;
}

int getSoilMoisture(int pin) {
  int rawValue = analogRead(pin);

  int constrainedVal = constrain(rawValue, SOIL_WET_VAL, SOIL_DRY_VAL);

  // Map raw value to percentage:
  // map(value, fromLow, fromHigh, toLow, toHigh)
  // Note: DRY is High (0%), WET is Low (100%)
  int percentage = map(constrainedVal, SOIL_DRY_VAL, SOIL_WET_VAL, 0, 100);

  return percentage;
}

String getServerIP() {
  return WiFi.gatewayIP().toString();
}

void sendDataToLaptop(float temp, float humi, float lux, float ppm, int airQuality, int moistSurface, int moistRoot, float soilTemp) {
  if (WiFi.status() != WL_CONNECTED) return;

  String mac = WiFi.macAddress();
  mac.replace(":", "");

  char endpoint[64];
  snprintf(endpoint, sizeof(endpoint), SERVER_ENDPOINT, mac.c_str());

  HTTPClient http;
  String url = String("http://") + getServerIP() + ":" + SERVER_PORT + endpoint;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["temp_c"] = temp;
  doc["humidity_pct"] = humi;
  doc["light_lux"] = lux;
  doc["air_ppm"] = ppm;
  doc["air_quality_pct"] = airQuality;
  doc["soil_surface_pct"] = moistSurface;
  doc["soil_root_pct"] = moistRoot;
  doc["soil_temp_c"] = soilTemp;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[HTTP] Data sent OK");
  } else {
    Serial.printf("[HTTP] POST failed, code: %d\n", httpCode);
  }

  http.end();
}

bool uploadImage(uint32_t imgLen) {
  WiFiClient client;
  HTTPClient http;

  String mac = WiFi.macAddress();
  mac.replace(":", "");

  char endpoint[64];
  snprintf(endpoint, sizeof(endpoint), IMAGE_ENDPOINT, mac.c_str());

  String url = "http://" + getServerIP() + ":" + String(SERVER_PORT) + endpoint;
  Serial.println("Uploading from SPIFFS to: " + url);

  File file = SPIFFS.open("/capture.jpg", FILE_READ);
  if (!file) {
    Serial.println("Failed to open SPIFFS file for upload");
    return false;
  }

  http.begin(client, url);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-MAC", WiFi.macAddress());
  http.addHeader("X-Force-Universal", "false");

  // Stream directly from SPIFFS — no RAM buffer
  int httpCode = http.sendRequest("POST", &file, imgLen);
  file.close();

  // Clean up SPIFFS after upload
  SPIFFS.remove("/capture.jpg");

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("Upload OK — HTTP %d\n", httpCode);
    return true;
  } else {
    Serial.printf("Upload failed — HTTP %d\n", httpCode);
    Serial.println(http.getString());
    return false;
  }
}

bool triggerCapture() {
  captureInProgress = true;

  // Flush any stale bytes before sending command
  while (Serial2.available()) Serial2.read();

  Serial.println("Sending CAPTURE to CAM...");
  Serial2.println("CAPTURE");

  // ── 1. Wait for start marker (0xFF 0xAA) or error (0xFF 0xEE) ──
  Serial2.setTimeout(15000);
  uint8_t marker[2];
  if (Serial2.readBytes(marker, 2) < 2) {
    Serial.println("Timeout waiting for start marker");
    captureInProgress = false;
    return false;
  }

  if (marker[0] == FRAME_START_1 && marker[1] == FRAME_ERROR_2) {
    Serial.println("CAM reported capture error");
    captureInProgress = false;
    return false;
  }

  if (marker[0] != FRAME_START_1 || marker[1] != FRAME_START_2) {
    Serial.printf("Unexpected marker: 0x%02X 0x%02X\n", marker[0], marker[1]);
    captureInProgress = false;
    return false;
  }

  Serial.println("Start marker received");

  // ── 2. Read 4-byte image length (big-endian) ────────────────────
  Serial2.setTimeout(5000);
  uint8_t lenBytes[4];
  if (Serial2.readBytes(lenBytes, 4) < 4) {
    Serial.println("Timeout waiting for length bytes");
    captureInProgress = false;
    return false;
  }

  uint32_t imgLen = ((uint32_t)lenBytes[0] << 24) |
                    ((uint32_t)lenBytes[1] << 16) |
                    ((uint32_t)lenBytes[2] << 8)  |
                    ((uint32_t)lenBytes[3]);

  Serial.printf("Expecting %u bytes\n", imgLen);

  if (imgLen == 0 || imgLen > 1000000) {
    Serial.printf("Invalid image length: %u — aborting\n", imgLen);
    captureInProgress = false;
    return false;
  }

  // ── 3. Open SPIFFS file ─────────────────────────────────────────
  File file = SPIFFS.open("/capture.jpg", FILE_WRITE);
  if (!file) {
    Serial.println("Failed to open SPIFFS file for writing");
    captureInProgress = false;
    return false;
  }

  // ── 4. Stream image data into SPIFFS ───────────────────────────
  Serial2.setTimeout(1000);
  uint8_t  buf[1024];
  uint32_t received     = 0;
  uint32_t lastProgress = 0;

  while (received < imgLen) {
    size_t toRead    = min((uint32_t)sizeof(buf), imgLen - received);
    size_t bytesRead = Serial2.readBytes(buf, toRead);

    if (bytesRead == 0) {
      Serial.printf("\nStall at %u / %u bytes\n", received, imgLen);
      file.close();
      SPIFFS.remove("/capture.jpg");
      captureInProgress = false;
      return false;
    }

    file.write(buf, bytesRead);
    received += bytesRead;

    if (received - lastProgress >= 5120) {
      Serial.printf("Progress: %u / %u bytes\n", received, imgLen);
      lastProgress = received;
    }
  }

  file.close();

  // ── 5. Read end marker + checksum (3 bytes) ─────────────────────
  Serial2.setTimeout(5000);
  uint8_t trailer[3];
  if (Serial2.readBytes(trailer, 3) < 3) {
    Serial.println("Timeout waiting for trailer");
    SPIFFS.remove("/capture.jpg");
    captureInProgress = false;
    return false;
  }

  if (trailer[0] != FRAME_END_1 || trailer[1] != FRAME_END_2) {
    Serial.printf("End marker mismatch: 0x%02X 0x%02X\n", trailer[0], trailer[1]);
    SPIFFS.remove("/capture.jpg");
    captureInProgress = false;
    return false;
  }

  uint8_t checksum = trailer[2];

  // ── 6. Verify checksum ──────────────────────────────────────────
  File verify = SPIFFS.open("/capture.jpg", "r");
  if (!verify || verify.size() != imgLen) {
    Serial.printf("Verify failed — file size %u, expected %u\n",
                  verify ? verify.size() : 0, imgLen);
    if (verify) verify.close();
    SPIFFS.remove("/capture.jpg");
    captureInProgress = false;
    return false;
  }

  uint8_t calculated = 0;
  while (verify.available()) calculated ^= verify.read();
  verify.close();

  if (calculated != checksum) {
    Serial.printf("Checksum mismatch — got 0x%02X, expected 0x%02X\n",
                  calculated, checksum);
    SPIFFS.remove("/capture.jpg");
    captureInProgress = false;
    return false;
  }

  Serial.printf("Image OK — %u bytes\n", imgLen);
  captureInProgress = false;
  return uploadImage(imgLen);
}


void activatePump() {
  if (!pumpActive) {
    pumpActive = true;
    pumpStartTime = millis();
    digitalWrite(PUMP_PIN, LOW);  // Active LOW — LOW turns relay ON
    Serial.println("[PUMP] Activated");
    showStatus("WATERING", "Pump ON", TFT_BLUE);
  }
}

void deactivatePump() {
  if (pumpActive) {
    pumpActive = false;
    digitalWrite(PUMP_PIN, HIGH);  // HIGH turns relay OFF
    Serial.println("[PUMP] Deactivated");
  }
}

void checkPump(int moistureRoot, String wateringMode) {
  // Safety cutoff — never run pump longer than PUMP_MAX_RUNTIME
  if (pumpActive && millis() - pumpStartTime > PUMP_MAX_RUNTIME) {
    Serial.println("[PUMP] Safety cutoff triggered — max runtime exceeded");
    deactivatePump();
    return;
  }

  // Only run hysteresis logic in auto mode
  if (wateringMode != "auto") {
    if (pumpActive) deactivatePump();  // Safety — turn off if mode switched
    return;
  }

  if (!pumpActive && moistureRoot < PUMP_ACTIVATE_THRESHOLD) {
    activatePump();
  } else if (pumpActive && moistureRoot > PUMP_DEACTIVATE_THRESHOLD) {
    deactivatePump();
  }
}

void executePumpCommand(int duration, int commandId) {
  Serial.printf("[CMD] Executing pump command — %d seconds\n", duration);

  // Activate pump
  activatePump();

  // Block for duration (using smartDelay so reset button still works)
  smartDelay(duration * 1000);

  // Deactivate pump
  deactivatePump();

  Serial.println("[CMD] Pump command complete — acknowledging");

  // Acknowledge back to backend
  if (WiFi.status() != WL_CONNECTED) return;

  String mac = WiFi.macAddress();
  mac.replace(":", "");

  char endpoint[64];
  snprintf(endpoint, sizeof(endpoint), COMMAND_ACK_ENDPOINT, mac.c_str());

  HTTPClient http;
  String url = "http://" + getServerIP() + ":" + SERVER_PORT + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<64> doc;
  doc["command_id"] = commandId;
  doc["status"] = "executed";

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  Serial.printf("[CMD] Acknowledge response: %d\n", httpCode);
  http.end();
}

void pollForCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  String mac = WiFi.macAddress();
  mac.replace(":", "");

  char endpoint[64];
  snprintf(endpoint, sizeof(endpoint), COMMAND_ENDPOINT, mac.c_str());

  HTTPClient http;
  String url = "http://" + getServerIP() + ":" + SERVER_PORT + endpoint;
  http.begin(url);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();

    // null response means no pending commands
    if (response == "null") {
      http.end();
      return;
    }

    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      int commandId = doc["id"];
      String commandType = doc["command_type"].as<String>();
      int duration = doc["duration"];

      Serial.printf("[CMD] Received command: %s (id=%d)\n",
                    commandType.c_str(), commandId);

      if (commandType == "pump") {
        executePumpCommand(duration, commandId);
      }
      // Future command types can be added here
    }
  }

  http.end();
}

#endif