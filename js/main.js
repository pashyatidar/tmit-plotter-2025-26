/**
 * js/main.js
 * Main application entry point. Handles event bindings, 
 * CSV playback logic, and random data generation.
 */

import { appState, resetAppState, createEmptyUplotData, createEmptyMaxValues } from './state.js';
import { 
    showPage, 
    updateStatusDisplay, 
    updatePrimaryMarker, 
    setupCustomSelects, 
    triggerLaunchAnimation,
    updateStatsDisplay,
    resetStatsDisplay 
} from './ui.js';
import { 
    setupChartInstances, 
    updateAllPlots, 
    resizePlots, 
    swapMainChart, 
    updateChartStyles, 
    setupFlightPlotLayout,
    destroyAllPlots
} from './plotting.js';
import { 
    connectToSerial, 
    sendGuaranteedCommand, 
    restartSerialPlotting 
} from './serial.js';
import { parseCSV } from './parsers.js';
import { downloadDataAsCSV, toggleFullScreen, getThemeColors } from './utils.js';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI Elements
    setupCustomSelects();
    
    // 2. Load Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // 3. Navigation Events
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            const activePage = document.querySelector('.page.active');
            
            if (activePage && activePage.id === pageId) {
                document.getElementById('sidebar').classList.add('collapsed');
                return;
            }

            // Launch transition effect
            triggerLaunchAnimation();

            setTimeout(async () => {
                await performFullReset();
                showPage(pageId, () => {
                    // Specific page setup
                    if (pageId === 'rocketFlightPage') {
                        // Reset config dropdowns to defaults
                        resetFlightConfigUI();
                    }
                });
                document.getElementById('sidebar').classList.add('collapsed');
            }, 500);
        });
    });

    // 4. Bind Global Controls
    bindGlobalControls();
    
    // 5. Bind Mode-Specific Controls
    bindCsvControls();
    bindRandomControls();
    bindSerialControls();
    bindFlightConfigControls();

    // 6. Handle Window Events
    window.addEventListener('resize', resizePlots);
    
    // 7. Initial Page Load
    showPage('homePage');
    
    // 8. Auto-Reconnect Check (Hint only, as we can't trigger open() without gesture easily)
    const savedPort = localStorage.getItem('lastConnectedPortInfo');
    if (savedPort) {
        console.log("Found previous port info.");
        // We can't auto-connect fully without a user gesture in most browsers,
        // but we could update UI to prompt the user.
    }
});

// --- Event Binding Functions ---

function bindGlobalControls() {
    // Sidebar Toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        setTimeout(resizePlots, 310); // Wait for transition
    });

    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        updateChartStyles();
    });

    // Full Screen
    document.getElementById('mainContent').addEventListener('dblclick', toggleFullScreen);

    // Download / Pause / Resume
    document.getElementById('downloadCsvButton').addEventListener('click', downloadDataAsCSV);
    
    const pauseBtn = document.getElementById('pauseButton');
    const resumeBtn = document.getElementById('resumeButton');
    
    pauseBtn.addEventListener('click', () => {
        appState.isPaused = true;
        pauseBtn.disabled = true;
        resumeBtn.disabled = false;
    });
    
    resumeBtn.addEventListener('click', () => {
        appState.isPaused = false;
        // Adjust start time to account for pause duration
        const lastPlottedTime = (appState.allData.length > 0 && appState.index > 0) 
            ? appState.allData[appState.index - 1].timestamp 
            : appState.plotStartTime;
        
        const elapsedTimeInData = lastPlottedTime - appState.plotStartTime;
        appState.startTime = performance.now() - elapsedTimeInData;
        
        requestAnimationFrame(plotCSVInterval);
        pauseBtn.disabled = false;
        resumeBtn.disabled = true;
    });

    // Thumbnail Clicks (Swap Main Chart)
    document.querySelectorAll('.thumbnail-chart-container').forEach(container => {
        container.addEventListener('click', () => {
            if (appState.currentMode !== 'motorTest' && !appState.randomPlotting && !appState.isSerialConnected && appState.currentMode !== 'csv') {
                return;
            }
            const seriesName = container.dataset.series;
            swapMainChart(seriesName);
        });
    });
}

function bindCsvControls() {
    const fileDropArea = document.getElementById('fileDropArea');
    const fileInput = document.getElementById('csvFile');
    const plotBtn = document.getElementById('plotButton');

    // Drag & Drop
    fileDropArea.addEventListener('click', () => fileInput.click());
    fileDropArea.addEventListener('dragover', (e) => { e.preventDefault(); fileDropArea.classList.add('dragover'); });
    fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('dragover'));
    fileDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleCsvFile({ target: fileInput });
        }
    });

    fileInput.addEventListener('change', handleCsvFile);
    plotBtn.addEventListener('click', startCsvPlotting);

    // Reset / Restart
    document.getElementById('restartCsvButton').addEventListener('click', restartCsvPlotting);
    document.getElementById('resetCsvButton').addEventListener('click', async () => {
        await performFullReset();
        showPage('csvPage');
    });
}

function bindRandomControls() {
    document.getElementById('startRandomPlotting').addEventListener('click', startRandomPlotting);
    document.getElementById('restartRandomButton').addEventListener('click', restartRandomPlotting);
    document.getElementById('resetRandomButton').addEventListener('click', async () => {
        await performFullReset();
        showPage('randomPage');
    });
}

function bindSerialControls() {
    // Connection Buttons
    document.getElementById('connectMotorTest').addEventListener('click', () => connectToSerial('motorTest'));
    document.getElementById('connectHydrostaticTest').addEventListener('click', () => connectToSerial('hydrostaticTest'));
    document.getElementById('connectRocketFlight').addEventListener('click', () => connectToSerial('rocketFlight'));

    // Reset / Restart
    document.getElementById('restartSerialButton').addEventListener('click', restartSerialPlotting);
    document.getElementById('resetSerialButton').addEventListener('click', async () => {
        const modeToRestore = appState.currentMode;
        await performFullReset();
        showPage(`${modeToRestore}Page`);
    });

    // Motor Test Commands
    document.getElementById('cmdArm').addEventListener('click', () => sendGuaranteedCommand('AT+SEND=42,3,ARM', 'ARMED'));
    document.getElementById('cmdDisarm').addEventListener('click', () => sendGuaranteedCommand('AT+SEND=42,6,DISARM', 'SAFE'));
    document.getElementById('cmdLaunch').addEventListener('click', () => {
        if (confirm("WARNING: Initiate LAUNCH sequence?")) {
            sendGuaranteedCommand('AT+SEND=42,6,LAUNCH', 'LAUNCHED');
        }
    });

    // Hydrostatic Config (Enable connect button only when col1 is selected)
    const hydroSelectors = [
        document.getElementById('serialCol1'),
        document.getElementById('serialCol2'),
        document.getElementById('serialCol3')
    ];
    hydroSelectors.forEach(sel => {
        sel.addEventListener('change', () => {
            const btn = document.getElementById('connectHydrostaticTest');
            const val1 = document.getElementById('serialCol1').value;
            btn.disabled = (val1 === 'none');
            
            // Re-init custom selects to reflect disabled states if we added logic for that
            // (The provided css/js for custom selects handles clicks, logic handles validation)
        });
    });
}

function bindFlightConfigControls() {
    const flightSelectors = [
        document.getElementById('flightCol1'), 
        document.getElementById('flightCol2'),
        document.getElementById('flightCol3'), 
        document.getElementById('flightCol4')
    ];
    
    flightSelectors.forEach(sel => {
        sel.addEventListener('change', () => {
            updateFlightConfigState();
            setupCustomSelects(document.getElementById('flightConfigGroup')); // Refresh UI state
        });
    });

    document.getElementById('flightDelimiter').addEventListener('change', updateFlightConfigState);

    document.getElementById('previewFlightLayout').addEventListener('click', () => {
        showPage('plottingPage', () => {
            setupFlightPlotLayout(true); // Preview mode
        });
    });
    
    const plotSwitchBtn = document.getElementById('plotSwitchButton');
    plotSwitchBtn.addEventListener('click', toggleFlightPlotView);
    
    // Map Coordinates Update
    document.getElementById('updatePrimaryCoordsButton').addEventListener('click', updatePrimaryMarker);
}


// --- Logic: Flight Configuration ---

function updateFlightConfigState() {
    const selectors = [
        document.getElementById('flightCol1'), 
        document.getElementById('flightCol2'),
        document.getElementById('flightCol3'), 
        document.getElementById('flightCol4')
    ];
    
    // Reset Config
    appState.flightConfig.sequence = [];
    appState.flightConfig.gps = false;
    appState.flightConfig.pressure = false;
    appState.flightConfig.acceleration = false;
    appState.flightConfig.gyroscope = false;
    
    const selectedValues = [];

    selectors.forEach(sel => {
        const val = sel.value;
        if (val && val !== 'none') {
            appState.flightConfig.sequence.push(val);
            appState.flightConfig[val] = true; // Sets specific flag to true
            selectedValues.push(val);
        }
    });

    appState.flightConfig.delimiter = document.getElementById('flightDelimiter').value;

    // Handle Dropdown Disabling (Prevent selecting same vector twice if needed, though logic permits it)
    // Update Connect Button State
    const connectBtn = document.getElementById('connectRocketFlight');
    connectBtn.disabled = appState.flightConfig.sequence.length === 0;
}

function resetFlightConfigUI() {
    const selectors = [
        document.getElementById('flightCol1'), 
        document.getElementById('flightCol2'),
        document.getElementById('flightCol3'), 
        document.getElementById('flightCol4')
    ];
    selectors.forEach(s => s.value = 'none');
    document.getElementById('flightDelimiter').value = ',';
    updateFlightConfigState();
    setupCustomSelects(document.getElementById('flightConfigGroup'));
}

function toggleFlightPlotView() {
    const rawContainer = document.getElementById('flightRawPlotsContainer');
    const calcContainer = document.getElementById('flightCalcPlotsContainer');
    const btn = document.getElementById('plotSwitchButton');

    if (appState.flightPlotLayout === 'raw') {
        appState.flightPlotLayout = 'calculated';
        rawContainer.style.display = 'none';
        calcContainer.style.display = 'flex';
        btn.title = 'Show Raw Plots';
    } else {
        appState.flightPlotLayout = 'raw';
        // Reset to flex or grid based on layout class
        const numSelected = (appState.flightConfig.pressure?1:0) + (appState.flightConfig.acceleration?1:0) + (appState.flightConfig.gyroscope?1:0);
        rawContainer.style.display = (numSelected === 3) ? 'grid' : 'flex';
        calcContainer.style.display = 'none';
        btn.title = 'Show Calculated Plots';
        
        resizePlots(); // Fix map size
    }
}


// --- Logic: CSV Plotting ---

function handleCsvFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const tsUnit = document.getElementById('timestampUnit').value;
        const result = parseCSV(e.target.result, tsUnit);
        
        if (result) {
            appState.allData = result.allData;
            appState.availableSeries = result.availableSeries;
            appState.plotStartTime = result.plotStartTime;
            
            document.getElementById('plotButton').disabled = false;
        } else {
            alert('Invalid CSV. Ensure "timestamp" column exists.');
            document.getElementById('plotButton').disabled = true;
        }
    };
    reader.readAsText(file);
}

function startCsvPlotting() {
    if (!appState.allData || appState.allData.length === 0) return;
    
    appState.isPlotting = true;
    appState.currentMode = 'csv';
    
    showPage('plottingPage', () => {
        setupChartInstances();
        restartCsvPlotting();
    });
}

function restartCsvPlotting() {
    appState.isPaused = false;
    appState.index = 0;
    appState.uplotData = createEmptyUplotData();
    appState.maxValues = createEmptyMaxValues();
    
    updateAllPlots();
    resetStatsDisplay();

    appState.startTime = performance.now();
    appState.plotStartTime = appState.allData[0].timestamp;
    
    document.getElementById('pauseButton').disabled = false;
    document.getElementById('resumeButton').disabled = true;
    document.getElementById('downloadCsvButton').style.display = 'none'; // No download for CSV playback

    requestAnimationFrame(plotCSVInterval);
}

function plotCSVInterval() {
    if (!appState.isPlotting || appState.isPaused || appState.index >= appState.allData.length) {
        if (appState.index >= appState.allData.length && appState.isPlotting) {
            console.log("CSV Playback Complete");
            appState.isPlotting = false;
            document.getElementById('pauseButton').disabled = true;
        }
        return;
    }

    const elapsedRealTime = performance.now() - appState.startTime;
    const targetTimestamp = appState.plotStartTime + elapsedRealTime;

    let pointsAdded = false;

    // Fast-forward to current time
    while (appState.index < appState.allData.length && appState.allData[appState.index].timestamp <= targetTimestamp) {
        const point = appState.allData[appState.index];
        const timeInSeconds = point.timestamp / 1000;
        const { uplotData } = appState;

        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(appState.availableSeries.includes('pressure') ? point.pressure : null);
        uplotData.thrust.push(appState.availableSeries.includes('thrust') ? point.thrust : null);
        uplotData.temperature.push(appState.availableSeries.includes('temperature') ? point.temperature : null);

        updateStatsDisplay(point, timeInSeconds);
        appState.index++;
        pointsAdded = true;
    }

    if (pointsAdded) {
        updateAllPlots();
    }

    requestAnimationFrame(plotCSVInterval);
}


// --- Logic: Random Data ---

function startRandomPlotting() {
    appState.randomPlotting = true;
    appState.currentMode = 'random';
    appState.availableSeries = ['thrust', 'pressure', 'temperature'];
    
    showPage('plottingPage', () => {
        setupChartInstances();
        restartRandomPlotting();
    });
}

function restartRandomPlotting() {
    if (appState.randomPlotInterval) clearInterval(appState.randomPlotInterval);
    
    appState.uplotData = createEmptyUplotData();
    appState.randomDataLog = [];
    appState.maxValues = createEmptyMaxValues();
    
    updateAllPlots();
    resetStatsDisplay();
    
    appState.startTime = performance.now();
    document.getElementById('downloadCsvButton').style.display = 'inline-block';

    appState.randomPlotInterval = setInterval(() => {
        const elapsedTime = (performance.now() - appState.startTime) / 1000;
        
        const p = 1013 + Math.sin(elapsedTime) * 10 + (Math.random() - 0.5) * 5;
        const th = 25 + Math.cos(elapsedTime * 0.5) * 20 + (Math.random() - 0.5) * 5;
        const temp = 40 + Math.sin(elapsedTime * 0.2) * 15 + (Math.random() - 0.5) * 3;
        
        const dataPoint = { 
            timestamp: elapsedTime * 1000, 
            pressure: p, 
            thrust: th, 
            temperature: temp 
        };

        appState.randomDataLog.push(dataPoint);
        appState.uplotData.time.push(elapsedTime);
        appState.uplotData.pressure.push(p);
        appState.uplotData.thrust.push(th);
        appState.uplotData.temperature.push(temp);

        updateStatsDisplay(dataPoint, elapsedTime);
        updateAllPlots();

    }, 100);
}


// --- Logic: Reset ---

async function performFullReset() {
    // 1. Stop Activities
    if (appState.isSerialConnected) {
        // Trigger manual disconnect logic (which handles download)
        // Since we don't have a direct 'disconnect' button function exported, 
        // we manually set flags and close.
        appState.keepReading = false;
        if (appState.port) {
            try { await appState.port.close(); } catch(e){}
            appState.port = null;
        }
    }
    
    if (appState.randomPlotInterval) {
        clearInterval(appState.randomPlotInterval);
        downloadDataAsCSV(); // Auto download random data
    }
    
    // 2. Clear State
    resetAppState();
    
    // 3. Clear Plots
    destroyAllPlots();
    resetStatsDisplay();
    
    // 4. Reset UI Buttons
    document.getElementById('plotButton').disabled = true;
    document.getElementById('pauseButton').style.display = 'none';
    document.getElementById('resumeButton').style.display = 'none';
    document.getElementById('downloadCsvButton').style.display = 'none';
    
    const restartBtns = document.querySelectorAll('[id^="restart"]');
    restartBtns.forEach(b => b.style.display = 'none');
    
    const resetBtns = document.querySelectorAll('[id^="reset"]');
    resetBtns.forEach(b => b.style.display = 'none');

    document.getElementById('csvFile').value = '';
    
    updateStatusDisplay('motorTest', 'Status: Disconnected');
    updateStatusDisplay('hydrostaticTest', 'Status: Disconnected');
    updateStatusDisplay('rocketFlight', 'Status: Disconnected');
}