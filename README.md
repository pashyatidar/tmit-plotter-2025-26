# TMIT Plotter 2025-26

A real-time telemetry visualization tool developed for the **TMIT Avionics Team**.

This application is used to monitor, plot, and analyze GPS and sensor data from embedded systems (Arduino-based), with a modern web interface powered by 3D mapping and interactive charts.

---

## 🚀 Features

* 📍 **Real-time GPS tracking**
* 🌍 **3D map visualization (Deck.gl)**
* 📡 **Telemetry data plotting**
* 🔌 **Arduino integration for live data**
* 🧪 **Testing environment (`arduino_test`)**
* ⚡ Built with modern web stack (Next.js + React)

---

## 🛠️ Tech Stack

* **Frontend:** Next.js, React
* **Styling:** Tailwind CSS
* **Visualization:** Deck.gl (3D maps)
* **Hardware:** Arduino (telemetry source)
* **Other:** TypeScript

---

## 📂 Project Structure

```bash
tmit-plotter-2025-26/
│── app/              # Main Next.js application
│── public/           # Static assets
│── arduino_test/     # Arduino test scripts & data
│── download_tiles.py # Map tile downloader (offline support)
│── package.json      # Dependencies & scripts
│── next.config.mjs   # Next.js config
│── tailwind.config.ts
│── tsconfig.json
```

---

## ⚙️ Installation

```bash
git clone https://github.com/pashyatidar/tmit-plotter-2025-26.git
cd tmit-plotter-2025-26
npm install
npm run dev
```

App will run at:
👉 http://localhost:3000

---

## 🔌 Hardware Integration

* Connect Arduino device sending telemetry (GPS, sensors)
* Ensure correct serial/communication setup
* Use test scripts in `/arduino_test` for debugging

---

## 📈 Usage

1. Start the app
2. Connect telemetry source
3. View live position on 3D map
4. Analyze plotted data

---

## 📦 Additional Tools

* `download_tiles.py`
  → Used to cache map tiles for offline usage

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Authors

* TMIT Avionics Team
* Contributors

---

## ⚠️ Disclaimer

This project is under active development for avionics testing and research.
Features and structure may change frequently.
