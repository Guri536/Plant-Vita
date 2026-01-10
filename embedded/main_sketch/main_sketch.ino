#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <WebServer.h>

// PIN LAYOUTS
const int GREEN_LED_PIN = 26;
const int RED_LED_PIN = 25;
const int PIN_LED_ON = HIGH;

// TIMERS
const int SETUP_TIMEOUT = 120000; // 2 min timer for hotspot timeout 
const int WAITING_FOR_HOTSPOT_CONNECTION = 800;
const int WAITING_FOR_WIFI = 500;
const int WIFI_CONNECT_TIMEOUT = 20000;

// UUIDs for services
#define SERVICE_UUID "8a26dfa4-f405-4de1-9ef3-ee8866b0d25e"
#define CHARACTERISTIC_UUID "f7f5786f-2cb3-4347-9403-4706df8c5c52"

Preferences pref;
bool deviceConnected = false;
WebServer server(80);
bool gotWifiCreds = false;
String rValue;

void shutDownSystem() {
  Serial.println("Shutting down");
  digitalWrite(GREEN_LED_PIN, !PIN_LED_ON);
  digitalWrite(RED_LED_PIN, PIN_LED_ON);
  server.stop();            
  WiFi.softAPdisconnect(true);
  while (true) { delay(10000); }
}

void scanWifiNetworks() {
  Serial.println("Scanning for wifi networks");
  int numOfNet = WiFi.scanNetworks();

  String json = "[";
  for (int i = 0; i < numOfNet; i++) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";

  server.send(200, "application/json", json);
}

void saveWifiCreds() {
  if (server.hasArg("ssid") && server.hasArg("pass")) {
    String ssid = server.arg("ssid");
    String pass = server.arg("pass");

    Serial.println("Received WiFi Credentials!");

    pref.begin("wifi-creds", false);
    pref.putString("ssid", ssid);
    pref.putString("pass", pass);
    pref.end();

    server.send(200, "application/json", "{\"status\":\"saved\"}");
    gotWifiCreds = true;
  } else {
    server.send(200, "application/json", "{\"status\":\"error\"}");
  }
}

void handleRoot() {
  server.send(200, "text/html", "<h1>Plant Vita Setup</h1><p>Use the app to configure WiFi.</p>");
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

void handleLoginFailure(String reason) {
  Serial.println("\nWiFi Connection Failed! Reason: " + reason);
  Serial.println("Erasing bad credentials and restarting...");

  pref.begin("wifi-creds", false);
  pref.clear(); 
  pref.end();

  for(int i=0; i<10; i++){
      digitalWrite(RED_LED_PIN, PIN_LED_ON); delay(100);
      digitalWrite(RED_LED_PIN, !PIN_LED_ON); delay(100);
  }

  ESP.restart();
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, 35, -1); 
  Serial.println("Base listening on Pin 35...");

  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);

  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  pref.begin("wifi-creds", true);
  String ssid = pref.getString("ssid", "");
  String pass = pref.getString("pass", "");
  pref.end();

  if (ssid == "") {
    getWifiCredsFromAP();
  } else {
    Serial.print("Connecting to Wifi: ");
    Serial.println(ssid);

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    bool ledState = false;
    unsigned long lastBlinkTime = 0;
    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED) {
      if (WiFi.status() == WL_CONNECT_FAILED) {
          handleLoginFailure("Wrong Password or Connection Refused");
      } 
      else if (WiFi.status() == WL_NO_SSID_AVAIL) {
          handleLoginFailure("SSID Not Found (Network unreachable)");
      }

      if (millis() - startAttemptTime > WIFI_CONNECT_TIMEOUT) {
          handleLoginFailure("Connection Timed Out");
      }

      if (millis() - lastBlinkTime > WAITING_FOR_WIFI) {
        Serial.print(".");
        lastBlinkTime = millis();
        ledState = !ledState;
        digitalWrite(GREEN_LED_PIN, ledState ? PIN_LED_ON : !PIN_LED_ON);
      }
    }

    Serial.println("\nWifi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    digitalWrite(GREEN_LED_PIN, PIN_LED_ON);
  }
}

void loop() {
  if (Serial2.available()) {
    char c = Serial2.read();
    
    if ((c >= 32 && c <= 126) || c == '\n' || c == '\r') {
      Serial.write(c);
    }
  }
}
