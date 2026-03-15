#include <config.h>
#include <Arduino.h>
#include "httpEndpoints.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

void shutDownSystem() {
  Serial.println("Shutting down");
  digitalWrite(GREEN_LED_PIN, !PIN_LED_ON);
  digitalWrite(RED_LED_PIN, PIN_LED_ON);
  server.stop();
  WiFi.softAPdisconnect(true);
  while (true) { delay(10000); }
}

void handleLoginFailure(String reason) {
  Serial.println("\nWiFi Connection Failed! Reason: " + reason);
  Serial.println("Erasing bad credentials and restarting...");

  clearPreferences("wifi-creds");

  for (int i = 0; i < 10; i++) {
    digitalWrite(RED_LED_PIN, PIN_LED_ON);
    delay(100);
    digitalWrite(RED_LED_PIN, !PIN_LED_ON);
    delay(100);
  }

  ESP.restart();
}

void checkResetButton() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    unsigned long startTime = millis();
    bool longPress = false;

    while (digitalRead(RESET_BUTTON_PIN) == LOW) {
      if (millis() - startTime > BUTTON_LONG_PRESS_MS) {
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
  if(sensor_volt == 0) sensor_volt = 0.1;
  if(sensor_volt >= 5.0) sensor_volt = 4.9;

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

void sendDataToLaptop(float temp, float humi, float lux, float ppm, int airQuality, int moistSurface, int moistRoot) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String("http://") + getServerIP() + ":" + SERVER_PORT + SERVER_ENDPOINT;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["temp_c"]          = temp;
  doc["humidity_pct"]    = humi;
  doc["light_lux"]       = lux;
  doc["air_ppm"]         = ppm;
  doc["air_quality_pct"] = airQuality;
  doc["soil_surface_pct"]= moistSurface;
  doc["soil_root_pct"]   = moistRoot;

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

bool triggerCapture() {
  Serial.println("Sending CAPTURE to CAM...");
  Serial2.println("CAPTURE");

  // Wait for start marker — timeout 10 seconds
  // (camera needs time to capture and start sending)
  unsigned long timeout = millis();
  while (millis() - timeout < 10000) {
    if (Serial2.available() >= 2) {
      uint8_t b1 = Serial2.read();
      uint8_t b2 = Serial2.read();

      // Check for error marker
      if (b1 == FRAME_START_1 && b2 == FRAME_ERROR_2) {
        Serial.println("CAM reported capture error");
        return false;
      }

      // Check for valid start marker
      if (b1 == FRAME_START_1 && b2 == FRAME_START_2) {
        Serial.println("Start marker received");
        break;
      }
    }
  }

  // Read 4-byte length
  while (Serial2.available() < 4) {
    if (millis() - timeout > 10000) {
      Serial.println("Timeout waiting for length bytes");
      return false;
    }
  }

  uint32_t imgLen = 0;
  imgLen |= (uint32_t)Serial2.read() << 24;
  imgLen |= (uint32_t)Serial2.read() << 16;
  imgLen |= (uint32_t)Serial2.read() << 8;
  imgLen |= (uint32_t)Serial2.read();

  Serial.printf("Expecting %u bytes\n", imgLen);

  if (imgLen > IMAGE_BUFFER_SIZE) {
    Serial.println("Image too large for buffer — aborting");
    return false;
  }

  // Read image bytes
  uint32_t received = 0;
  timeout = millis();
  while (received < imgLen) {
    if (Serial2.available()) {
      imageBuffer[received++] = Serial2.read();
      timeout = millis(); // Reset timeout on each byte received
    }
    if (millis() - timeout > 5000) {
      Serial.println("Timeout mid-transfer");
      return false;
    }
  }

  // Read end marker + checksum
  while (Serial2.available() < 3) delay(10);
  uint8_t end1     = Serial2.read();
  uint8_t end2     = Serial2.read();
  uint8_t checksum = Serial2.read();

  if (end1 != FRAME_END_1 || end2 != FRAME_END_2) {
    Serial.println("End marker mismatch — corrupt frame");
    return false;
  }

  // Verify checksum
  uint8_t calculated = 0;
  for (uint32_t i = 0; i < imgLen; i++) {
    calculated ^= imageBuffer[i];
  }

  if (calculated != checksum) {
    Serial.printf("Checksum mismatch — got 0x%02X expected 0x%02X\n", calculated, checksum);
    return false;
  }

  Serial.printf("Image received OK — %u bytes, checksum verified\n", imgLen);
  return true; // imageBuffer now holds the valid JPEG
}