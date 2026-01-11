#ifndef HTTP_ENDPOINTS_H
#define HTTP_ENDPOINTS_H

#include <preferencesConfig.h>
#include <config.h>
#include <Arduino.h>

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
    setWifiCreds(ssid, pass); // Saving wifi credentials in preferences
    server.send(200, "application/json", "{\"status\":\"saved\"}");
    gotWifiCreds = true;
  } else {
    server.send(200, "application/json", "{\"status\":\"error\"}");
  }
}

void handleRoot() {
  server.send(200, "text/html", "<h1>Plant Vita Setup</h1><p>Use the app to configure WiFi.</p>");
}

#endif