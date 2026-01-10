/**
 * js/utils.js
 * Shared utility functions.
 */

import { appState } from './state.js';

/**
 * Returns color codes based on the current theme (light/dark).
 * Used by plotting logic to style charts.
 */
export function getThemeColors() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return {
        axes: isDarkMode ? '#ffffff' : '#333',
        grid: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        labels: isDarkMode ? '#ffffff' : '#333',
    };
}

/**
 * Toggles full-screen mode for the document.
 */
export function toggleFullScreen() {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
        if (doc.requestFullscreen) doc.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

/**
 * Exports the currently logged data (Serial or Random) to a CSV file.
 * Automatically handles filename generation and headers based on the current mode.
 */
export function downloadDataAsCSV() {
    let dataToDownload = [];
    let filename = "plot-data.csv";
    let headers = [];

    let dataAvailable = false;
    let sourceMode = appState.currentMode;
    
    const isSerialDataSource = ['motorTest', 'hydrostaticTest', 'rocketFlight'].includes(sourceMode);

    // 1. Determine Source Data
    if (isSerialDataSource && appState.serialData.length > 0) {
        dataToDownload = [...appState.serialData]; 
        const dateStr = new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
        filename = `${sourceMode}-log-${dateStr}.csv`; 

        if (sourceMode === 'rocketFlight') {
            headers = ['timestamp']; 
            if (appState.flightConfig.gps) headers.push('gps_lat', 'gps_lon');
            if (appState.flightConfig.pressure) headers.push('pressure');
            if (appState.flightConfig.acceleration) headers.push('acc_x', 'acc_y', 'acc_z');
            if (appState.flightConfig.gyroscope) headers.push('gyro_x', 'gyro_y', 'gyro_z');
        } else if (sourceMode === 'motorTest') {
             headers = ['timestamp', 'thrust', 'pressure']; 
        } else if (sourceMode === 'hydrostaticTest') {
            headers = ['timestamp', ...appState.availableSeries]; 
        }
        dataAvailable = true;

    } else if (appState.randomPlotting && appState.randomDataLog.length > 0) {
        dataToDownload = [...appState.randomDataLog]; 
        const dateStr = new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
        filename = `random-log-${dateStr}.csv`;
        headers = ['timestamp', 'pressure', 'thrust', 'temperature']; 
        dataAvailable = true;
    }

    if (!dataAvailable) {
        // Only alert if we are in a context where a user might expect a download
        if (!appState.isSerialConnected && !appState.randomPlotting && !document.hidden) {
             alert("No data was logged to download.");
        }
        return;
    }

    // 2. Construct CSV String
     let csvContent = headers.join(",") + "\n";
     csvContent += dataToDownload.map(row => {
        if (!row) return '';
        return headers.map(header => {
             const value = row[header];
             if (value === false) return 'false';
             return (value === undefined || value === null) ? '' : value;
         }).join(",");
     }).filter(line => line).join("\n"); 

    // 3. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); 
        console.log(`CSV downloaded: ${filename}`);
    } else {
         console.error("Download attribute not supported. Could not download CSV.");
         alert("Could not automatically download CSV. Your browser might not support this feature.");
    }
}