#ifndef PREFERENCES_CONFIG_H
#define PREFERENCES_CONFIG_H

#include <Preferences.h>
#include "config.h"

void clearPreferences(String id) {
    pref.begin(id.c_str(), false);
    pref.clear();
    pref.end();
}

void setDeviceConfig(String ssid, String pass, String email) {
  pref.begin("wifi-creds", false);
  pref.putString("ssid", ssid);
  pref.putString("pass", pass);
  pref.putString("email", email);
  pref.end();
}

void printPrefs() {
  pref.begin("wifi-creds", true); 
  
  Serial.printf("SSID: %s | Pass: %s | Email: %s\n", 
                pref.getString("ssid", "N/A").c_str(), 
                pref.getString("pass", "N/A").c_str(), 
                pref.getString("email", "N/A").c_str());
                
  pref.end();
}

void setPlantConfig(String wateringMode, int pumpDuration) {
    pref.begin("plant-config", false);
    pref.putString("watering_mode", wateringMode);
    pref.putInt("pump_duration", pumpDuration);
    pref.end();
}

String getWateringMode() {
    pref.begin("plant-config", true);
    String mode = pref.getString("watering_mode", "manual");
    pref.end();
    return mode;
}

#endif