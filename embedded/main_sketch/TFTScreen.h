#ifndef TFT_SCREEN
#define TFT_SCREEN

#include <Arduino.h>
#include <TFT_eSPI.h>
#include "imagesArrays.h"

TFT_eSPI tft = TFT_eSPI();

// Screen configs
#define PLANT_BG    TFT_BLACK
#define PLANT_TEXT  TFT_WHITE
#define PLANT_ACCENT TFT_GREEN

void showStatus(String title, String msg, uint16_t color) {
  tft.fillScreen(PLANT_BG);

  tft.fillRect(0,0,160, 20, PLANT_ACCENT);
  tft.setTextColor(TFT_BLACK, PLANT_ACCENT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("PLANTVITA", 80, 10, 2);

  tft.setTextColor(color, PLANT_BG);
  tft.drawString(title, 80, 40, 2);

  tft.setTextColor(TFT_WHITE, PLANT_BG);
  tft.setTextSize(1);
  tft.setCursor(0, 60);
  tft.print(msg);
}

void showNetworkList(int count){
  tft.fillScreen(PLANT_BG);
  tft.setTextColor(TFT_GREEN, PLANT_BG);
  tft.drawString("Networks found: ", 80, 10, 2);

  tft.setTextColor(TFT_WHITE, PLANT_BG);
  tft.setCursor(0,30);
  
  for(int i = 0; i < count && i < 10; i++) {
    tft.printf("%d. %s\n", i + 1, WiFi.SSID(i).c_str());
  }
}

void showLogo(int32_t x, int32_t y) {
  tft.setSwapBytes(true);
  tft.pushImage(x, y, 28, 68, epd_bitmap_SmallLogo);
}

void showSensorData(float temp, float humi, float lux, float ds18Temp, int soilSurface, int soilRoot, int airQuality, float ppm) {
  
  // Only draw header once — add a static flag
  static bool headerDrawn = false;
  if (!headerDrawn) {
    tft.fillScreen(PLANT_BG);
    tft.fillRect(0, 0, 160, 20, PLANT_ACCENT);
    tft.setTextColor(TFT_BLACK, PLANT_ACCENT);
    tft.setTextDatum(MC_DATUM);
    tft.drawString("PLANTVITA", 80, 10, 2);
    tft.drawLine(0, 86, 160, 86, TFT_DARKGREY);
    tft.setTextColor(TFT_DARKGREY, PLANT_BG);
    tft.drawString("live sensor data", 80, 95, 1);

    // Draw static labels once
    tft.setTextDatum(TL_DATUM);
    tft.setTextSize(1);
    tft.setTextColor(TFT_CYAN, PLANT_BG);
    tft.drawString("AMB",  2, 26, 1);
    tft.drawString("H2O",  2, 38, 1);
    tft.drawString("LUX",  2, 50, 1);
    tft.drawString("SOIL", 2, 62, 1);
    tft.drawString("AIR",  2, 74, 1);
    headerDrawn = true;
  }

  tft.setTextDatum(TL_DATUM);
  tft.setTextSize(1);

  // Overwrite only values — background color erases old text
  tft.setTextColor(TFT_WHITE, PLANT_BG);
  tft.drawString(String(temp, 1) + "C  " + String(humi, 0) + "%   ", 28, 26, 1);
  tft.drawString(String(ds18Temp, 1) + "C      ", 28, 38, 1);
  tft.drawString(String(lux, 0) + " lx    ", 28, 50, 1);

  int avgMoisture = (soilSurface + soilRoot) / 2;
  uint16_t moistureColor = avgMoisture < 20 ? TFT_RED : avgMoisture < 40 ? TFT_ORANGE : TFT_GREEN;
  tft.setTextColor(moistureColor, PLANT_BG);
  tft.drawString("S:" + String(soilSurface) + "% R:" + String(soilRoot) + "%   ", 28, 62, 1);

  uint16_t airColor = ppm > 2000 ? TFT_RED : ppm > 1000 ? TFT_ORANGE : TFT_GREEN;
  tft.setTextColor(airColor, PLANT_BG);
  tft.drawString(String((int)ppm) + "ppm   ", 28, 74, 1);
}

#endif