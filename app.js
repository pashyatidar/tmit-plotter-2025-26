// --- MOCK SERIAL PORT FOR MACOS TESTING ---
class MockSerialPort {
    constructor(mode) {
        this.mode = mode;
        this.readable = new ReadableStream({
            start: (controller) => {
                this.controller = controller;
                this.active = true;
                this.startTime = Date.now();
                this.simulateData();
            },
            cancel: () => {
                this.active = false;
            }
        });
        this.writable = new WritableStream({
            write: (chunk) => {
                // Log commands sent to the mock device
                const cmd = new TextDecoder().decode(chunk).trim();
                console.log(`[Mock Device] Received command: ${cmd}`);
                // Handle Motor Test State Changes
                if (this.mode === 'motorTest') {
                    if (cmd.includes('ARM')) this.motorState = 'ARMED';
                    if (cmd.includes('DISARM')) this.motorState = 'SAFE';
                    if (cmd.includes('LAUNCH')) this.motorState = 'LAUNCHED';
                }
            }
        });
        
        // Internal State
        this.motorState = 'BOOT';
        this.motorSequence = ['BOOT', 'BOOT', 'SAFE', 'SAFE']; // Initial startup sequence
    }

    open(options) { return Promise.resolve(); }
    close() { this.active = false; return Promise.resolve(); }
    getInfo() { return { usbVendorId: 0, usbProductId: 0 }; }

    simulateData() {
        const encoder = new TextEncoder();
        
        const sendLine = (line) => {
            if (this.controller && this.active) {
                this.controller.enqueue(encoder.encode(line + '\n'));
            }
        };

        const loop = setInterval(() => {
            if (!this.active) {
                clearInterval(loop);
                return;
            }

            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000;
            const t_ms = now - this.startTime; // timestamp in ms

            if (this.mode === 'rocketFlight') {
                // Rocket Flight Simulation (Default Order: GPS, Pres, Acc, Gyro)
                // Users must configure the dropdowns to match this for the simulation to work correctly.
                const lat = 13.345076 + (elapsed * 0.0001);
                const lon = 74.794646 + (elapsed * 0.0001);
                const pres = 1013 - (elapsed * 2);
                const ax = Math.sin(elapsed);
                const ay = Math.cos(elapsed);
                const az = 9.8 + (Math.random() - 0.5);
                const gx = Math.random() * 0.2;
                const gy = Math.random() * 0.2;
                const gz = elapsed * 0.1;
                // Format: timestamp,lat,lon,pres,ax,ay,az,gx,gy,gz
                sendLine(`${t_ms},${lat.toFixed(6)},${lon.toFixed(6)},${pres.toFixed(2)},${ax.toFixed(2)},${ay.toFixed(2)},${az.toFixed(2)},${gx.toFixed(2)},${gy.toFixed(2)},${gz.toFixed(2)}`);

            } else if (this.mode === 'hydrostaticTest') {
                // Hydrostatic Simulation
                const val1 = 50 + 25 * Math.sin(elapsed);
                const val2 = 20 + 5 * Math.cos(elapsed);
                const val3 = 100 + (Math.random() * 10);
                // Format: timestamp,val1,val2,val3
                sendLine(`${t_ms},${val1.toFixed(2)},${val2.toFixed(2)},${val3.toFixed(2)}`);

            } else if (this.mode === 'motorTest') {
                // Motor Test Simulation (Complex FSM)
                let payload = "";
                
                // 1. Startup Sequence handling
                if (this.motorSequence.length > 0) {
                    this.motorState = this.motorSequence.shift();
                }

                // 2. Generate Message based on State
                if (['BOOT', 'SAFE', 'ARMED'].includes(this.motorState)) {
                    // +RCV=ID,LEN,STATE,-10,0
                    payload = this.motorState;
                    sendLine(`+RCV=00,${payload.length},${payload},-10,0`);
                } else if (this.motorState === 'LAUNCHED') {
                    // Simulate Thrust Data
                    let thrust = 0;
                    if (elapsed < 5) thrust = 1500; // Boost
                    else thrust = Math.max(0, 1500 - ((elapsed-5)*100)); // Coast
                    
                    const pressure = 1013 - (elapsed * 5);
                    const dataStr = `${t_ms},${thrust.toFixed(2)},${pressure.toFixed(2)}`;
                    sendLine(`+RCV=42,${dataStr.length},${dataStr},-20,0`);
                }
            }
        }, 100); // 10Hz update rate
    }
}

// data structures containing data for plotting
let allData = [];
let uplotData = {
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

// flag variables that control the operations
let index = 0;
let isPaused = false;
let isPlotting = false;
let startTime = 0;
let plotStartTime = 0;
let timestampUnit = 'ms';
let availableSeries = [];
let maxValues = {
    pressure: { value: -Infinity, timestamp: null },
    thrust: { value: -Infinity, timestamp: null },
    temperature: { value: -Infinity, timestamp: null }
};
let randomPlotting = false;
let randomPlotInterval = null;
let randomDataLog = [];
let mainPlot1 = { instance: null, series: null };
let mainPlot2 = { instance: null, series: null };
let uplotPressureThumb = null;
let uplotThrustThumb = null;
let uplotTempThumb = null;
let port = null;
let reader = null;
let isSerialConnected = false;
let serialData = []; // Stores raw data objects { timestamp: ms, ... }
let keepReading = true;
let serialBuffer = [];
let serialUpdateInterval = null;
let reconnectInterval = null;
let lastConnectedPortInfo = null;

let currentMode = 'home';
let commandTimeout = null;
let waitingForState = null;
let isRetryingCommand = false;
let launchOverlay, launchRocket;
let isFirstLoad = true;

// --- Flight Mode Variables ---
let flightConfig = {
    sequence: [], // Stores the order of data columns (e.g., ['gps', 'pressure'])
    gps: false,
    pressure: false,
    acceleration: false,
    gyroscope: false,
    delimiter: ','
};
let flightPlotLayout = 'raw'; // 'raw' or 'calculated'
let flightRawPlots = {}; // To hold uPlot instances
let flightCalcPlots = {}; // To hold uPlot instances
let flightMap = null; // Leaflet map instance
let flightRocketMarker = null; // ROCKET'S marker
let flightPrimaryMarker = null; // STATIC primary marker
let flightPrimaryCoords = [13.345076, 74.794646]; // Default primary coords
const flightAxisColors = {
    x: '#E63946', // Red
    y: '#52B788', // Green
    z: '#457B9D'  // Blue
};

// --- UI Element References ---
let sidebar, mainContent, menuToggle, pageTitle, navLinks, fileDropArea, csvFileInput,
    statsSidebar,
    plotButton, startRandomPlottingButton, pauseButton, resumeButton, downloadCsvButton,
    connectMotorTestButton, connectHydrostaticTestButton, restartCsvButton, restartRandomButton,
    restartSerialButton, resetCsvButton, resetRandomButton, resetSerialButton,
    serialConfigSelectors, themeToggle, motorTestControls, cmdArmButton, cmdDisarmButton, cmdLaunchButton,
    thumbnailContainers,
    // Flight Mode UI References
    flightPhaseDisplay, plotSwitchButton, flightPlottingArea, flightRawPlotsContainer,
    flightCalcPlotsContainer, connectRocketFlightButton, previewFlightLayoutButton,
    flightConfigSelectors, // New: Dropdowns for flight mode
    flightDelimiterSelect,
    // Found in showPage()
    flightPlotControls, flightModeColorKey, flightLatInput, flightLonInput, updatePrimaryCoordsButton;


// --- *** FLIGHT CONFIG LOGIC *** ---

const updateFlightConfigUI = () => {
    const connectBtn = document.getElementById('connectRocketFlight');
    const selectedValues = flightConfigSelectors.map(sel => sel.value);
    
    // Enable/Disable options based on selection to prevent duplicates
    flightConfigSelectors.forEach((currentSelector, currentIndex) => {
        if (!currentSelector || !currentSelector.options) return;

        Array.from(currentSelector.options).forEach(option => {
            if (option.value === 'none') {
                option.disabled = false;
                return;
            }
            // Disable if another selector has chosen this value
            option.disabled = selectedValues.some((v, i) => v === option.value && i !== currentIndex);
        });
    });
    // Update the custom dropdown UI
    setupCustomSelects(document.getElementById('flightConfigGroup'));
};

const flightConfigChanged = () => {
    // Check if elements exist
    if (flightConfigSelectors && flightDelimiterSelect) {
        // Reset config
        flightConfig.sequence = [];
        flightConfig.gps = false;
        flightConfig.pressure = false;
        flightConfig.acceleration = false;
        flightConfig.gyroscope = false;
        
        // Build sequence from dropdowns
        flightConfigSelectors.forEach(sel => {
            const val = sel.value;
            if (val && val !== 'none') {
                flightConfig.sequence.push(val);
                // Update derived flags for compatibility with plotting logic
                if (val === 'gps') flightConfig.gps = true;
                if (val === 'pressure') flightConfig.pressure = true;
                if (val === 'acceleration') flightConfig.acceleration = true;
                if (val === 'gyroscope') flightConfig.gyroscope = true;
            }
        });

        flightConfig.delimiter = flightDelimiterSelect.value;

        // Enable button if at least one data source is configured
        const anySelection = flightConfig.sequence.length > 0;
        
        if (connectRocketFlightButton) {
            connectRocketFlightButton.disabled = !anySelection;
        }
    } else {
        // Safe default
        flightConfig = {
            sequence: [],
            gps: false,
            pressure: false,
            acceleration: false,
            gyroscope: false,
            delimiter: ','
        };
        if (connectRocketFlightButton) {
             connectRocketFlightButton.disabled = true;
        }
    }
};

// --- GLOBAL FUNCTIONS ---

function updatePrimaryMarker() {
    const latInput = document.getElementById('flightLatInput');
    const lonInput = document.getElementById('flightLonInput');
    
    if (!latInput || !lonInput) return;

    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);

    if (typeof lat !== 'number' || isNaN(lat) || typeof lon !== 'number' || isNaN(lon)) {
        alert("Invalid coordinates. Please enter valid numbers.");
        latInput.value = flightPrimaryCoords[0];
        lonInput.value = flightPrimaryCoords[1];
        return;
    }
    
    flightPrimaryCoords = [lat, lon]; 

    if (!flightMap) return; 

    if (flightPrimaryMarker) {
        flightPrimaryMarker.setLatLng(flightPrimaryCoords);
    } else { 
        flightPrimaryMarker = L.marker(flightPrimaryCoords).addTo(flightMap).bindPopup('Primary Location');
    }
    
    flightMap.panTo(flightPrimaryCoords);
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    sidebar = document.getElementById('sidebar');
    mainContent = document.getElementById('mainContent');
    menuToggle = document.getElementById('menuToggle');
    pageTitle = document.getElementById('pageTitle');
    navLinks = document.querySelectorAll('.nav-link');
    fileDropArea = document.getElementById('fileDropArea');
    csvFileInput = document.getElementById('csvFile');
    statsSidebar = document.getElementById('statsSidebar');
    plotButton = document.getElementById('plotButton');
    startRandomPlottingButton = document.getElementById('startRandomPlotting');
    pauseButton = document.getElementById('pauseButton');
    resumeButton = document.getElementById('resumeButton');
    downloadCsvButton = document.getElementById('downloadCsvButton');
    connectMotorTestButton = document.getElementById('connectMotorTest');
    connectHydrostaticTestButton = document.getElementById('connectHydrostaticTest');
    restartCsvButton = document.getElementById('restartCsvButton');
    restartRandomButton = document.getElementById('restartRandomButton');
    restartSerialButton = document.getElementById('restartSerialButton');
    resetCsvButton = document.getElementById('resetCsvButton');
    resetRandomButton = document.getElementById('resetRandomButton');
    resetSerialButton = document.getElementById('resetSerialButton');
    
    // Hydrostatic Selectors
    serialConfigSelectors = [
        document.getElementById('serialCol1'),
        document.getElementById('serialCol2'),
        document.getElementById('serialCol3')
    ];
    
    // Flight Mode Selectors (New)
    flightConfigSelectors = [
        document.getElementById('flightCol1'),
        document.getElementById('flightCol2'),
        document.getElementById('flightCol3'),
        document.getElementById('flightCol4')
    ];

    themeToggle = document.getElementById('themeToggle');
    motorTestControls = document.getElementById('motorTestControls');
    cmdArmButton = document.getElementById('cmdArm');
    cmdDisarmButton = document.getElementById('cmdDisarm');
    cmdLaunchButton = document.getElementById('cmdLaunch');
    launchOverlay = document.getElementById('launch-overlay');
    launchRocket = document.getElementById('launch-rocket');
    thumbnailContainers = document.querySelectorAll('.thumbnail-chart-container');

    // Flight Mode UI References
    flightPhaseDisplay = document.getElementById('flightPhaseDisplay');
    plotSwitchButton = document.getElementById('plotSwitchButton');
    flightPlottingArea = document.getElementById('flightPlottingArea');
    flightRawPlotsContainer = document.getElementById('flightRawPlotsContainer');
    flightCalcPlotsContainer = document.getElementById('flightCalcPlotsContainer');
    connectRocketFlightButton = document.getElementById('connectRocketFlight');
    previewFlightLayoutButton = document.getElementById('previewFlightLayout');
    flightDelimiterSelect = document.getElementById('flightDelimiter');
    
    const safeAddEventListener = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    safeAddEventListener(themeToggle, 'click', () => {
        document.body.classList.toggle('dark-mode');
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
        if (isPlotting || isSerialConnected || randomPlotting) {
            updateChartStyles();
        }
    });

    showPage('homePage');
    isFirstLoad = false;

    safeAddEventListener(menuToggle, 'click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => { handleResize(); }, 310);
    });

    navLinks.forEach(link => {
        safeAddEventListener(link, 'click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            const activePage = document.querySelector('.page.active');
            const currentPageId = activePage ? activePage.id : null;
            if (pageId === currentPageId) {
                sidebar.classList.add('collapsed');
                return;
            }
            triggerTransitionAnimation();
            setTimeout(async () => {
                await fullReset(); 
                showPage(pageId); 
                sidebar.classList.add('collapsed');
            }, 500);
        });
    });

    safeAddEventListener(fileDropArea, 'click', () => csvFileInput.click());
    safeAddEventListener(fileDropArea, 'dragover', (e) => { e.preventDefault(); fileDropArea.classList.add('dragover'); });
    safeAddEventListener(fileDropArea, 'dragleave', () => fileDropArea.classList.remove('dragover'));
    safeAddEventListener(fileDropArea, 'drop', (e) => {
        e.preventDefault();
        fileDropArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            csvFileInput.files = files;
            handleFile({ target: csvFileInput });
        }
    });
    safeAddEventListener(csvFileInput, 'change', handleFile);
    safeAddEventListener(plotButton, 'click', startCsvPlotting);
    safeAddEventListener(startRandomPlottingButton, 'click', startRandomPlotting);
    safeAddEventListener(connectMotorTestButton, 'click', () => connectToSerial('motorTest'));
    safeAddEventListener(connectHydrostaticTestButton, 'click', () => connectToSerial('hydrostaticTest'));
    safeAddEventListener(downloadCsvButton, 'click', downloadDataAsCSV);
    safeAddEventListener(restartCsvButton, 'click', restartCsvPlotting);
    safeAddEventListener(restartRandomButton, 'click', restartRandomPlotting);
    safeAddEventListener(restartSerialButton, 'click', restartSerialPlotting);
    safeAddEventListener(resetCsvButton, 'click', resetCsvMode);
    safeAddEventListener(resetRandomButton, 'click', resetRandomMode);
    safeAddEventListener(resetSerialButton, 'click', resetSerialMode);
    
    // Hydrostatic Selectors
    serialConfigSelectors.forEach(selector => {
        safeAddEventListener(selector, 'change', updateSerialConfigUI);
    });
    
    // Flight Mode Selectors (Modified)
    flightConfigSelectors.forEach(selector => {
        safeAddEventListener(selector, 'change', () => {
            updateFlightConfigUI();
            flightConfigChanged();
        });
    });

    safeAddEventListener(pauseButton, 'click', () => {
        isPaused = true;
        pauseButton.disabled = true;
        resumeButton.disabled = false;
    });
    safeAddEventListener(resumeButton, 'click', () => {
        isPaused = false;
        const lastPlottedTime = allData.length > 0 && index > 0 ? allData[index - 1].timestamp : plotStartTime;
        const elapsedTimeInData = lastPlottedTime - plotStartTime;
        startTime = performance.now() - elapsedTimeInData;
        requestAnimationFrame(plotCSVInterval);
        pauseButton.disabled = false;
        resumeButton.disabled = true;
    });

    thumbnailContainers.forEach(container => {
        safeAddEventListener(container, 'click', () => {
            if (currentMode !== 'motorTest' && (currentMode === 'csv' || currentMode === 'random' || isSerialConnected)) {
                const seriesName = container.dataset.series;
                swapMainChart(seriesName);
            }
        });
    });

    safeAddEventListener(cmdArmButton, 'click', () => sendGuaranteedCommand('AT+SEND=42,3,ARM', 'ARMED'));
    safeAddEventListener(cmdDisarmButton, 'click', () => sendGuaranteedCommand('AT+SEND=42,6,DISARM', 'SAFE'));
    safeAddEventListener(cmdLaunchButton, 'click', () => {
        if (confirm("WARNING: This will initiate the LAUNCH sequence. Are you absolutely sure?")) {
            sendGuaranteedCommand('AT+SEND=42,6,LAUNCH', 'LAUNCHED'); 
        }
    });

    // Flight Mode Event Listeners
    safeAddEventListener(connectRocketFlightButton, 'click', () => connectToSerial('rocketFlight'));
    safeAddEventListener(previewFlightLayoutButton, 'click', () => {
        showPage('plottingPage', () => {
            setupFlightPlotLayout(true); 
        });
    });
    safeAddEventListener(plotSwitchButton, 'click', toggleFlightPlotView);
    safeAddEventListener(flightDelimiterSelect, 'change', flightConfigChanged);

    window.addEventListener('resize', handleResize);
    safeAddEventListener(mainContent, 'dblclick', toggleFullScreen);
    setupCustomSelects();

    // Initial Config State
    updateFlightConfigUI();
    flightConfigChanged();

    const savedPortInfo = JSON.parse(localStorage.getItem('lastConnectedPortInfo'));
    if (savedPortInfo) {
        lastConnectedPortInfo = savedPortInfo;
        console.log("Found last used port. Attempting to reconnect automatically...");
        const statusEl = document.getElementById(`${currentMode}Status`);
        if(statusEl) statusEl.textContent = 'Status: Auto-reconnecting...';
        attemptReconnect();
    }
});

function triggerTransitionAnimation() {
    if (!launchOverlay || !launchRocket || isFirstLoad) return;

    launchOverlay.style.display = 'block';
    launchRocket.classList.add('launching');

    setTimeout(() => {
        launchOverlay.style.display = 'none';
        launchRocket.classList.remove('launching');
    }, 1500);
}

function setupCustomSelects(scope = document) {
    if (!scope) scope = document; 
    scope.querySelectorAll('.select-wrapper').forEach(wrapper => {
        const oldTrigger = wrapper.querySelector('.select-trigger');
        if (oldTrigger) oldTrigger.remove();
        const oldOptions = wrapper.querySelector('.options');
        if (oldOptions) oldOptions.remove();
        const select = wrapper.querySelector('select');
        if (!select) return;
        const trigger = document.createElement('div');
        trigger.className = 'select-trigger';
        const optionsWrapper = document.createElement('div');
        optionsWrapper.className = 'options';
        Array.from(select.options).forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'option';
            optionEl.textContent = option.textContent;
            optionEl.dataset.value = option.value;
            if (option.disabled) {
                optionEl.classList.add('disabled');
            }
            optionsWrapper.appendChild(optionEl);
            if (!option.disabled) {
                optionEl.addEventListener('click', () => {
                    select.value = option.value;
                    const span = trigger.querySelector('span');
                    if (span) span.textContent = option.textContent;
                    wrapper.classList.remove('open');
                    select.dispatchEvent(new Event('change'));
                });
            }
        });
        const selectedText = select.options.length > 0 ? select.options[select.selectedIndex].textContent : '';
        trigger.innerHTML = `<span>${selectedText}</span>`;
        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsWrapper);
        trigger.addEventListener('click', () => {
            document.querySelectorAll('.select-wrapper.open').forEach(openWrapper => {
                if (openWrapper !== wrapper) {
                    openWrapper.classList.remove('open');
                }
            });
            wrapper.classList.toggle('open');
        });
    });
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.select-wrapper').forEach(wrapper => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        });
    });
}
async function sendSerialCommand(command) {
    if (!port || !port.writable) {
        console.error("Serial port not connected or not writable.");
        return;
    }
    const encoder = new TextEncoder();
    const dataToSend = encoder.encode(command + '\r\n');
    const writer = port.writable.getWriter();
    try {
        await writer.write(dataToSend);
        console.log(`Sent command: ${command}`);
    } catch (error) {
        console.error("Error sending command:", error);
    } finally {
        writer.releaseLock();
    }
}
function sendGuaranteedCommand(command, expectedState) {
    if (isRetryingCommand) {
        alert("A critical command is already in progress. Please wait.");
        return;
    }
    if (cmdArmButton) cmdArmButton.disabled = true;
    if (cmdDisarmButton) cmdDisarmButton.disabled = true;
    if (cmdLaunchButton) cmdLaunchButton.disabled = true;
    waitingForState = expectedState;
    isRetryingCommand = true;
    console.log(`Sending command and waiting for state: ${expectedState}...`);
    let attempt = 0;
    const maxAttempts = 5;
    const baseDelay = 500;
    const trySendCommand = () => {
        if (!isRetryingCommand) return;
        sendSerialCommand(command);
        attempt++;
        if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt - 1) * baseDelay;
            const jitter = delay * 0.2 * Math.random();
            console.log(`Will retry in ${(delay + jitter).toFixed(0)} ms...`);
            commandTimeout = setTimeout(trySendCommand, delay + jitter);
        } else {
            console.error(`Command timed out after ${maxAttempts} attempts.`);
            const statusEl = document.getElementById(`${currentMode}Status`);
            if (statusEl) {
                statusEl.textContent = `Error: Command for ${expectedState} timed out.`;
                statusEl.classList.add('error');
                setTimeout(() => {
                    statusEl.textContent = 'Status: Connected';
                    statusEl.classList.remove('error');
                }, 4000);
            }
            isRetryingCommand = false;
            waitingForState = null;
            if (cmdArmButton) cmdArmButton.disabled = false;
            if (cmdDisarmButton) cmdDisarmButton.disabled = false;
            if (cmdLaunchButton) cmdLaunchButton.disabled = false;
        }
    };
    trySendCommand();
}
function toggleFullScreen() {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
        if (doc.requestFullscreen) doc.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}
function handleResize() {
    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(plot => {
            if (plot.instance) {
                plot.instance.setSize({ width: plot.wrapper.clientWidth, height: plot.wrapper.clientHeight });
            }
        });
        Object.values(flightCalcPlots).forEach(plot => {
            if (plot.instance) {
                plot.instance.setSize({ width: plot.wrapper.clientWidth, height: plot.wrapper.clientHeight });
            }
        });
        
        if (flightMap) {
            setTimeout(() => {
                if (flightMap) {
                    flightMap.invalidateSize();
                }
            }, 100); 
        }
    } else {
        if (mainPlot1.instance) {
            const wrapper = document.getElementById('uplot-main-wrapper-1');
            if (wrapper) mainPlot1.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
        }
        if (mainPlot2.instance) {
            const wrapper = document.getElementById('uplot-main-wrapper-2');
            if (wrapper) mainPlot2.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
        }
        if (uplotPressureThumb) {
            const thumb = document.getElementById('pressureThumbnail')?.querySelector('.thumbnail-chart');
            if (thumb) uplotPressureThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
        }
        if (uplotThrustThumb) {
            const thumb = document.getElementById('thrustThumbnail')?.querySelector('.thumbnail-chart');
            if (thumb) uplotThrustThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
        }
        if (uplotTempThumb) {
            const thumb = document.getElementById('temperatureThumbnail')?.querySelector('.thumbnail-chart');
            if (thumb) uplotTempThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
        }
    }
}

function showPage(pageId, onPageShownCallback = null) {
    if (pageId !== 'plottingPage') {
        currentMode = pageId.replace('Page', '');
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(pageId);
    if (pageElement) pageElement.classList.add('active');

    const isPlotPage = pageId === 'plottingPage';
    const isFlightMode = currentMode === 'rocketFlight';

    flightPlotControls = document.getElementById('flightPlotControls');

    const originalPlotArea = document.getElementById('mainChartArea');
    if (isPlotPage) {
        if (isFlightMode) {
            if (originalPlotArea) originalPlotArea.style.display = 'none';
            if (flightPlottingArea) flightPlottingArea.style.display = 'flex';
            if (plotSwitchButton) plotSwitchButton.style.display = 'inline-flex';
            if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'inline-block';
            if (statsSidebar) statsSidebar.classList.add('flight-mode-active'); 
            if (flightPlotControls) flightPlotControls.style.display = 'flex'; 
            
            flightLatInput = document.getElementById('flightLatInput');
            flightLonInput = document.getElementById('flightLonInput');
            updatePrimaryCoordsButton = document.getElementById('updatePrimaryCoordsButton');
            
            if(flightLatInput) flightLatInput.value = flightPrimaryCoords[0];
            if(flightLonInput) flightLonInput.value = flightPrimaryCoords[1];
            if(updatePrimaryCoordsButton) {
                 updatePrimaryCoordsButton.removeEventListener('click', updatePrimaryMarker); 
                 updatePrimaryCoordsButton.addEventListener('click', updatePrimaryMarker);
            }
            
            const originalCallback = onPageShownCallback;
            onPageShownCallback = () => {
                if (originalCallback) originalCallback(); 
                
                if (flightMap) { 
                   setTimeout(() => {
                        if (flightMap) flightMap.invalidateSize()
                   }, 0);
                }
            };
        } else {
            if (originalPlotArea) originalPlotArea.style.display = 'flex';
            if (flightPlottingArea) flightPlottingArea.style.display = 'none';
            if (plotSwitchButton) plotSwitchButton.style.display = 'none';
            if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'none';
            if (statsSidebar) statsSidebar.classList.remove('flight-mode-active');
            if (flightPlotControls) flightPlotControls.style.display = 'none';
        }
        statsSidebar.style.display = 'flex';
    } else {
        statsSidebar.style.display = 'none';
        if (plotSwitchButton) plotSwitchButton.style.display = 'none';
        if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'none';
        if (flightPlotControls) flightPlotControls.style.display = 'none';
    }

    if (isPlotPage && currentMode === 'motorTest') {
        motorTestControls.style.display = 'block';
    } else {
        motorTestControls.style.display = 'none';
    }

    navLinks.forEach(link => {
        const linkPage = link.dataset.page;
        if (linkPage === pageId || (isPlotPage && linkPage === currentMode + 'Page')) {
            link.classList.add('active');
            pageTitle.textContent = link.textContent.trim(); 
        } else {
            link.classList.remove('active');
        }
    });

    const isPlaybackMode = (currentMode === 'csv' && isPlotting);
    const isLiveMode = (isSerialConnected || randomPlotting);

    if (downloadCsvButton) downloadCsvButton.style.display = (isLiveMode) ? 'inline-block' : 'none';
    
    if (restartCsvButton) restartCsvButton.style.display = (isPlaybackMode) ? 'inline-block' : 'none';
    if (resetCsvButton) resetCsvButton.style.display = (isPlaybackMode) ? 'inline-block' : 'none';
    
    if (restartRandomButton) restartRandomButton.style.display = (currentMode === 'random' && isLiveMode) ? 'inline-block' : 'none';
    if (resetRandomButton) resetRandomButton.style.display = (currentMode === 'random' && isLiveMode) ? 'inline-block' : 'none';
    
    if (restartSerialButton) restartSerialButton.style.display = (isSerialConnected) ? 'inline-block' : 'none';
    if (resetSerialButton) resetSerialButton.style.display = (isSerialConnected) ? 'inline-block' : 'none';
    
    if (pauseButton) pauseButton.style.display = (isPlaybackMode) ? 'inline-block' : 'none';
    if (resumeButton) resumeButton.style.display = (isPlaybackMode) ? 'inline-block' : 'none';

    if (onPageShownCallback) requestAnimationFrame(onPageShownCallback);
}

function destroyFlightPlots() {
    Object.values(flightRawPlots).forEach(plot => {
        if (plot.instance) plot.instance.destroy();
    });
    flightRawPlots = {};
    Object.values(flightCalcPlots).forEach(plot => {
        if (plot.instance) plot.instance.destroy();
    });
    flightCalcPlots = {};
    if (flightRawPlotsContainer) flightRawPlotsContainer.innerHTML = '';
    if (flightCalcPlotsContainer) flightCalcPlotsContainer.innerHTML = '';

    if (flightMap) {
        flightMap.remove();
        flightMap = null;
    }
    flightRocketMarker = null; 
    flightPrimaryMarker = null; 
}

async function fullReset() {
    triggerAutoDownload(); 
    localStorage.removeItem('lastConnectedPortInfo');
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    lastConnectedPortInfo = null;
    if (randomPlotInterval) {
        clearInterval(randomPlotInterval);
        randomPlotInterval = null;
    }
    randomPlotting = false;
    isPlotting = false;
    isPaused = false;
    if (port) {
        keepReading = false;
        if (reader) {
             reader = null; 
        }
        port = null; 
    }

    allData = [];
    availableSeries = [];
    serialData = [];
    serialBuffer = [];
    randomDataLog = []; 
    resetUplotData(); 

    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }
    destroyFlightPlots(); 

    resetMaxValues();
    if (plotButton) plotButton.disabled = true;
    if (pauseButton) pauseButton.style.display = 'none';
    if (resumeButton) resumeButton.style.display = 'none';
    if (downloadCsvButton) downloadCsvButton.style.display = 'none';
    if (restartCsvButton) restartCsvButton.style.display = 'none';
    if (restartRandomButton) restartRandomButton.style.display = 'none';
    if (restartSerialButton) restartSerialButton.style.display = 'none';
    if (resetCsvButton) resetCsvButton.style.display = 'none';
    if (resetRandomButton) resetRandomButton.style.display = 'none';
    if (resetSerialButton) resetSerialButton.style.display = 'none';
    if (flightPlotControls) flightPlotControls.style.display = 'none';

    serialConfigSelectors.forEach(sel => { if(sel) sel.value = 'none'; });

    // Reset Flight Config Selectors
    flightConfigSelectors.forEach(sel => { if(sel) sel.value = 'none'; });
    if (flightDelimiterSelect) flightDelimiterSelect.value = ',';
    
    flightPlotLayout = 'raw';
    flightRocketMarker = null; 
    flightPrimaryMarker = null; 
    
    flightPrimaryCoords = [13.345076, 74.794646];
    
    // Call config change to update UI state
    updateFlightConfigUI();
    flightConfigChanged(); 

    setupCustomSelects(); 
    if(document.getElementById('motorTestStatus')) document.getElementById('motorTestStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('hydrostaticTestStatus')) document.getElementById('hydrostaticTestStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('rocketFlightStatus')) document.getElementById('rocketFlightStatus').textContent = 'Status: Disconnected';
    if(motorTestControls) motorTestControls.style.display = 'none';
    const fsmStateElement = document.getElementById('fsmState');
    if(fsmStateElement) fsmStateElement.textContent = 'FSM State: --';
    if(csvFileInput) csvFileInput.value = ''; 
}

function resetUplotData() {
    uplotData = {
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

function resetMaxValues() {
    maxValues = {
        pressure: { value: -Infinity, timestamp: null },
        thrust: { value: -Infinity, timestamp: null },
        temperature: { value: -Infinity, timestamp: null }
    };
    const maxP = document.getElementById('maxPressure');
    const maxT = document.getElementById('maxThrust');
    const maxTemp = document.getElementById('maxTemperature');
    const curP = document.getElementById('currentPressure');
    const curT = document.getElementById('currentThrust');
    const curTemp = document.getElementById('currentTemperature');

    if(maxP) maxP.textContent = 'Max Pressure: -- hPa';
    if(maxT) maxT.textContent = 'Max Thrust: -- N';
    if(maxTemp) maxTemp.textContent = 'Max Temp: -- °C';
    if(curP) curP.textContent = 'Current Pressure: -- hPa';
    if(curT) curT.textContent = 'Current Thrust: -- N';
    if(curTemp) curTemp.textContent = `Current Temp: -- °C`;
}

function startCsvPlotting() {
    if (!allData || allData.length === 0) {
        alert('Please load a valid CSV file first');
        return;
    }
    isPlotting = true;
    isSerialConnected = false;
    randomPlotting = false;
    currentMode = 'csv';

    document.querySelectorAll('[data-series]').forEach(el => el.style.display = 'none');

    availableSeries.forEach(series => {
        document.querySelectorAll(`[data-series="${series}"]`).forEach(el => {
            el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
        });
    });

    showPage('plottingPage', () => {
        setupChartInstances(); 
        restartCsvPlotting();
    });
}
function restartCsvPlotting() {
    if (!allData || allData.length === 0) return;
    isPaused = false;
    index = 0;
    resetUplotData(); 
    updateAllPlots();
    resetMaxValues();
    startTime = performance.now();
    plotStartTime = allData[0].timestamp;
    requestAnimationFrame(plotCSVInterval);
    pauseButton.disabled = false;
    resumeButton.disabled = true;
}
function startRandomPlotting() {
    availableSeries = ['thrust', 'pressure', 'temperature'];
    randomPlotting = true;
    isPlotting = false;
    isSerialConnected = false;
    currentMode = 'random';
    document.querySelectorAll('[data-series]').forEach(el => {
        el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
    });
    showPage('plottingPage', () => {
        setupChartInstances();
        restartRandomPlotting();
    });
}
function restartRandomPlotting() {
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    resetUplotData(); 
    randomDataLog = [];
    updateAllPlots();
    resetMaxValues();
    startTime = performance.now();
    randomPlotInterval = setInterval(() => {
        const elapsedTime = (performance.now() - startTime) / 1000;
        const p = 1013 + Math.sin(elapsedTime) * 10 + (Math.random() - 0.5) * 5;
        const th = 25 + Math.cos(elapsedTime * 0.5) * 20 + (Math.random() - 0.5) * 5;
        const temp = 40 + Math.sin(elapsedTime * 0.2) * 15 + (Math.random() - 0.5) * 3;
        const randomData = { timestamp: elapsedTime * 1000, pressure: p, thrust: th, temperature: temp };
        randomDataLog.push(randomData);
        updateMaxMinValues(randomData, elapsedTime);
        uplotData.time.push(elapsedTime);
        uplotData.pressure.push(p);
        uplotData.thrust.push(th);
        uplotData.temperature.push(temp);
        updateAllPlots();
    }, 100);
}


function restartSerialPlotting() {
    resetUplotData(); 
    serialData = []; 
    serialBuffer = []; 
    
    if (currentMode === 'rocketFlight') {
        if (flightRocketMarker) { 
            flightRocketMarker.remove();
            flightRocketMarker = null;
        }
        if (flightMap) {
            flightMap.setView(flightPrimaryCoords, 15);
            updatePrimaryMarker(); 
        }
    } else {
        resetMaxValues(); 
    }

    updateAllPlots(); 
     startTime = performance.now();
}

async function connectToSerial(mode) {
    currentMode = mode;

    availableSeries = [];
    document.querySelectorAll('[data-series]').forEach(el => el.style.display = 'none');

    if (currentMode === 'motorTest') {
        availableSeries = ['thrust', 'pressure'];
        availableSeries.forEach(series => {
            document.querySelectorAll(`.stat-box[data-series="${series}"]`).forEach(el => {
                el.style.display = 'block';
            });
        });
    } else if (currentMode === 'hydrostaticTest') {
        serialConfigSelectors.forEach(sel => {
            if (sel.value !== 'none') availableSeries.push(sel.value);
        });
        availableSeries.forEach(series => {
            document.querySelectorAll(`[data-series="${series}"]`).forEach(el => {
                el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
            });
        });
    } else if (currentMode === 'rocketFlight') {
        // Flight mode availableSeries handled dynamically by flightConfig.sequence during parsing/plotting
    }

    try {
        try {
            port = await navigator.serial.requestPort();
        } catch (err) {
            console.log("No port selected or cancelled. Asking for simulation...");
            if (confirm("No serial port selected. Switch to 'Simulation Mode' for testing?")) {
                port = new MockSerialPort(currentMode);
            } else {
                return; 
            }
        }

        await port.open({ baudRate: 9600 });

        if (!(port instanceof MockSerialPort)) {
            lastConnectedPortInfo = port.getInfo();
            localStorage.setItem('lastConnectedPortInfo', JSON.stringify(lastConnectedPortInfo));
        }

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }

        isSerialConnected = true;
        isPlotting = false;
        randomPlotting = false;

        if(currentMode === 'motorTest') {
             const fsmStateElement = document.getElementById('fsmState');
            if (fsmStateElement) {
                fsmStateElement.textContent = 'FSM State: BOOT';
                fsmStateElement.className = 'stat-box fsm-state';
            }
        }

        showPage('plottingPage', () => {
            setupChartInstances(); 

            const statusEl = document.getElementById(`${currentMode}Status`);
            if (statusEl) {
                if (port instanceof MockSerialPort) {
                    statusEl.textContent = 'Status: Connected (Simulated)';
                } else {
                    statusEl.textContent = 'Status: Connected';
                }
            }

            restartSerialPlotting(); 
            keepReading = true; 
            
            readSerialData(); 
            
            if (serialUpdateInterval) clearInterval(serialUpdateInterval);
            serialUpdateInterval = setInterval(updateFromBuffer, 50); 
        });

    } catch (error) {
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to device.');
        showPage(`${currentMode}Page`);
        
        lastConnectedPortInfo = null; 
        isSerialConnected = false; 
        port = null;
    }
}

async function resetCsvMode() { await fullReset(); showPage('csvPage'); }
async function resetRandomMode() { await fullReset(); showPage('randomPage'); }

async function resetSerialMode() {
    const pageToRestore = currentMode; 
     keepReading = false;
     if (reader) {
        await reader.cancel().catch(() => {}); 
        reader = null;
     }
    await fullReset(); 
    if (pageToRestore === 'motorTest') showPage('motorTestPage');
    else if (pageToRestore === 'hydrostaticTest') showPage('hydrostaticTestPage');
    else if (pageToRestore === 'rocketFlight') showPage('rocketFlightPage');
}
function attemptReconnect() {
    if (reconnectInterval) clearInterval(reconnectInterval); 
     console.log("Starting reconnect attempts...");
    reconnectInterval = setInterval(async () => {
        if (isSerialConnected || !lastConnectedPortInfo || !keepReading) {
             console.log("Stopping reconnect attempts.");
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            return;
        }

        try {
            const availablePorts = await navigator.serial.getPorts();
            const matchingPort = availablePorts.find(p => {
                const info = p.getInfo();
                return lastConnectedPortInfo.usbVendorId && lastConnectedPortInfo.usbProductId &&
                       info.usbVendorId === lastConnectedPortInfo.usbVendorId &&
                       info.usbProductId === lastConnectedPortInfo.usbProductId;
            });

            if (matchingPort) {
                console.log('Device re-detected. Attempting to connect...');
                clearInterval(reconnectInterval); 
                reconnectInterval = null;
                await connectToSerial(currentMode); 
            } else {
                 console.log('Reconnect: Device not found yet...');
                 const statusEl = document.getElementById(`${currentMode}Status`);
                 if(statusEl && statusEl.textContent.includes('reconnecting')) {
                 }
            }
        } catch (error) {
            console.error('Error during reconnect attempt:', error);
        }
    }, 2000); 
}


function getFlightChartOptions(seriesType, isPreview = false) {
    const themeColors = getThemeColors();
    let opts = {
        legend: { show: false }, 
        scales: { x: { time: false }, y: { auto: true } }, 
        series: [{}], 
        axes: [
            { scale: 'x', label: 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } },
            { label: 'Value', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } }
        ],
        cursor: {
            y: false 
        }
    };

    if (seriesType === 'pressure') {
        opts.series.push({ label: 'Pressure', stroke: 'blue', width: 2, points: { show: false } });
        opts.axes[1].label = 'Pressure';
    } else if (seriesType === 'acceleration') {
        opts.series.push({ label: 'Acc X', stroke: flightAxisColors.x, width: 2, points: { show: false } });
        opts.series.push({ label: 'Acc Y', stroke: flightAxisColors.y, width: 2, points: { show: false } });
        opts.series.push({ label: 'Acc Z', stroke: flightAxisColors.z, width: 2, points: { show: false } });
        opts.axes[1].label = 'Acceleration';
    } else if (seriesType === 'gyroscope') {
        opts.series.push({ label: 'Gyro X', stroke: flightAxisColors.x, width: 2, points: { show: false } });
        opts.series.push({ label: 'Gyro Y', stroke: flightAxisColors.y, width: 2, points: { show: false } });
        opts.series.push({ label: 'Gyro Z', stroke: flightAxisColors.z, width: 2, points: { show: false } });
        opts.axes[1].label = 'Gyroscope';
    }

    if (isPreview) {
        opts.legend.show = false;
        opts.axes[0].label = null;
        opts.axes[1].label = seriesType.charAt(0).toUpperCase() + seriesType.slice(1); 
    }
    return opts;
}

function getChartOptions(seriesName, isThumbnail = false) {
    const seriesConfig = {
        pressure: { label: 'Pressure (hPa)', stroke: 'blue', width: 2 },
        thrust: { label: 'Thrust (N)', stroke: 'red', width: 2 },
        temperature: { label: 'Temperature (°C)', stroke: 'orange', width: 2 },
    };
    const themeColors = getThemeColors();
    if (isThumbnail) {
        return {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } }, 
            axes: [{ show: false }, { show: false }],
            cursor: { show: false },
            series: [{}, { stroke: seriesConfig[seriesName]?.stroke || '#ccc', width: 2 }], 
        };

    } else {
        const config = seriesConfig[seriesName] || { label: seriesName, stroke: '#ccc' }; 
        const opts = {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } }, 
            series: [{}, { ...config, points: { show: false } }], 
            axes: [
                { scale: 'x', label: 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } },
                { label: config.label, stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } }
            ],
        };
        return opts;
    }
}
function getThemeColors() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return {
        axes: isDarkMode ? '#ffffff' : '#333',
        grid: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        labels: isDarkMode ? '#ffffff' : '#333',
    };
}

function initFlightMap(containerId) {
    if (typeof L === 'undefined') {
        console.error("Leaflet.js (L) is not loaded.");
        return;
    }
    
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) {
        console.error(`Map container #${containerId} not found.`);
        return;
    }

    if (flightMap) {
        flightMap.remove();
        flightMap = null;
    }
    flightRocketMarker = null; 
    flightPrimaryMarker = null; 

    try {
        const mapZoom = 15;
        flightMap = L.map(containerId, {
            scrollWheelZoom: true, 
        }).setView(flightPrimaryCoords, mapZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(flightMap);

        updatePrimaryMarker(); 
        
    } catch (e) {
        console.error("Error initializing Leaflet map:", e);
        mapContainer.innerHTML = "<p>Error loading map.</p>";
    }
}

function updateFlightMap(lat, lon) {
    if (!flightMap || !flightConfig.gps) {
        return;
    }
    
    if (typeof lat !== 'number' || isNaN(lat) || typeof lon !== 'number' || isNaN(lon)) {
        return; 
    }

    const newCoords = [lat, lon];

    if (!flightRocketMarker) {
        flightRocketMarker = L.marker(newCoords).addTo(flightMap);
        flightMap.setView(newCoords, 17); 
    } else {
        flightRocketMarker.setLatLng(newCoords);
        flightMap.panTo(newCoords);
    }
}


function setupFlightPlotLayout(isPreview = false) {
    destroyFlightPlots(); 
    flightRawPlotsContainer.innerHTML = ''; 
    flightCalcPlotsContainer.innerHTML = `
        <div class="plot-wrapper blank-calc">
            <h2>Calculated Value Plots (Pending)</h2>
            <p>(Altitude, Velocity, etc.)</p>
        </div>`;

    const selectedTypes = [];
    if (flightConfig.pressure) selectedTypes.push('pressure');
    if (flightConfig.acceleration) selectedTypes.push('acceleration');
    if (flightConfig.gyroscope) selectedTypes.push('gyroscope');

    const numSelected = selectedTypes.length;
    let layoutHTML = '';
    const plotIds = []; 

    const mapContainerHTML = `<div id="flightMapContainer" class="map-container"></div>`;

    flightRawPlotsContainer.className = 'main-chart-area'; 

    if (numSelected === 3) {
        flightRawPlotsContainer.classList.add('layout-two-by-two'); 
        plotIds.push('flight-plot-bottom-left', 'flight-plot-top-right', 'flight-plot-bottom-right');
        layoutHTML = `
            <div class="plot-wrapper blank plot-top-left">${mapContainerHTML}</div>
            <div id="flight-plot-top-right" class="plot-wrapper plot-top-right"></div>
            <div id="flight-plot-bottom-left" class="plot-wrapper plot-bottom-left"></div>
            <div id="flight-plot-bottom-right" class="plot-wrapper plot-bottom-right"></div>
        `;
    } else if (numSelected === 2) {
        flightRawPlotsContainer.classList.add('layout-three-split');
        plotIds.push('flight-plot-top-right', 'flight-plot-bottom-right'); 
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half">${mapContainerHTML}</div>
            <div class="plot-right-column">
                <div id="flight-plot-top-right" class="plot-wrapper plot-right-quarter"></div>
                <div id="flight-plot-bottom-right" class="plot-wrapper plot-right-quarter"></div>
            </div>
        `;
    } else if (numSelected === 1) {
        flightRawPlotsContainer.classList.add('layout-two-split');
         plotIds.push('flight-plot-right-half');
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half">${mapContainerHTML}</div>
            <div id="flight-plot-right-half" class="plot-wrapper plot-right-half"></div>
        `;
    } else {
        flightRawPlotsContainer.classList.add('layout-full-map'); 
        layoutHTML = `<div class="plot-wrapper blank">${mapContainerHTML}</div>`;
    }

    flightRawPlotsContainer.innerHTML = layoutHTML;
    
    if (numSelected >= 0) { 
        initFlightMap('flightMapContainer');
    }

    selectedTypes.forEach((type, i) => {
        const plotId = plotIds[i]; 
        if (!plotId) return; 
        const wrapper = document.getElementById(plotId);
        if (!wrapper) return;

        const opts = getFlightChartOptions(type, isPreview);
        let data = [isPreview ? [0] : (uplotData.time || [])]; 

        if (type === 'pressure') {
            data.push(isPreview ? [0] : (uplotData.pressure || []));
        } else if (type === 'acceleration') {
            data.push(isPreview ? [0] : (uplotData.acc_x || []));
            data.push(isPreview ? [0] : (uplotData.acc_y || []));
            data.push(isPreview ? [0] : (uplotData.acc_z || []));
        } else if (type === 'gyroscope') {
            data.push(isPreview ? [0] : (uplotData.gyro_x || []));
            data.push(isPreview ? [0] : (uplotData.gyro_y || []));
            data.push(isPreview ? [0] : (uplotData.gyro_z || []));
        }

        if (!isPreview && data[0].length === 0) {
            data = data.map(() => [null]); 
        } else if (isPreview && data[0].length === 0) {
             data = data.map(() => [0]);
        }

        try {
            flightRawPlots[type] = {
                instance: new uPlot(opts, data, wrapper),
                wrapper: wrapper
            };
        } catch (uPlotError) {
             console.error(`Error creating uPlot for ${type} in ${plotId}:`, uPlotError);
             wrapper.innerHTML = `<p style="color: red; text-align: center; padding-top: 20px;">Error creating plot.</p>`;
        }
    });

    handleResize(); 
}


function toggleFlightPlotView() {
    if (flightPlotLayout === 'raw') {
        flightPlotLayout = 'calculated';
        flightRawPlotsContainer.style.display = 'none'; 
        flightCalcPlotsContainer.style.display = 'flex'; 
        plotSwitchButton.title = 'Show Raw Plots';
    } else {
        flightPlotLayout = 'raw';
        const numSelected = (flightConfig.pressure ? 1 : 0) + (flightConfig.acceleration ? 1 : 0) + (flightConfig.gyroscope ? 1 : 0);
        if (numSelected === 3) {
            flightRawPlotsContainer.style.display = 'grid'; 
        } else if (numSelected >= 0) { 
            flightRawPlotsContainer.style.display = 'flex'; 
        }
        flightCalcPlotsContainer.style.display = 'none'; 
        plotSwitchButton.title = 'Show Calculated Plots';
        
        if (flightMap) {
            setTimeout(() => {
                if(flightMap) flightMap.invalidateSize()
            }, 0); 
        }
    }
    handleResize(); 
}

function setupChartInstances() {
    if (currentMode === 'rocketFlight') {
        setupFlightPlotLayout(false); 

    } else {
        if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
        if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
        if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
        if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
        if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }

        const mainChartArea = document.getElementById('mainChartArea');
        const wrapper1 = document.getElementById('uplot-main-wrapper-1');
        const wrapper2 = document.getElementById('uplot-main-wrapper-2');

        const timeData = uplotData.time || [];

        if (availableSeries.length === 1) {
            mainChartArea.classList.remove('two-chart-layout');
            wrapper1.style.display = 'flex';
            wrapper2.style.display = 'none';

            mainPlot1.series = availableSeries[0];
            const opts1 = getChartOptions(mainPlot1.series);
            const data1 = [timeData, uplotData[mainPlot1.series] || []];
            if (data1[0].length === 0) data1.forEach(arr => arr.push(null));
            mainPlot1.instance = new uPlot(opts1, data1, wrapper1);


        } else if (availableSeries.length >= 2) {
            mainChartArea.classList.add('two-chart-layout');
            wrapper1.style.display = 'flex';
            wrapper2.style.display = 'flex';

            mainPlot1.series = availableSeries[0];
            const opts1 = getChartOptions(mainPlot1.series);
            const data1 = [timeData, uplotData[mainPlot1.series] || []];
             if (data1[0].length === 0) data1.forEach(arr => arr.push(null));
            mainPlot1.instance = new uPlot(opts1, data1, wrapper1);

            mainPlot2.series = availableSeries[1];
            const opts2 = getChartOptions(mainPlot2.series);
            const data2 = [timeData, uplotData[mainPlot2.series] || []];
            if (data2[0].length === 0) data2.forEach(arr => arr.push(null));
            mainPlot2.instance = new uPlot(opts2, data2, wrapper2);
        }

         const pressureDataThumb = [timeData, uplotData.pressure || []];
         if (pressureDataThumb[0].length === 0) pressureDataThumb.forEach(arr => arr.push(null));
        const pressureThumbEl = document.getElementById('pressureThumbnail')?.querySelector('.thumbnail-chart');
        if(pressureThumbEl)
            uplotPressureThumb = new uPlot(getChartOptions('pressure', true), pressureDataThumb, pressureThumbEl);

        const thrustDataThumb = [timeData, uplotData.thrust || []];
        if (thrustDataThumb[0].length === 0) thrustDataThumb.forEach(arr => arr.push(null));
        const thrustThumbEl = document.getElementById('thrustThumbnail')?.querySelector('.thumbnail-chart');
        if(thrustThumbEl)
             uplotThrustThumb = new uPlot(getChartOptions('thrust', true), thrustDataThumb, thrustThumbEl);

         const tempDataThumb = [timeData, uplotData.temperature || []];
         if (tempDataThumb[0].length === 0) tempDataThumb.forEach(arr => arr.push(null));
        const tempThumbEl = document.getElementById('temperatureThumbnail')?.querySelector('.thumbnail-chart');
        if(tempThumbEl)
            uplotTempThumb = new uPlot(getChartOptions('temperature', true), tempDataThumb, tempThumbEl);

        updateActiveThumbnails();
    }

    handleResize();
}


function updateChartStyles() {
    const themeColors = getThemeColors();

    const updateInstanceStyles = (instance) => {
        if (!instance) return;
        const axisConfig = {
            stroke: themeColors.axes,
            grid: { stroke: themeColors.grid },
            ticks: { stroke: themeColors.grid },
            labelFont: '14px sans-serif',
            valueFont: '12px sans-serif'
        };
         if (instance.axes && instance.axes.length >= 2) {
            instance.setAxes([axisConfig, axisConfig]);
         } else {
             instance.redraw(); 
         }

        const svg = instance.root?.querySelector('svg'); 
        if (svg) {
            svg.querySelectorAll('.u-axis text, .u-legend th, .u-legend td').forEach(el => {
                 if (el) el.style.fill = themeColors.labels; 
            });
        }
    };

    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(plot => updateInstanceStyles(plot.instance));
        Object.values(flightCalcPlots).forEach(plot => updateInstanceStyles(plot.instance));
    } else {
        updateInstanceStyles(mainPlot1.instance);
        updateInstanceStyles(mainPlot2.instance);
        updateInstanceStyles(uplotPressureThumb);
        updateInstanceStyles(uplotThrustThumb);
        updateInstanceStyles(uplotTempThumb);
    }
}

function swapMainChart(seriesName) {
     if (currentMode === 'rocketFlight' || !seriesName || mainPlot1.series === seriesName) {
        return;
    }

    mainPlot1.series = seriesName;

    if (mainPlot1.instance) {
        mainPlot1.instance.destroy();
    }
    const wrapper = document.getElementById('uplot-main-wrapper-1');
     if (!wrapper) return; 
    const opts = getChartOptions(mainPlot1.series);
     const data = [uplotData.time || [], uplotData[mainPlot1.series] || []];
     if (data[0].length === 0) data.forEach(arr => arr.push(null));
    mainPlot1.instance = new uPlot(opts, data, wrapper);


    updateActiveThumbnails();
    handleResize();
}

function updateActiveThumbnails() {
     if (currentMode === 'rocketFlight' || !thumbnailContainers) return;

    const activeSeries = [mainPlot1.series, mainPlot2.series].filter(Boolean);
    thumbnailContainers.forEach(container => {
        if (activeSeries.includes(container.dataset.series)) {
            container.classList.add('active');
        } else {
            container.classList.remove('active');
        }
    });
}

function updateAllPlots() {
    const timeData = Array.isArray(uplotData.time) ? uplotData.time : [];

    if (currentMode === 'rocketFlight') {
        if (flightRawPlots.pressure && flightRawPlots.pressure.instance) {
            flightRawPlots.pressure.instance.setData([timeData, uplotData.pressure || []], false); 
        }
        if (flightRawPlots.acceleration && flightRawPlots.acceleration.instance) {
            flightRawPlots.acceleration.instance.setData([timeData, uplotData.acc_x || [], uplotData.acc_y || [], uplotData.acc_z || []], false);
        }
        if (flightRawPlots.gyroscope && flightRawPlots.gyroscope.instance) {
            flightRawPlots.gyroscope.instance.setData([timeData, uplotData.gyro_x || [], uplotData.gyro_y || [], uplotData.gyro_z || []], false);
        }

    } else {
        if (mainPlot1.instance) {
             const seriesData1 = uplotData[mainPlot1.series] || [];
            mainPlot1.instance.setData([timeData, seriesData1], false);
        }
        if (mainPlot2.instance) {
             const seriesData2 = uplotData[mainPlot2.series] || [];
            mainPlot2.instance.setData([timeData, seriesData2], false);
        }
        if (uplotPressureThumb) uplotPressureThumb.setData([timeData, uplotData.pressure || []], false);
        if (uplotThrustThumb) uplotThrustThumb.setData([timeData, uplotData.thrust || []], false);
        if (uplotTempThumb) uplotTempThumb.setData([timeData, uplotData.temperature || []], false);
    }

    const dataLength = timeData.length; 

    let newScale = null; 
    if (dataLength >= 1 && (isSerialConnected || randomPlotting || isPlotting)) {
        if ((randomPlotting || isSerialConnected) && dataLength >= 2) { 
            const windowEndTime = timeData[dataLength - 1];
            if (typeof windowEndTime === 'number' && !isNaN(windowEndTime)) {
                const windowStartTime = Math.max(timeData[0] ?? 0, windowEndTime - 20); 
                newScale = { min: windowStartTime, max: windowEndTime };
            }
        } else if (isPlotting && dataLength >= 1) { 
            const windowStartTime = timeData[0];
             const windowEndTime = timeData[dataLength - 1]; 
             if (typeof windowStartTime === 'number' && !isNaN(windowStartTime) &&
                 typeof windowEndTime === 'number' && !isNaN(windowEndTime)) {
                const duration = windowEndTime - windowStartTime;
                const padding = duration > 0 ? duration * 0.1 : 1; 
                const newMin = windowStartTime; 
                const newMax = windowEndTime + padding;
                newScale = { min: newMin, max: newMax };
             }
        }
    }


    const applyScaleAndRedraw = (instance, scale) => {
        if (instance) {
            if (scale) {
                instance.setScale('x', scale); 
            } else {
                instance.redraw(false, false); 
            }
        }
    };


    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(plot => applyScaleAndRedraw(plot.instance, newScale));
        Object.values(flightCalcPlots).forEach(plot => applyScaleAndRedraw(plot.instance, newScale));
    } else {
        applyScaleAndRedraw(mainPlot1.instance, newScale);
        applyScaleAndRedraw(mainPlot2.instance, newScale);
        applyScaleAndRedraw(uplotPressureThumb, newScale);
        applyScaleAndRedraw(uplotThrustThumb, newScale);
        applyScaleAndRedraw(uplotTempThumb, newScale);
    }
}


async function readSerialData() {
    if (!port || !port.readable) {
        console.warn("readSerialData called but port is not readable.");
        return; 
    }
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    let readableStreamClosed;
    try {
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        while (true) {
            if (!keepReading) {
                 console.log("keepReading is false, exiting read loop before read().");
                 break;
            }
            const { value, done } = await reader.read();
            if (done) {
                 console.log("Reader stream reported done.");
                 break; 
            }
            if (!value) continue;

            lineBuffer += value; 
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || ''; 
            for (const line of lines) {
                if (line.trim()) serialBuffer.push(line.trim());
            }
        }
    } catch (error) {
        if (keepReading) {
            console.error('Error reading from serial port:', error);
        } else {
             console.log("Read loop caught error during intentional disconnect/stop.");
        }
    } finally {
         console.log("Entering readSerialData finally block...");
         const wasSerialConnected = isSerialConnected; 
         const disconnectedMode = currentMode; 

         isSerialConnected = false; 

        if (serialUpdateInterval) {
            clearInterval(serialUpdateInterval);
            serialUpdateInterval = null;
            console.log("Cleared serialUpdateInterval.");
        }

        if (reader) {
            console.log("Attempting to cancel and release reader...");
            try {
                await reader.cancel().catch(e => console.log("Reader cancel error (expected on disconnect):", e));
                reader.releaseLock();
                console.log("Reader released.");
            } catch (releaseError) {
                console.warn("Error releasing reader lock:", releaseError);
            } finally {
                 reader = null; 
            }
        } else {
             console.log("Reader was already null.");
        }

        if (readableStreamClosed) {
             console.log("Waiting for readableStreamClosed...");
            await readableStreamClosed.catch(() => {}); 
             console.log("readableStreamClosed finished.");
        }

        if (port && port.close) { 
             console.log("Attempting to close port...");
             try {
                await port.close();
                console.log("Port closed.");
             } catch (closeError) {
                console.warn("Error closing port (might be already closed):", closeError);
             } finally {
                 port = null; 
             }
        } else {
            console.log("Port was already null or not closable.");
             port = null; 
        }

        console.log("Performing post-disconnect actions...");
        if (wasSerialConnected && serialData.length > 0) {
            console.log("Session ended with data. Triggering auto-download.");
            downloadDataAsCSV(); 

            const isAnySerialMode = ['rocketFlight', 'motorTest', 'hydrostaticTest'].includes(disconnectedMode);
            if (isAnySerialMode && uplotData.time && uplotData.time.length > 0) {
                console.log(`Rescaling ${disconnectedMode} plot to full range after disconnect.`);
                 const validTimes = uplotData.time.filter(t => typeof t === 'number' && !isNaN(t));
                if (validTimes.length > 0) {
                    const minTime = validTimes[0];
                    const maxTime = validTimes[validTimes.length - 1];
                    const duration = maxTime - minTime;
                    const padding = duration > 0 ? duration * 0.1 : 1; 
                    const fullScale = { min: minTime, max: maxTime + padding };

                    if (disconnectedMode === 'rocketFlight') {
                        Object.values(flightRawPlots).forEach(plot => {
                            if (plot.instance) plot.instance.setScale('x', fullScale);
                        });
                        Object.values(flightCalcPlots).forEach(plot => {
                            if (plot.instance) plot.instance.setScale('x', fullScale);
                        });
                    } else { 
                        if (mainPlot1.instance) mainPlot1.instance.setScale('x', fullScale);
                        if (mainPlot2.instance) mainPlot2.instance.setScale('x', fullScale);
                    }
                    console.log(`${disconnectedMode} plot rescale applied.`);
                } else {
                     console.log("No valid time data found to rescale plot.");
                }
            } else if (isAnySerialMode) {
                 console.log("No time data available to rescale plot.");
            }

        } else if (wasSerialConnected) {
             console.log("Session ended, but no serial data logged.");
        }

        if (disconnectedMode === 'motorTest') {
             const fsmStateElement = document.getElementById('fsmState');
            if (fsmStateElement) {
                fsmStateElement.textContent = 'FSM State: --'; 
                fsmStateElement.className = 'stat-box fsm-state';
            }
        }

        const statusEl = document.getElementById(`${disconnectedMode}Status`); 
        if (lastConnectedPortInfo && keepReading) {
            if (statusEl) statusEl.textContent = 'Status: Disconnected. Attempting to reconnect...';
            if (!reconnectInterval) {
                 attemptReconnect();
            }
        } else {
            if (statusEl) statusEl.textContent = 'Status: Disconnected';
            if (!keepReading) {
                 console.log("Intentional disconnect detected, clearing last port info and stopping reconnect.");
                 localStorage.removeItem('lastConnectedPortInfo');
                 lastConnectedPortInfo = null;
                 if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                 }
            }
        }
         console.log("Exiting readSerialData finally block.");
    }
}


function updateFromBuffer() {
    if (serialBuffer.length === 0 || !isSerialConnected) return; 

    const pointsToProcess = serialBuffer.splice(0, serialBuffer.length);
    let plotNeedsUpdate = false; 

    pointsToProcess.forEach(line => {
        const data = processSerialLine(line);
        if (data && typeof data.timestamp === 'number' && !isNaN(data.timestamp)) {
            serialData.push(data); 

            const timeInSeconds = data.timestamp / 1000;

            if (uplotData.time.length > 0 && timeInSeconds <= uplotData.time[uplotData.time.length - 1]) {
            }

            uplotData.time.push(timeInSeconds);

            if (currentMode === 'rocketFlight') {
                 if (!uplotData.gps_lat) uplotData.gps_lat = []; 
                 if (!uplotData.gps_lon) uplotData.gps_lon = []; 
                 if (!uplotData.pressure) uplotData.pressure = [];
                 if (!uplotData.acc_x) uplotData.acc_x = [];
                 if (!uplotData.acc_y) uplotData.acc_y = [];
                 if (!uplotData.acc_z) uplotData.acc_z = [];
                 if (!uplotData.gyro_x) uplotData.gyro_x = [];
                 if (!uplotData.gyro_y) uplotData.gyro_y = [];
                 if (!uplotData.gyro_z) uplotData.gyro_z = [];

                uplotData.gps_lat.push(data.gps_lat ?? null); 
                uplotData.gps_lon.push(data.gps_lon ?? null); 
                uplotData.pressure.push(data.pressure ?? null);
                uplotData.acc_x.push(data.acc_x ?? null);
                uplotData.acc_y.push(data.acc_y ?? null);
                uplotData.acc_z.push(data.acc_z ?? null);
                uplotData.gyro_x.push(data.gyro_x ?? null);
                uplotData.gyro_y.push(data.gyro_y ?? null);
                uplotData.gyro_z.push(data.gyro_z ?? null);
                
                updateFlightMap(data.gps_lat, data.gps_lon);

            } else {
                if (!uplotData.thrust) uplotData.thrust = [];
                if (!uplotData.pressure) uplotData.pressure = [];
                if (!uplotData.temperature) uplotData.temperature = [];

                uplotData.thrust.push(data.thrust ?? null);
                uplotData.pressure.push(data.pressure ?? null);
                uplotData.temperature.push(data.temperature ?? null);
                updateMaxMinValues(data, timeInSeconds);
            }
            plotNeedsUpdate = true; 
        }
    });

    if (plotNeedsUpdate) {
        updateAllPlots(); 
    }
}
function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (parseCSV(e.target.result)) {
             if(plotButton) plotButton.disabled = false;
        } else {
            alert('Error: CSV must contain a "timestamp" column and at least one data column (pressure, thrust, or temperature). Check console for details.');
            if(plotButton) plotButton.disabled = true; 
             if(csvFileInput) csvFileInput.value = ''; 

        }
    };
     reader.onerror = (e) => {
        alert('Error reading file: ' + e.target.error);
         if(plotButton) plotButton.disabled = true;
         if(csvFileInput) csvFileInput.value = '';
    };
    reader.readAsText(file);
}
function parseCSV(csvText) {
     resetUplotData(); 
    allData = [];
    availableSeries = [];

    const lines = csvText.trim().split(/[\r\n]+/).map(line => line.trim()).filter(line => line); 
    if (lines.length < 2) {
        console.error("CSV has less than 2 lines (header + data).");
        return false;
    }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '')); 
    const tsIndex = headers.indexOf('timestamp');
    if (tsIndex === -1) {
         console.error("CSV missing 'timestamp' header.");
         return false; 
    }

    const potentialSeries = ['pressure', 'thrust', 'temperature'];
    const seriesIndices = {};
    potentialSeries.forEach(s => {
        const idx = headers.indexOf(s);
        if (idx > -1) {
            availableSeries.push(s);
            seriesIndices[s] = idx;
        }
    });

    if (availableSeries.length === 0) {
        console.error("CSV contains no recognized data columns (pressure, thrust, temperature).");
        return false;
    }

    const timestampUnitSelected = document.getElementById('timestampUnit')?.value || 'ms';

    allData = lines.slice(1).map((line, lineIndex) => {
        const cols = line.split(',');
        if (cols.length <= tsIndex) {
            console.warn(`Skipping line ${lineIndex + 2}: Not enough columns for timestamp.`);
            return null;
        }
        let time = parseFloat(cols[tsIndex]);
        if (isNaN(time)) {
             console.warn(`Skipping line ${lineIndex + 2}: Invalid timestamp value "${cols[tsIndex]}".`);
            return null; 
        }
        if (timestampUnitSelected === 's') {
            time *= 1000; 
        }
        const point = { timestamp: time }; 
        availableSeries.forEach(s => {
            const colIdx = seriesIndices[s];
            if (cols.length > colIdx) {
                 const valStr = cols[colIdx]?.trim();
                const val = parseFloat(valStr);
                point[s] = (valStr !== '' && !isNaN(val)) ? val : null;
            } else {
                point[s] = null; 
            }
        });
        return point;
    }).filter(point => point !== null); 

    if (allData.length === 0) {
         console.error("No valid data rows found in CSV after parsing.");
        return false;
    }

    allData.sort((a, b) => a.timestamp - b.timestamp); 
     plotStartTime = allData[0].timestamp; 
    return true; 
}

function plotCSVInterval() {
    if (!isPlotting || isPaused || index >= allData.length) {
        if (index >= allData.length && isPlotting) {
            console.log("CSV plotting finished.");
            isPlotting = false; 
            if(pauseButton) pauseButton.disabled = true;
            if(resumeButton) resumeButton.disabled = true;
        }
        return;
    }

    const elapsedRealTime = performance.now() - startTime;
    const targetTimestamp = plotStartTime + elapsedRealTime;

    let pointsAdded = false;
    while (index < allData.length && allData[index].timestamp <= targetTimestamp) {
        const point = allData[index];
        const timeInSeconds = point.timestamp / 1000;

        if (!uplotData.time) uplotData.time = [];
        if (!uplotData.pressure) uplotData.pressure = [];
        if (!uplotData.thrust) uplotData.thrust = [];
        if (!uplotData.temperature) uplotData.temperature = [];

        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(availableSeries.includes('pressure') ? (point.pressure ?? null) : null);
        uplotData.thrust.push(availableSeries.includes('thrust') ? (point.thrust ?? null) : null);
        uplotData.temperature.push(availableSeries.includes('temperature') ? (point.temperature ?? null) : null);

        updateMaxMinValues(point, timeInSeconds);
        index++;
        pointsAdded = true;
    }

    if (pointsAdded) {
        updateAllPlots(); 
    }

    requestAnimationFrame(plotCSVInterval); 
}


function processSerialLine(line) {
    const cleanLine = line.replace(/[^\x20-\x7E]/g, '').trim(); 

    if (!cleanLine) return null;

    if (currentMode === 'motorTest') {
        if (cleanLine.startsWith("AT+SEND") || cleanLine === "OK") {
            return null; 
        }

        if (cleanLine.startsWith("+RCV=")) {
            const parts = cleanLine.split(',');
            if (parts.length < 5) {
                 console.warn("Ignoring short +RCV message:", cleanLine);
                 return null;
            }

            const dataPayloadString = parts.slice(2, -2).join(',').trim(); 

            const FSM_STATES = ['SAFE', 'ARMED', 'LAUNCHED', 'BOOT', 'FAILURE'];
            if (FSM_STATES.includes(dataPayloadString)) {
                const state = dataPayloadString;
                const fsmStateElement = document.getElementById('fsmState');
                 if (fsmStateElement) {
                    fsmStateElement.textContent = `FSM State: ${state}`;
                    fsmStateElement.className = 'stat-box fsm-state'; 
                    if (state === 'ARMED') fsmStateElement.classList.add('armed');
                    else if (state === 'LAUNCHED') fsmStateElement.classList.add('launched');
                    else if (state === 'FAILURE') fsmStateElement.classList.add('failure');
                 }


                if (waitingForState && state === waitingForState) {
                    console.log(`State confirmation received: ${state}. Stopping retries.`);
                    clearTimeout(commandTimeout);
                    isRetryingCommand = false;
                    waitingForState = null;
                    if (cmdArmButton) cmdArmButton.disabled = false;
                    if (cmdDisarmButton) cmdDisarmButton.disabled = false;
                    if (cmdLaunchButton) cmdLaunchButton.disabled = false;
                }

                 if (state === 'ARMED' || state === 'LAUNCHED') {
                     console.log(`State changed to ${state}, restarting plot.`);
                     restartSerialPlotting(); 
                 }


                return null; 
            }
            else {
                const dataValues = dataPayloadString.split(',');
                if (dataValues.length === 3) {
                    const timestamp = parseFloat(dataValues[0]);
                    const thrust = parseFloat(dataValues[1]);
                    const pressure = parseFloat(dataValues[2]);

                    if (!isNaN(timestamp) && !isNaN(thrust) && !isNaN(pressure)) {
                        return { timestamp, thrust, pressure }; 
                    } else {
                         console.warn("Could not parse motor test data payload:", dataPayloadString);
                    }
                } else {
                     console.warn("Unexpected number of values in motor test data payload:", dataPayloadString);
                }
            }
        } else {
        }
    } else if (currentMode === 'hydrostaticTest') {
        const cols = cleanLine.split(','); 
        const timestamp = parseFloat(cols[0]);
        if (isNaN(timestamp)) {
             console.warn("Hydro - Invalid timestamp:", cols[0], "Line:", cleanLine);
            return null;
        }

        const point = { timestamp: timestamp }; 
        availableSeries.forEach((seriesName, index) => {
            const colIndex = index + 1; 
            if (cols.length > colIndex) {
                 const valStr = cols[colIndex]?.trim();
                const val = parseFloat(valStr);
                point[seriesName] = (valStr !== '' && !isNaN(val)) ? val : null;
            } else {
                point[seriesName] = null; 
            }
        });
        return point;
    }
    // --- *** MODIFIED: Rocket Flight Parsing Logic (Dynamic Order) *** ---
    else if (currentMode === 'rocketFlight') {
        const cols = cleanLine.split(flightConfig.delimiter);
        const timestamp = parseFloat(cols[0]);
        if (isNaN(timestamp)) {
             console.warn("Flight - Invalid timestamp:", cols[0], "Line:", cleanLine);
            return null;
        }

        const point = { timestamp: timestamp }; // Store raw ms timestamp
        
        // Initialize all fields to null first
        point.gps_lat = null;
        point.gps_lon = null;
        point.pressure = null;
        point.acc_x = null;
        point.acc_y = null;
        point.acc_z = null;
        point.gyro_x = null;
        point.gyro_y = null;
        point.gyro_z = null;

        try {
            let colIndex = 1; // Start parsing after timestamp

            // Iterate through the user-configured sequence
            for (const type of flightConfig.sequence) {
                // Stop if we run out of columns
                if (colIndex >= cols.length) break;

                if (type === 'gps') {
                    // Expect 2 columns: Lat, Lon
                    const latStr = cols[colIndex]?.trim();
                    const lonStr = cols[colIndex + 1]?.trim();
                    const lat = parseFloat(latStr);
                    const lon = parseFloat(lonStr);
                    point.gps_lat = (latStr !== '' && !isNaN(lat)) ? lat : null;
                    point.gps_lon = (lonStr !== '' && !isNaN(lon)) ? lon : null;
                    colIndex += 2;
                } 
                else if (type === 'pressure') {
                    // Expect 1 column: Pressure
                    const valStr = cols[colIndex]?.trim();
                    const val = parseFloat(valStr);
                    point.pressure = (valStr !== '' && !isNaN(val)) ? val : null;
                    colIndex += 1;
                } 
                else if (type === 'acceleration') {
                    // Expect 3 columns: X, Y, Z
                    const xStr = cols[colIndex]?.trim();
                    const yStr = cols[colIndex + 1]?.trim();
                    const zStr = cols[colIndex + 2]?.trim();
                    const x = parseFloat(xStr);
                    const y = parseFloat(yStr);
                    const z = parseFloat(zStr);
                    point.acc_x = (xStr !== '' && !isNaN(x)) ? x : null;
                    point.acc_y = (yStr !== '' && !isNaN(y)) ? y : null;
                    point.acc_z = (zStr !== '' && !isNaN(z)) ? z : null;
                    colIndex += 3;
                } 
                else if (type === 'gyroscope') {
                    // Expect 3 columns: X, Y, Z
                    const xStr = cols[colIndex]?.trim();
                    const yStr = cols[colIndex + 1]?.trim();
                    const zStr = cols[colIndex + 2]?.trim();
                    const x = parseFloat(xStr);
                    const y = parseFloat(yStr);
                    const z = parseFloat(zStr);
                    point.gyro_x = (xStr !== '' && !isNaN(x)) ? x : null;
                    point.gyro_y = (yStr !== '' && !isNaN(y)) ? y : null;
                    point.gyro_z = (zStr !== '' && !isNaN(z)) ? z : null;
                    colIndex += 3;
                }
                // If type is 'none' or unknown, usually implies skipping one column, 
                // but since 'none' in UI implies "empty slot", we usually just don't increment colIndex
                // unless we treat 'none' as 'skip 1 value'. 
                // Based on Hydrostatic logic, 'none' just means "don't parse into this slot".
                // But for vector data, 'none' is ambiguous. 
                // We will assume 'none' simply does nothing and consumes NO columns.
            }

            return point;
        } catch (e) {
            console.error("Error during flight data parsing:", e, "Line:", cleanLine);
            return null; 
        }
    }

    return null;
}


function updateSerialConfigUI() {
    const connectBtn = document.getElementById('connectHydrostaticTest');
    const selectedValues = serialConfigSelectors.map(sel => sel.value);
    if(connectBtn) connectBtn.disabled = selectedValues[0] === 'none'; 

    serialConfigSelectors.forEach((currentSelector, currentIndex) => {
        if (!currentSelector || !currentSelector.options) return;

        Array.from(currentSelector.options).forEach(option => {
            if (option.value === 'none') {
                option.disabled = false; 
                return;
            }
            option.disabled = selectedValues.some((v, i) => v === option.value && i !== currentIndex);
        });
    });
    setupCustomSelects(document.getElementById('serialConfig'));
}

function updateMaxMinValues(data, timeInSeconds) {
    if (currentMode === 'rocketFlight') return;

    const timeString = `${timeInSeconds.toFixed(2)}s`;

    const maxP = document.getElementById('maxPressure');
    const maxT = document.getElementById('maxThrust');
    const maxTemp = document.getElementById('maxTemperature');
    const curP = document.getElementById('currentPressure');
    const curT = document.getElementById('currentThrust');
    const curTemp = document.getElementById('currentTemperature');

    if (data.pressure != null && data.pressure > maxValues.pressure.value) {
        maxValues.pressure.value = data.pressure;
        if(maxP) maxP.textContent = `Max Pressure: ${data.pressure.toFixed(2)} hPa @ ${timeString}`;
    }
    if (data.thrust != null && data.thrust > maxValues.thrust.value) {
        maxValues.thrust.value = data.thrust;
        if(maxT) maxT.textContent = `Max Thrust: ${data.thrust.toFixed(2)} N @ ${timeString}`;
    }
    if (data.temperature != null && data.temperature > maxValues.temperature.value) {
        maxValues.temperature.value = data.temperature;
        if(maxTemp) maxTemp.textContent = `Max Temp: ${data.temperature.toFixed(2)} °C @ ${timeString}`;
    }

    if (data.pressure != null && curP) curP.textContent = `Current Pressure: ${data.pressure.toFixed(2)} hPa`;
    if (data.thrust != null && curT) curT.textContent = `Current Thrust: ${data.thrust.toFixed(2)} N`;
    if (data.temperature != null && curTemp) curTemp.textContent = `Current Temp: ${data.temperature.toFixed(2)} °C`;
}


function triggerAutoDownload() {
     console.warn("triggerAutoDownload called - this is likely deprecated for auto-downloads.");
     if (serialData.length > 0 || randomDataLog.length > 0) {
        downloadDataAsCSV();
     } else if (!document.hidden) {
     }
}

function downloadDataAsCSV() {
    let dataToDownload = [];
    let filename = "plot-data.csv";
    let headers = [];

    let dataAvailable = false;
    let sourceMode = currentMode;
    
    const isSerialDataSource = ['motorTest', 'hydrostaticTest', 'rocketFlight'].includes(sourceMode);

    if (isSerialDataSource && serialData.length > 0) {
        dataToDownload = [...serialData]; 
        filename = `${sourceMode}-log-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.csv`; 

        if (sourceMode === 'rocketFlight') {
            headers = ['timestamp']; 
            if (flightConfig.gps) headers.push('gps_lat', 'gps_lon');
            if (flightConfig.pressure) headers.push('pressure');
            if (flightConfig.acceleration) headers.push('acc_x', 'acc_y', 'acc_z');
            if (flightConfig.gyroscope) headers.push('gyro_x', 'gyro_y', 'gyro_z');
        } else if (sourceMode === 'motorTest') {
             headers = ['timestamp', 'thrust', 'pressure']; 
        } else if (sourceMode === 'hydrostaticTest') {
            headers = ['timestamp', ...availableSeries]; 
        }
        dataAvailable = true;

    } else if (randomPlotting && randomDataLog.length > 0) {
        dataToDownload = [...randomDataLog]; 
        filename = `random-log-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.csv`;
        headers = ['timestamp', 'pressure', 'thrust', 'temperature']; 
        dataAvailable = true;
    }

    if (!dataAvailable) {
        if (!isSerialConnected && !randomPlotting && !document.hidden) {
             alert("No data was logged to download.");
        } else {
             console.log("Download requested, but no data available or session active.");
        }
        return;
    }

     let csvContent = headers.join(",") + "\n";
     csvContent += dataToDownload.map(row => {
        if (!row) return '';
        return headers.map(header => {
             const value = row[header];
             if (value === false) return 'false';
             return value === undefined || value === null ? '' : value;
         }).join(",");
     }).filter(line => line).join("\n"); 


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