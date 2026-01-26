#include <config.h>
#include <Arduino.h>
#include "httpEndpoints.h"

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