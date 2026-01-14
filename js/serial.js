/**
 * js/serial.js
 * Manages Web Serial API connections, data reading, and command transmission.
 */

import { appState, createEmptyUplotData, createEmptyMaxValues } from './state.js';
import { MockSerialPort } from './mock-device.js';
import { processSerialLine } from './parsers.js';
import { 
    updateStatusDisplay, 
    updateFSMDisplay, 
    updateFlightMapMarker, 
    updateStatsDisplay,
    showPage
} from './ui.js';
import { 
    setupChartInstances, 
    updateAllPlots, 
    destroyAllPlots 
} from './plotting.js';
import { downloadDataAsCSV } from './utils.js';

// --- Connection Logic ---

export async function connectToSerial(mode) {
    appState.currentMode = mode;

    appState.availableSeries = [];
    if (mode === 'motorTest') {
        appState.availableSeries = ['thrust', 'pressure'];
    } else if (mode === 'hydrostaticTest') {
        const selectors = [
            document.getElementById('serialCol1'),
            document.getElementById('serialCol2'),
            document.getElementById('serialCol3')
        ];
        selectors.forEach(sel => {
            if (sel && sel.value !== 'none') appState.availableSeries.push(sel.value);
        });
    }

    try {
        let port;
        try {
            port = await navigator.serial.requestPort();
        } catch (err) {
            console.log("No port selected or cancelled. Asking for simulation...");
            if (confirm("No serial port selected. Switch to 'Simulation Mode' for testing?")) {
                port = new MockSerialPort(mode);
            } else {
                return;
            }
        }

        await port.open({ baudRate: 9600 });
        appState.port = port;

        if (!(port instanceof MockSerialPort)) {
            appState.lastConnectedPortInfo = port.getInfo();
            localStorage.setItem('lastConnectedPortInfo', JSON.stringify(appState.lastConnectedPortInfo));
        }

        if (appState.reconnectInterval) {
            clearInterval(appState.reconnectInterval);
            appState.reconnectInterval = null;
        }

        appState.isSerialConnected = true;
        appState.isPlotting = false;
        appState.randomPlotting = false;
        appState.keepReading = true;

        if (mode === 'motorTest') updateFSMDisplay('BOOT');
        
        showPage('plottingPage', () => {
            setupChartInstances();
            
            // HIDE THEME TOGGLE WHEN PLOTTING STARTS
            document.getElementById('themeToggle').style.display = 'none';

            const statusText = (port instanceof MockSerialPort) ? 'Status: Connected (Simulated)' : 'Status: Connected';
            updateStatusDisplay(mode, statusText);

            // SHOW CONTROL BUTTONS
            document.getElementById('downloadCsvButton').style.display = 'inline-block';
            document.getElementById('restartSerialButton').style.display = 'inline-block';
            document.getElementById('resetSerialButton').style.display = 'inline-block';

            restartSerialPlotting();
            readSerialData(); 
            
            if (appState.serialUpdateInterval) clearInterval(appState.serialUpdateInterval);
            appState.serialUpdateInterval = setInterval(updateFromBuffer, 50);
        });

    } catch (error) {
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to device.');
        showPage(`${mode}Page`);
        
        appState.lastConnectedPortInfo = null;
        appState.isSerialConnected = false;
        appState.port = null;
    }
}

async function readSerialData() {
    const { port } = appState;
    if (!port || !port.readable) return;

    const textDecoder = new TextDecoderStream();
    let readableStreamClosed;
    
    try {
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        appState.reader = textDecoder.readable.getReader();

        let lineBuffer = '';

        while (true) {
            if (!appState.keepReading) break;
            
            const { value, done } = await appState.reader.read();
            if (done) break;
            if (!value) continue;

            lineBuffer += value;
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || ''; 

            for (const line of lines) {
                if (line.trim()) appState.serialBuffer.push(line.trim());
            }
        }
    } catch (error) {
        if (appState.keepReading) console.error('Error reading serial:', error);
    } finally {
        await handleDisconnect(readableStreamClosed);
    }
}

async function handleDisconnect(readableStreamClosed) {
    const wasConnected = appState.isSerialConnected;
    const mode = appState.currentMode;

    appState.isSerialConnected = false;
    
    if (appState.serialUpdateInterval) {
        clearInterval(appState.serialUpdateInterval);
        appState.serialUpdateInterval = null;
    }

    if (appState.reader) {
        try {
            await appState.reader.cancel().catch(() => {});
            appState.reader.releaseLock();
        } catch (e) { console.warn(e); }
        appState.reader = null;
    }

    if (readableStreamClosed) await readableStreamClosed.catch(() => {});
    
    if (appState.port) {
        try { await appState.port.close(); } catch (e) { console.warn(e); }
        appState.port = null;
    }

    // Auto-download data if we were connected
    if (wasConnected && appState.serialData.length > 0) {
        console.log("Auto-downloading data...");
        downloadDataAsCSV();
        rescalePlotsOnDisconnect();
    }

    if (mode === 'motorTest') updateFSMDisplay('--');

    if (appState.lastConnectedPortInfo && appState.keepReading) {
        updateStatusDisplay(mode, 'Status: Disconnected. Attempting to reconnect...');
        if (!appState.reconnectInterval) attemptReconnect();
    } else {
        updateStatusDisplay(mode, 'Status: Disconnected');
        if (!appState.keepReading) {
            localStorage.removeItem('lastConnectedPortInfo');
            appState.lastConnectedPortInfo = null;
        }
    }
}

function rescalePlotsOnDisconnect() {
    console.log("Rescaling plots to full history...");
    updateAllPlots();
}

/**
 * Consumes data from the buffer, parses it, and updates application state.
 */
function updateFromBuffer() {
    if (appState.serialBuffer.length === 0 || !appState.isSerialConnected) return;

    const pointsToProcess = appState.serialBuffer.splice(0, appState.serialBuffer.length);
    let plotNeedsUpdate = false;

    pointsToProcess.forEach(line => {
        const result = processSerialLine(
            line, 
            appState.currentMode, 
            appState.flightConfig, 
            appState.availableSeries
        );

        if (!result) return;

        if (result.type === 'fsm') {
            handleFSMState(result.payload);
            return;
        }

        const data = result.payload;
        if (typeof data.timestamp !== 'number' || isNaN(data.timestamp)) return;

        // Use the RAW timestamp from the device (converted to seconds for uPlot)
        const timeInSeconds = data.timestamp / 1000;

        appState.serialData.push(data);
        const { uplotData } = appState;

        uplotData.time.push(timeInSeconds);

        if (appState.currentMode === 'rocketFlight') {
            uplotData.gps_lat.push(data.gps_lat ?? null);
            uplotData.gps_lon.push(data.gps_lon ?? null);
            uplotData.pressure.push(data.pressure ?? null);
            uplotData.acc_x.push(data.acc_x ?? null);
            uplotData.acc_y.push(data.acc_y ?? null);
            uplotData.acc_z.push(data.acc_z ?? null);
            uplotData.gyro_x.push(data.gyro_x ?? null);
            uplotData.gyro_y.push(data.gyro_y ?? null);
            uplotData.gyro_z.push(data.gyro_z ?? null);

            updateFlightMapMarker(data.gps_lat, data.gps_lon);
        } else {
            uplotData.thrust.push(data.thrust ?? null);
            uplotData.pressure.push(data.pressure ?? null);
            uplotData.temperature.push(data.temperature ?? null);
            
            updateStatsDisplay(data, timeInSeconds);
        }
        plotNeedsUpdate = true;
    });

    if (plotNeedsUpdate) updateAllPlots();
}

export async function sendSerialCommand(command) {
    if (!appState.port || !appState.port.writable) return;
    
    const encoder = new TextEncoder();
    const writer = appState.port.writable.getWriter();
    try {
        await writer.write(encoder.encode(command + '\r\n'));
        console.log(`Sent: ${command}`);
    } catch (e) {
        console.error("Write error:", e);
    } finally {
        writer.releaseLock();
    }
}

export function sendGuaranteedCommand(command, expectedState) {
    if (appState.isRetryingCommand) {
        alert("Command in progress...");
        return;
    }

    toggleCommandButtons(true);
    
    appState.waitingForState = expectedState;
    appState.isRetryingCommand = true;
    
    let attempt = 0;
    const maxAttempts = 5;
    const baseDelay = 500;

    const trySend = () => {
        if (!appState.isRetryingCommand) return;
        
        sendSerialCommand(command);
        attempt++;

        if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt - 1) * baseDelay + (Math.random() * 100);
            appState.commandTimeout = setTimeout(trySend, delay);
        } else {
            const el = document.getElementById(`${appState.currentMode}Status`);
            if (el) {
                el.textContent = `Error: Timeout waiting for ${expectedState}`;
                el.classList.add('error');
            }
            appState.isRetryingCommand = false;
            appState.waitingForState = null;
            toggleCommandButtons(false);
        }
    };
    trySend();
}

function handleFSMState(state) {
    updateFSMDisplay(state);

    if (appState.waitingForState && state === appState.waitingForState) {
        console.log(`State confirmed: ${state}`);
        clearTimeout(appState.commandTimeout);
        appState.isRetryingCommand = false;
        appState.waitingForState = null;
        toggleCommandButtons(false);
    }

    if (state === 'ARMED' || state === 'LAUNCHED') {
        restartSerialPlotting();
    }
}

function toggleCommandButtons(disabled) {
    const btns = ['cmdArm', 'cmdDisarm', 'cmdLaunch'];
    btns.forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = disabled;
    });
}

export function restartSerialPlotting() {
    appState.uplotData = createEmptyUplotData();
    appState.serialData = [];
    appState.serialBuffer = [];
    appState.maxValues = createEmptyMaxValues();
    appState.startTime = performance.now();
    updateAllPlots();
}

function attemptReconnect() {
    if (appState.reconnectInterval) clearInterval(appState.reconnectInterval);
    
    appState.reconnectInterval = setInterval(async () => {
        if (appState.isSerialConnected || !appState.lastConnectedPortInfo || !appState.keepReading) {
            clearInterval(appState.reconnectInterval);
            appState.reconnectInterval = null;
            return;
        }

        try {
            const ports = await navigator.serial.getPorts();
            const match = ports.find(p => {
                const info = p.getInfo();
                return info.usbVendorId === appState.lastConnectedPortInfo.usbVendorId &&
                       info.usbProductId === appState.lastConnectedPortInfo.usbProductId;
            });

            if (match) {
                console.log("Device found, reconnecting...");
                clearInterval(appState.reconnectInterval);
                appState.reconnectInterval = null;
                connectToSerial(appState.currentMode); 
            }
        } catch (e) {
            console.error("Reconnect error:", e);
        }
    }, 2000);
}