#include <Arduino.h>
#include <WiFi.h>
#include <config.h>
#include <TFTScreen.h>
#include <deviceFunctions.h>

// Globals
Preferences pref;
WebServer server(80);
bool gotWifiCreds = false;

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, 35, -1);
  Serial.println("Base listening on Pin 35...");

  // PINS
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  // Screen booting
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  showLogo(66, 20);
  delay(2000);

  // Checking for WiFi creds
  pref.begin("wifi-creds", true);
  String ssid = pref.getString("ssid", "");
  String pass = pref.getString("pass", "");
  pref.end();

  if (ssid == "") {
    showStatus("SETUP MODE", "1. Connect to:\n   Plant-Vita-Setup\n2. Open App", TFT_BLUE);
    getWifiCredsFromAP();
  } else {
    Serial.print("Connecting to Wifi: ");
    Serial.println(ssid);

    showStatus("CONNECTING", "Target: " + ssid, TFT_ORANGE);

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    bool ledState = false;
    unsigned long lastBlinkTime = 0;
    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED) {
      checkResetButton();

      if (WiFi.status() == WL_CONNECT_FAILED) {
        showStatus("ERROR", "Wrong password or connection refused", TFT_RED);
        handleLoginFailure("Wrong Password or Connection Refused");
      } else if (WiFi.status() == WL_NO_SSID_AVAIL) {
        digitalWrite(RED_LED_PIN, PIN_LED_ON);
      }

      if (millis() - startAttemptTime > WIFI_CONNECT_TIMEOUT) {
        showStatus("ERROR", "Connection Timeout.\nCheck Router.", TFT_RED);
        handleLoginFailure("Connection Timed Out");
      }

      if (millis() - lastBlinkTime > WAITING_FOR_WIFI) {
        Serial.print(".");
        lastBlinkTime = millis();
        ledState = !ledState;
        digitalWrite(GREEN_LED_PIN, ledState ? PIN_LED_ON : !PIN_LED_ON);
      }
    }

    digitalWrite(RED_LED_PIN, !PIN_LED_ON);

    String wiFiIp = WiFi.localIP().toString();

    Serial.println("\nWifi Connected!");
    Serial.print("IP Address: ");
    Serial.println(wiFiIp);
    showStatus("ONLINE", "", TFT_GREEN);
    showLogo(66, 50);
    digitalWrite(GREEN_LED_PIN, PIN_LED_ON);
  }
}

void loop() {
  checkResetButton();

  if (Serial2.available()) {
    char c = Serial2.read();
    if ((c >= 32 && c <= 126) || c == '\n' || c == '\r') {
      Serial.write(c);
    }
  }
}
