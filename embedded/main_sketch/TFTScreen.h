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