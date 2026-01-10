# <img src="img/logo-symbol-black.png" width="40" height="40" align="top"> thrustMIT's Plotter

**TMIT-Plotter** is a high-performance, real-time data visualization dashboard designed for rocketry avionics and propulsion testing. It supports post-flight analysis via CSV and live telemetry streaming via the Web Serial API.

![Status](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Built%20With-HTML5%20%7C%20JS%20%7C%20uPlot-blue)

---

## 🚀 Features

### 1. Multi-Mode Data Analysis
The plotter operates in distinct modes tailored to specific engineering phases:

* **📈 CSV Plotter:** Drag-and-drop interface for analyzing past test data. Supports flexible timestamp formats (ms/s).
* **🔥 Motor Test Mode:** dedicated real-time dashboard for static fire tests. Fixed layout for **Thrust (N)** and **Pressure (hPa)** with safety status indicators (FSM State, Arm/Disarm).
* **🚀 Rocket Flight Mode:** Telemetry visualization including:
    * **GPS Tracking:** Integrated Leaflet map for live location.
    * **IMU Data:** 6-DOF Acceleration and Gyroscope plotting.
    * **Calculated Stats:** Max altitude, velocity, and flight phase detection.
* **💧 Hydrostatic Test Mode:** Fully configurable serial parser for custom sensor setups.
* **🎲 Random Data Mode:** Simulation mode for UI testing and demonstration.

### 2. High-Performance Visualization
* **uPlot Library:** Renders thousands of data points at 60fps without lag.
* **Dynamic UI:** Toggle between Light and Dark themes.
* **Live Stats:** "Stat Cards" providing real-time Current vs. Max values.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Variables for theming), Vanilla JavaScript (ES6 Modules).
* **Charting Engine:** [uPlot](https://github.com/leeoniya/uPlot) - Extremely fast time-series charting.
* **Maps:** [Leaflet.js](https://leafletjs.com/) - Open-source interactive maps.
* **Connectivity:** **Web Serial API** - Direct browser-to-hardware communication (no backend required).

---

## 💻 How to Run

Because this project uses the **Web Serial API** and ES6 Modules, it cannot be run by simply double-clicking `index.html`. It must be served over a local server (localhost) or HTTPS.

### Option 1: VS Code (Recommended)
1.  Install the **[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)** extension.
2.  Open the project folder in VS Code.
3.  Right-click `index.html` and select **"Open with Live Server"**.

### Option 2: Python Simple Server
If you have Python installed, open your terminal in the project folder and run:

```bash
# Python 3
python -m http.server 8000
