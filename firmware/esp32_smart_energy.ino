/*
 * Smart Energy Monitoring System - ESP32 Firmware
 * 
 * Target: ESP32 DevKit v1 / v4
 * Simulation: Wokwi (https://wokwi.com/projects/477019972049778689)
 * 
 * Hardware Connections:
 * - ACS712 Current Sensor OUT -> GPIO 34 (Potentiometer 1 in Wokwi)
 * - ZMPT101B Voltage Sensor OUT -> GPIO 35 (Potentiometer 2 in Wokwi)
 * - MQTT Broker: broker.hivemq.com (Port 1883)
 * - Topic: mikey/energy/data
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ---------- Network & MQTT Configuration ----------
const char* WIFI_SSID   = "Wokwi-GUEST";
const char* WIFI_PASS   = "";
const char* MQTT_SERVER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* TOPIC       = "mikey/energy/data";   // Topic subscribed by Web Dashboard

// ---------- Analog Sensor Pins ----------
const int   PIN_CURRENT = 34;   // Stand-in for ACS712 (0-5A Hall-effect sensor)
const int   PIN_VOLTAGE = 35;   // Stand-in for ZMPT101B (0-300V AC Voltage sensor)

// ---------- Sensor Calibration Constants ----------
const float ACS_SENS    = 0.185;  // 185 mV/A sensitivity for ACS712-5A module
const float MAX_AMPS    = 5.0;    // Maximum current range (A)
const float MAX_VOLTS   = 300.0;  // Full-scale calibrated AC voltage (V)
const float TARIFF      = 8.0;    // Default tariff in ₹/kWh (configurable on dashboard)
const unsigned long PUBLISH_MS = 2000; // Telemetry publish rate: every 2 seconds

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

float kwh = 0.0;
unsigned long lastPublish = 0;
unsigned long lastCalc = 0;

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected successfully!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    String clientId = "ESP32-Energy-" + String(random(0xffff), HEX);
    Serial.print("Attempting MQTT connection as ");
    Serial.println(clientId);
    
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("Connected to HiveMQ Broker!");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(". Retrying in 1.5 seconds...");
      delay(1500);
    }
  }
}

// 20-sample oversampling filter for smooth, noise-free analog readings
float readAvg(int pin) {
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += analogRead(pin);
    delayMicroseconds(50);
  }
  return sum / 20.0;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 12-bit ADC (0 - 4095)
  connectWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  lastCalc = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();

  // Read ACS712 Current Sensor
  // Potentiometer center (1.65V) represents 0 Amps quiescent voltage
  float vAdcCurrent = readAvg(PIN_CURRENT) * 3.3 / 4095.0;
  float amps = fabs((vAdcCurrent - 1.65) / (ACS_SENS * (3.3 / 5.0)));
  if (amps > MAX_AMPS) amps = MAX_AMPS;
  if (amps < 0.05) amps = 0.0; // Cut off noise floor

  // Read ZMPT101B Voltage Sensor
  float volts = readAvg(PIN_VOLTAGE) * MAX_VOLTS / 4095.0;

  // Calculate Real-time Active Power (P = V * I)
  float watts = volts * amps;

  // Accumulate Energy (kWh = Watts * hours / 1000 = Watts * seconds / 3.6e6)
  unsigned long now = millis();
  kwh += watts * (now - lastCalc) / 3.6e9;
  lastCalc = now;

  // Publish to HiveMQ broker every 2 seconds
  if (now - lastPublish >= PUBLISH_MS) {
    lastPublish = now;
    char msg[256];
    snprintf(msg, sizeof(msg),
      "{\"v\":%.1f,\"i\":%.2f,\"p\":%.1f,\"kwh\":%.5f,\"cost\":%.3f,\"ts\":%lu}",
      volts, amps, watts, kwh, kwh * TARIFF, now);
    
    mqtt.publish(TOPIC, msg);
    Serial.print("Published to [");
    Serial.print(TOPIC);
    Serial.print("]: ");
    Serial.println(msg);
  }
}
