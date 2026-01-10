/**
 * js/state.js
 * Centralized state management for the application.
 */

export const appState = {
    // --- Data Storage ---
    allData: [],             // Parsed CSV data
    serialData: [],          // Log of all received serial data points
    serialBuffer: [],        // Temporary buffer for incoming serial lines
    randomDataLog: [],       // Log of generated random data

    // --- Plotting Data (uPlot friendly arrays) ---
    uplotData: createEmptyUplotData(),

    // --- Operational Flags ---
    index: 0,                // CSV playback index
    isPaused: false,
    isPlotting: false,       // CSV playback active
    isSerialConnected: false,
    randomPlotting: false,
    keepReading: true,       // Serial reader loop control
    isFirstLoad: true,
    isRetryingCommand: false,

    // --- Timings ---
    startTime: 0,
    plotStartTime: 0,

    // --- Configuration ---
    timestampUnit: 'ms',
    currentMode: 'home',
    availableSeries: [],     // Active data series (e.g., ['thrust', 'pressure'])
    
    // --- Flight Mode Specifics ---
    flightConfig: {
        sequence: [],        // Order of incoming data columns
        gps: false,
        pressure: false,
        acceleration: false,
        gyroscope: false,
        delimiter: ','
    },
    flightPlotLayout: 'raw', // 'raw' or 'calculated'
    flightPrimaryCoords: [13.345076, 74.794646],

    // --- Hardware / Connection ---
    port: null,              // SerialPort object
    reader: null,            // Stream reader
    lastConnectedPortInfo: null,

    // --- Timers & Intervals ---
    randomPlotInterval: null,
    serialUpdateInterval: null,
    reconnectInterval: null,
    commandTimeout: null,

    // --- Motor Test Tracking ---
    waitingForState: null,   // FSM state we are waiting for (ARMED, LAUNCHED)
    maxValues: createEmptyMaxValues(),
};

/**
 * Helper to initialize empty data arrays for uPlot.
 */
export function createEmptyUplotData() {
    return {
        time: [],
        pressure: [],
        thrust: [],
        temperature: [],
        acc_x: [],
        acc_y: [],
        acc_z: [],
        gyro_x: [],
        gyro_y: [],
        gyro_z: [],
        gps_lat: [],
        gps_lon: []
    };
}

/**
 * Helper to reset max value tracking.
 */
export function createEmptyMaxValues() {
    return {
        pressure: { value: -Infinity, timestamp: null },
        thrust: { value: -Infinity, timestamp: null },
        temperature: { value: -Infinity, timestamp: null }
    };
}

/**
 * Resets the transient state (data logs, buffers, plots) 
 * but preserves configuration that shouldn't change on a simple reset.
 */
export function resetAppState() {
    appState.allData = [];
    appState.uplotData = createEmptyUplotData();
    appState.serialData = [];
    appState.serialBuffer = [];
    appState.randomDataLog = [];
    
    appState.index = 0;
    appState.isPaused = false;
    appState.isPlotting = false;
    appState.randomPlotting = false;
    
    appState.maxValues = createEmptyMaxValues();
    appState.availableSeries = [];
}