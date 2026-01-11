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