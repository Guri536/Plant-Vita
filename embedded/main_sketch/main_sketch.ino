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

// CAM link
unsigned long lastCapture = 0;
bool pendingCapture = false;       // Set by MQTT or button/screen trigger
uint8_t imageBuffer[IMAGE_BUFFER_SIZE];


// Timers
unsigned long lastSensorRead = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("Base listening on Pin 35...");

  // PINS
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(DHT_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
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

  Serial2.begin(CAM_UART_BAUD, SERIAL_8N1, CAM_RX_PIN, CAM_TX_PIN);
  Serial.println("CAM link ready on GPIO16/17");

  // Verify CAM is alive
  Serial2.println("PING");
  delay(200);
  if (Serial2.available()) {
    String response = Serial2.readStringUntil('\n');
    response.trim();
    if (response == "OK") {
      Serial.println("CAM responded to PING — link confirmed");
    } else {
      Serial.println("CAM unexpected response: " + response);
    }
  } else {
    Serial.println("CAM not responding to PING — check wiring");
  }

  // Checking for WiFi creds
  pref.begin("wifi-creds", true);
  String ssid = pref.getString("ssid", "");
  String pass = pref.getString("pass", "");
  pref.end();

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
  }
}

void loop() {
  checkResetButton();

  // if (Serial2.available()) {
  //   char c = Serial2.read();
  //   if ((c >= 32 && c <= 126) || c == '\n' || c == '\r') {
  //     Serial.write(c);
  //   }
  // }

  if (millis() - lastSensorRead > SENSOR_READ_TIME) {
    float humi = dht22.readHumidity();
    float tempC = dht22.readTemperature();
    float lux = getLightLevel();
    int airQuality = getAirQuality();
    float ppm = getPPM();
    int moistureSurface = getSoilMoisture(SOIL_SURFACE_PIN);
    int moistureRoot    = getSoilMoisture(SOIL_ROOT_PIN);
    ds18b20.requestTemperatures();
    delay(100);
    float soilTemp = ds18b20.getTempCByIndex(0);

    if (isnan(tempC) || isnan(humi)) {
      Serial.println("Failed to read from DHT22 sensor!");
    } else {
      Serial.print("Humidity: ");
      Serial.print(humi);
      Serial.print("%");

      Serial.print("  |  ");

      Serial.print("Temperature: ");
      Serial.print(tempC);
      Serial.println("°C");
    }

    if(lux == -1){
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

    sendDataToLaptop(tempC, humi, lux, ppm, airQuality, moistureSurface, moistureRoot);

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
      // imageBuffer holds valid JPEG — next step will POST it
      Serial.println("Ready to upload image");
      // uploadImage() goes here — we'll write that next
    } else {
      Serial.println("Capture failed — will retry next interval");
    }
  }
}
