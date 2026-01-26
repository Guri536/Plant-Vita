#ifndef CONFIG_H
#define CONFIG_H

// includes
#include <Arduino.h>
#include <Preferences.h> 
#include <WebServer.h>
#include <DHT.h>
#include <BH1750.h>

// Globals
extern Preferences pref;
extern WebServer server;
extern bool gotWifiCreds;
extern DHT dht22;
extern BH1750 bh1750;

// Pin Layouts
#define GREEN_LED_PIN 26
#define RED_LED_PIN 25
#define RESET_BUTTON_PIN 27
#define DHT_PIN 33
#define CAM_READ_PIN 35
#define MQ135_PIN 36
#define SOIL_SURFACE_PIN 39
#define SOIL_ROOT_PIN 34

// I2C Pins
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// Modules
#define DHT_TYPE DHT22 

// Constants
#define PIN_LED_ON HIGH
#define MQ135_MAX_RAW 3100
#define RZERO 76.63       
#define PARA 110.47       // Curve parameter a for CO2
#define PARB -2.862       // Curve parameter b for CO2
#define ATMOCO2 397.13
#define SOIL_DRY_VAL 2630
#define SOIL_WET_VAL 1450

// Timers
#define SETUP_TIMEOUT 120000                      // 2 min timer for hotspot timeout
#define WAITING_FOR_HOTSPOT_CONNECTION 800
#define WAITING_FOR_WIFI 500
#define WIFI_CONNECT_TIMEOUT 20000
#define BUTTON_LONG_PRESS_MS 5000
#define SENSOR_READ_TIME 5000

#endif