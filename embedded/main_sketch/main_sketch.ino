#include <Arduino.h>
#include <WiFi.h>
#include <config.h>
#include <TFTScreen.h>
#include <deviceFunctions.h>

// Globals
Preferences pref;
WebServer server(80);
DHT dht22(DHT_PIN, DHT_TYPE);
BH1750 bh1750;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
bool gotWifiCreds = false;
bool captureInProgress = false;

// CAM link
unsigned long lastCapture = 0;
bool pendingCapture = false;  // Set by MQTT or button/screen trigger

//Pump
bool pumpActive = false;
unsigned long pumpStartTime = 0;
unsigned long lastCommandPoll = 0;

// Timers
unsigned long lastSensorRead = 0;

void setup() {
  Serial.begin(115200);

  // PINS
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(DHT_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, HIGH);  // Active LOW — ensure pump is OFF on boot
  dht22.begin();
  setupSensors();
  ds18b20.begin();

  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  // Screen booting
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  showLogo(66, 20);
  delay(2000);

  Serial2.setRxBufferSize(4096);
  Serial2.begin(CAM_UART_BAUD, SERIAL_8N1, CAM_RX_PIN, CAM_TX_PIN);
  Serial.println("CAM link ready on GPIO16/17");

  // Verify CAM is alive
  delay(3000);  // Wait for CAM to fully boot

  Serial2.println("PING");
  unsigned long pingTimeout = millis();
  String response = "";

  while (millis() - pingTimeout < 2000) {
    if (Serial2.available()) {
      char c = Serial2.read();
      if (c == '\n') break;
      if (c != '\r') response += c;
    }
  }

  response.trim();
  if (response == "OK") {
    Serial.println("CAM responded to PING — link confirmed");
  } else {
    Serial.println("CAM not responding — response was: [" + response + "]");
  }

  // Checking for WiFi creds
  pref.begin("wifi-creds", true);
  String ssid = pref.getString("ssid", "");
  String pass = pref.getString("pass", "");
  String email = pref.getString("email", "");
  pref.end();

  printPrefs();

  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS mount failed");
  } else {
    Serial.printf("SPIFFS mounted — %u KB free\n", SPIFFS.totalBytes() / 1024);
  }

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

    if (email != "") {
      HTTPClient http;
      String macStr = WiFi.macAddress();
      macStr.replace(":", "");

      String regUrl = "http://" + getServerIP() + ":8000/devices/register";
      http.begin(regUrl);
      http.addHeader("Content-Type", "application/json");

      StaticJsonDocument<200> regDoc;
      regDoc["mac_address"] = macStr;
      regDoc["email"] = email;

      String regPayload;
      serializeJson(regDoc, regPayload);

      int httpCode = http.POST(regPayload);
      if (httpCode == 200 || httpCode == 201) {
        Serial.println("Device successfully registered to user: " + email);
      } else {
        Serial.printf("Device registration failed, HTTP code: %d\n", httpCode);
        showStatus("Error", "Registeration Error: Try reseting the device", TFT_RED);
        smartDelay(10000);
        ESP.restart();
      }
      http.end();
    } else {
      factoryReset();
    }
  }
}

void loop() {
  checkResetButton();

  if (!captureInProgress && millis() - lastSensorRead > SENSOR_READ_TIME) {
    float humi = dht22.readHumidity();
    float tempC = dht22.readTemperature();
    float lux = getLightLevel();
    int airQuality = getAirQuality();
    float ppm = getPPM();
    int moistureSurface = getSoilMoisture(SOIL_SURFACE_PIN);
    int moistureRoot = getSoilMoisture(SOIL_ROOT_PIN);
    moistureSurface = 82;
    moistureRoot = 92;
    ds18b20.requestTemperatures();
    delay(100);
    float soilTemp = ds18b20.getTempCByIndex(0);

    pref.begin("plant-config", true);
    String wateringMode = pref.getString("watering_mode", "manual");
    pref.end();

    checkPump(moistureRoot, wateringMode);

    if (isnan(tempC) || isnan(humi)) {
      Serial.println("Failed to read from DHT22 sensor!");
    } else {
      Serial.printf("Humidity: %.1f%% | Temp: %.1fC\n", humi, tempC);
    }

    Serial.printf("[PUMP] Active: %s | Root moisture: %d%%\n", pumpActive ? "YES" : "NO", moistureRoot);

    if (lux == -1) {
      Serial.println("Failed to read from BH1750 sensor!");
    } else {
      Serial.print("Lux: ");
      Serial.print(lux);
      Serial.println(" lx");
    }

    Serial.print("Air Quality: ");
    Serial.print(airQuality);
    Serial.print("% | PPM : ");
    Serial.println(ppm);
    Serial.print("DS18B20 Temp: ");
    Serial.print(soilTemp);
    Serial.println("°C");
    Serial.printf("Env -> L:%.0f T:%.1f H:%.1f | Soil -> S:%d%% R:%d%%\n",
                  lux, tempC, humi, moistureSurface, moistureRoot);

    Serial.println("..................");
    showSensorData(tempC, humi, lux, soilTemp, moistureSurface, moistureRoot, airQuality, ppm);

    sendDataToLaptop(tempC, humi, lux, ppm, airQuality, moistureSurface, moistureRoot, soilTemp);

    lastSensorRead = millis();
  }

  // Time-based capture
  if (millis() - lastCapture > CAPTURE_INTERVAL) {
    pendingCapture = true;
  }

  // Execute capture if flagged (time-based or manual trigger)
  if (pendingCapture) {
    pendingCapture = false;
    lastCapture = millis();
    if (triggerCapture()) {
      Serial.println("Capture successful — ready to upload");
    } else {
      Serial.println("Capture failed");
    }
  }

  // Command polling — independent of sensor read timer
  if (millis() - lastCommandPoll > COMMAND_POLL_INTERVAL) {
    pollForCommands();
    lastCommandPoll = millis();
  }
}
