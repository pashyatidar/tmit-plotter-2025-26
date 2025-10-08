# thrustMIT's Plotter

A comprehensive, web-based data visualization tool designed for real-time and post-test analysis. Built with performance in mind using the `uPlot` library, this plotter provides a versatile interface for handling data from CSV files and live serial devices, tailored for rocketry and engineering applications.

## Features

*   **Multiple Data Sources**:
    *   **CSV Plotting**: Upload `.csv` files containing timestamped data (pressure, thrust, temperature) and visualize the entire dataset or watch a real-time playback.
    *   **Live Serial Plotting**: Connect directly to serial devices using the Web Serial API, with two specialized modes:
        *   **Motor Test Mode**: A dedicated interface for ground station operations, plotting live thrust and pressure data. It includes controls to send `ARM`, `DISARM`, and `LAUNCH` commands, with visual feedback on the testbed's state.
        *   **Hydrostatic Test Mode**: A flexible interface for live testing where you can configure the data stream to map incoming serial data to pressure, thrust, or temperature plots.
    *   **Random Data Generation**: A sandbox mode to generate and plot random data, useful for demonstration and testing the plotter's capabilities.
*   **Interactive and High-Performance Visualization**:
    *   Powered by the fast and lightweight `uPlot` charting library.
    *   Dual-chart layout in live modes to display two separate metrics simultaneously.
    *   Live updates of current readings and peak values (max pressure, thrust, and temperature) with timestamps.
    *   Thumbnail plots for a quick overview of all available data streams.
    *   Smooth, real-time plotting with a sliding time window for live data.
*   **Modern User Interface**:
    *   Clean, collapsible navigation sidebar.
    *   **Light & Dark Themes**: Toggle between themes with chart styles that adapt automatically.
    *   **Full-Screen Mode**: Double-click the chart area to enter a distraction-free full-screen view.
*   **Robust Data Handling**:
    *   **Automatic Data Export**: Automatically downloads a CSV file of the logged data when a serial session ends or is disconnected.
    *   **Reliable Commands**: The Motor Test mode features a guaranteed command delivery system that retries sending critical commands until acknowledgement is received from the testbed.
    *   **Session Controls**: Easily restart plots or fully reset the application state for any mode.

## Modes of Operation

### 1. CSV Plotter

This mode allows you to visualize data from a pre-recorded `.csv` file.

1.  Navigate to the **CSV Plotter** page from the sidebar.
2.  Drag and drop your file onto the designated area, or click to browse for it.
3.  Ensure your CSV file contains a `timestamp` column and at least one of the following data columns: `pressure`, `thrust`, or `temperature`.
4.  Select whether your timestamps are in Milliseconds (ms) or Seconds (s).
5.  Click **Plot from CSV** to start a real-time playback of the data. Use the `Pause`, `Resume`, and `Restart` controls as needed.

### 2. Motor Test (Live)

Connect to a ground station for live motor test monitoring and control.

1.  Navigate to the **Motor Test** page.
2.  Click **Connect to Ground Station**. Your browser will prompt you to select a serial port.
3.  Once connected, the plotter will begin displaying live thrust and pressure data.
4.  The right-hand stats panel will show the Finite State Machine (FSM) state of the testbed (`BOOT`, `ARMED`, `LAUNCHED`, etc.).
5.  Use the `ARM`, `DISARM`, and `LAUNCH` buttons to send commands to the testbed.

### 3. Hydrostatic Test (Live)

Plot live data from a serial device with a customizable data format.

1.  Navigate to the **Hydrostatic Test** page.
2.  Use the dropdowns to define the order of data columns your device sends (e.g., Column 1 is "Pressure", Column 2 is "Temperature"). The first column is required.
3.  Click **Connect to Serial Device** and select the appropriate port.
4.  The plotter will visualize incoming data according to your configuration.

### 4. Random Data Generation

A simple mode to see the plotter in action without any external data.

1.  Navigate to the **Random Data** page.
2.  Click **Start Random Data**. The application will begin generating and plotting sample pressure, thrust, and temperature data in real-time.

## Getting Started

This is a pure client-side application and requires no installation or build steps.

1.  Clone the repository:
    ```bash
    git clone https://github.com/pashyatidar/tmit-plotter-2025-26.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd tmit-plotter-2025-26
    ```
3.  Open the `index.html` file in a modern web browser that supports the Web Serial API, such as **Google Chrome** or **Microsoft Edge**. For best results, run a local web server (e.g., using Python or a VS Code extension like Live Server) to serve the files.

## Tech Stack

*   **HTML5 / CSS3**
*   **Vanilla JavaScript (ES6+)**
*   **[uPlot.js](https://github.com/leeoniya/uPlot)**: A fast, memory-efficient, and lightweight charting library for time series data.
*   **[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)**: For direct communication with serial hardware from the browser.
