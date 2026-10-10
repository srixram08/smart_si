# Smart Energy Monitoring System (IoT + ESP32 + Wokwi)

A production-grade, 3D interactive web application for real-time AC electricity monitoring, active power analytics, and deterministic bill forecasting.

---

## 🌟 Key Features

1. **Stunning 3D Visualizers**:
   - **Hero Holographic Energy Core**: Interactive Three.js particle swarm and quantum field orbiting with mouse parallax.
   - **Dashboard Dynamic Power Reactor**: Real-time 3D toroidal core whose rotation speed, plasma glow, and particle vortex dynamically mirror live active wattage ($P$).
2. **Seamless Wokwi Cloud Simulation Integration**:
   - Fully connected to the Wokwi ESP32 Project: [https://wokwi.com/projects/477019972049778689](https://wokwi.com/projects/477019972049778689)
   - Reads 2-second telemetry packets over HiveMQ WebSocket (`wss://broker.hivemq.com:8884/mqtt`).
   - Built-in ESP32 Potentiometer Hardware Simulator for instant local demonstration even when offline.
3. **Five Live Metric Cards (Top Row)**:
   - **Voltage (V)**: Nominal reference deviation, status badges (Normal / High Surge / Brownout).
   - **Current (A)**: Rated limit capacity bar (0 - 5.0A full scale), peak current.
   - **Active Power (W)**: Instantaneous $P = V \times I$ with color states (Green <1500W, Amber 1500-3000W, Red >3000W).
   - **Accumulated Energy (kWh)**: High-resolution kWh counter with instant Reset option.
   - **Estimated Cost (₹)**: Instant billing based on configured tariff.
4. **Dual High-Tech Gauges**:
   - **SVG Radial Power Gauge (0 - 5000 W)**: Graduated Safe (0-1.5kW), Warning (1.5-3kW), and Danger (3kW+) zones with illuminated sweeping needle.
   - **Current Capacity Gauge (0 - 5.0 A)**: Real-time % rated limit indicator with overload alert.
5. **Chart.js Real-time Trend Analytics**:
   - Live cubic-spline Power (Watts) curve with area gradient fill.
   - 1-minute, 3-minute, and 5-minute rolling window selectors.
   - Dual-axis Voltage (V) & Current (A) comparison chart.
   - Min, Average, and Peak power summary pills.
6. **Deterministic Tariff & Bill Forecasting Engine**:
   - Interactive slider and number input (₹ 1.0 to ₹ 25.0 / kWh).
   - Real-time cost run rate: Cost/Hour, Projected Cost/Day (₹/day), Projected Cost/Month (₹/month).
   - Usage Budget Tracker: Progress bar with % quota consumed and remaining allowance.
7. **Proactive Smart Alerts Engine**:
   - Web Audio API synthesizer chimes for alarms.
   - Real-time sliding banner for over-power, overvoltage (>250V), undervoltage (<195V), and high current (>4.8A).
   - Timestamped alert events log with one-click acknowledge.
8. **Live Telemetry Stream Table & CSV Export**:
   - Rolling table of the 20 most recent readings.
   - One-click RFC-compliant CSV download of all logged telemetry points.
9. **Cyberpunk Dark & Clean Light Themes**:
   - Toggle between high-contrast dark neon mode and clean daylight mode.

---

## 🛠️ Hardware & Pinout Setup

| Sensor / Module | Stand-In in Wokwi | ESP32 Pin | Engineering Unit Conversion |
| :--- | :--- | :--- | :--- |
| **ACS712-5A** (Current) | Potentiometer 1 (`pot1`) | `GPIO 34` (ADC1_CH6) | $V_{adc} = \text{ADC} \times \frac{3.3}{4095.0}$, $I = \frac{\|V_{adc} - 1.65\|}{0.185 \times (3.3 / 5.0)}$ |
| **ZMPT101B** (AC Voltage) | Potentiometer 2 (`pot2`) | `GPIO 35` (ADC1_CH7) | $V = \text{ADC} \times \frac{300.0}{4095.0}$ |
| **Active Power** | Calculated in Firmware | — | $P = V \times I$ |
| **Accumulated Energy** | Calculated in Firmware | — | $\text{kWh} += \frac{P \times \Delta t}{3.6 \times 10^9}$ |

---

## 🚀 How to Run Locally

### Option 1: Using the Built-in Node Server
```bash
node server.js
```
Then navigate to: **[http://localhost:3000/](http://localhost:3000/)**

### Option 2: Direct Browser Launch
Simply double-click `index.html` in your file explorer to open it in any modern browser!

---

## 📡 Live MQTT Configuration

- **Broker (TCP - ESP32 Firmware)**: `broker.hivemq.com` : `1883`
- **Broker (WebSockets - Web Dashboard)**: `wss://broker.hivemq.com:8884/mqtt`
- **Topic**: `mikey/energy/data`
- **Telemetry Payload (JSON)**:
  ```json
  {
    "v": 230.4,
    "i": 2.45,
    "p": 564.5,
    "kwh": 0.04218,
    "cost": 0.337,
    "ts": 1791647081
  }
  ```

# smart_si
