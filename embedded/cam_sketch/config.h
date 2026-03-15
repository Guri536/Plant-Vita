#ifndef CAMCONFIG_H
#define CAMCONFIG_H

#include "esp_camera.h"

// ── UART ────────────────────────────────────────────────────────────────────
#define BAUD_RATE       921600

// ── PINS (AI Thinker ESP32-CAM layout) ──────────────────────────────────────
#define RED_LED_PIN     33    // Onboard red LED (active LOW on AI Thinker)
#define WHITE_LED_PIN   4     // Onboard flash LED

// Camera pins — fixed for AI Thinker, do not change
#define CAM_PIN_PWDN    32
#define CAM_PIN_RESET   -1    // Not connected
#define CAM_PIN_XCLK    0
#define CAM_PIN_SIOD    26
#define CAM_PIN_SIOC    27
#define CAM_PIN_D7      35
#define CAM_PIN_D6      34
#define CAM_PIN_D5      39
#define CAM_PIN_D4      36
#define CAM_PIN_D3      21
#define CAM_PIN_D2      19
#define CAM_PIN_D1      18
#define CAM_PIN_D0      5
#define CAM_PIN_VSYNC   25
#define CAM_PIN_HREF    23
#define CAM_PIN_PCLK    22

// ── FRAMING PROTOCOL ────────────────────────────────────────────────────────
// Chosen to not collide with JPEG markers (0xFF 0xD8 start, 0xFF 0xD9 end)
const uint8_t START_MARKER[2] = { 0xFF, 0xAA };
const uint8_t END_MARKER[2]   = { 0xFF, 0xBB };

// ── CAMERA INIT ─────────────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = CAM_PIN_D0;
  config.pin_d1       = CAM_PIN_D1;
  config.pin_d2       = CAM_PIN_D2;
  config.pin_d3       = CAM_PIN_D3;
  config.pin_d4       = CAM_PIN_D4;
  config.pin_d5       = CAM_PIN_D5;
  config.pin_d6       = CAM_PIN_D6;
  config.pin_d7       = CAM_PIN_D7;
  config.pin_xclk     = CAM_PIN_XCLK;
  config.pin_pclk     = CAM_PIN_PCLK;
  config.pin_vsync    = CAM_PIN_VSYNC;
  config.pin_href     = CAM_PIN_HREF;
  config.pin_sccb_sda = CAM_PIN_SIOD;
  config.pin_sccb_scl = CAM_PIN_SIOC;
  config.pin_pwdn     = CAM_PIN_PWDN;
  config.pin_reset    = CAM_PIN_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location  = CAMERA_FB_IN_PSRAM; // 4MB PSRAM confirmed
  config.frame_size   = FRAMESIZE_SXGA;     // 1280x1024 — closest to target
  config.jpeg_quality = 12;                 // 0=best, 63=worst. 12 is good balance
  config.fb_count     = 1;                  // Single buffer — matches architecture

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    return false;
  }

  // Fine-tune sensor settings for indoor/artificial lighting
  sensor_t* s = esp_camera_sensor_get();
  s->set_brightness(s, 1);      // Slight brightness boost for indoor
  s->set_saturation(s, 0);      // Neutral saturation
  s->set_whitebal(s, 1);        // Auto white balance on
  s->set_awb_gain(s, 1);        // AWB gain on
  s->set_wb_mode(s, 0);         // Auto WB mode
  s->set_exposure_ctrl(s, 1);   // Auto exposure on
  s->set_aec2(s, 1);            // AEC DSP on
  s->set_gain_ctrl(s, 1);       // Auto gain on
  s->set_agc_gain(s, 0);        // Start at 0 gain
  s->set_gainceiling(s, (gainceiling_t)2); // Cap gain to reduce noise
  s->set_lenc(s, 1);            // Lens correction on
  s->set_hmirror(s, 0);         // No mirror — adjust if image appears flipped
  s->set_vflip(s, 0);           // No flip — adjust if image appears upside down

  return true;
}

#endif