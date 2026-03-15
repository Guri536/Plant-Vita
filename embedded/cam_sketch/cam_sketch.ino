// Framing protocol markers
#define START_MARKER_1 0xFF
#define START_MARKER_2 0xAA
#define END_MARKER_1 0xFF
#define END_MARKER_2 0xBB

// Commands
#define CMD_CAPTURE "CAPTURE"
#define CMD_PING "PING"

// true  = talking to ESP32-38 pin (production)
// false = talking to PC Serial monitor (development)
#define PRODUCTION_MODE false

#define CAM_BAUD_PRODUCTION 921600
#define CAM_BAUD_DEBUG 115200

#include "config.h"

void setup() {
  if (PRODUCTION_MODE) {
    Serial.begin(CAM_BAUD_PRODUCTION);
  } else {
    Serial.begin(CAM_BAUD_DEBUG);
    Serial.println("CAM booting — DEBUG MODE");
  }

  if (!initCamera()) {
    if (!PRODUCTION_MODE) Serial.println("Camera init failed — halting");
    while (true) delay(1000);
  }

  if (!PRODUCTION_MODE) {
    Serial.println("Camera ready. Waiting for commands...");
  }
}

void debugPrint(String msg) {
  if (!PRODUCTION_MODE) {
    Serial.println(msg);
  }
}

String readCommand() {
  String cmd = "";
  unsigned long start = millis();

  // Wait up to 100ms for a full line
  while (millis() - start < 100) {
    while (Serial.available()) {
      char c = Serial.read();
      if (c == '\n') return cmd;  // Full command received
      if (c != '\r') cmd += c;    // Strip carriage return
    }
  }
  return "";  // Timeout — no command
}

void loop() {
  String cmd = readCommand();

  if (cmd == CMD_PING) {
    Serial.println("OK");
    debugPrint("Ping received, responded OK");
  } else if (cmd == CMD_CAPTURE) {
    debugPrint("Capture command received");
    captureAndSend();  // We'll write this next
  }
}

void captureAndSend() {
  // Grab frame
  camera_fb_t *fb = esp_camera_fb_get();

  if (!fb) {
    debugPrint("Capture failed — no frame buffer");
    // Send error signal so ESP32 doesn't hang waiting
    Serial.write(0xFF);
    Serial.write(0xEE); // Error marker
    return;
  }

  debugPrint("Captured: " + String(fb->len) + " bytes");

  // Calculate XOR checksum over image bytes
  uint8_t checksum = 0;
  for (size_t i = 0; i < fb->len; i++) {
    checksum ^= fb->buf[i];
  }

  // --- Send framed response ---

  // Start marker
  Serial.write(START_MARKER_1); // 0xFF
  Serial.write(START_MARKER_2); // 0xAA

  // Image length — 4 bytes big-endian uint32
  uint32_t len = fb->len;
  Serial.write((len >> 24) & 0xFF);
  Serial.write((len >> 16) & 0xFF);
  Serial.write((len >> 8)  & 0xFF);
  Serial.write((len)       & 0xFF);

  // Raw JPEG bytes
  Serial.write(fb->buf, fb->len);

  // End marker
  Serial.write(END_MARKER_1); // 0xFF
  Serial.write(END_MARKER_2); // 0xBB

  // Checksum
  Serial.write(checksum);

  // Return buffer to camera immediately
  esp_camera_fb_return(fb);

  debugPrint("Frame sent. Checksum: " + String(checksum));
}