#ifndef CONFIG_H
#define CONFIG_H

// includes
#include <Arduino.h>
#include <Preferences.h> 
#include <WebServer.h>

// Globals
extern Preferences pref;
extern WebServer server;
extern bool gotWifiCreds;

// Pin Layouts
#define GREEN_LED_PIN 26
#define RED_LED_PIN 25
#define RESET_BUTTON_PIN 27

// Constants
#define PIN_LED_ON HIGH

// Timers
#define SETUP_TIMEOUT 120000                      // 2 min timer for hotspot timeout
#define WAITING_FOR_HOTSPOT_CONNECTION 800
#define WAITING_FOR_WIFI 500
#define WIFI_CONNECT_TIMEOUT 20000
#define BUTTON_LONG_PRESS_MS 5000

#endif