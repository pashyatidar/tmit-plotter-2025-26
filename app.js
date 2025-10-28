// data structures containing data for plotting
let allData = [];
// MODIFIED: Added new arrays for flight mode
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
    gyro_z: []
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
let serialData = [];
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

// --- NEW: Flight Mode Variables ---
let flightConfig = {
    pressure: false,
    acceleration: false,
    gyroscope: false,
    delimiter: ','
};
let flightPlotLayout = 'raw'; // 'raw' or 'calculated'
let flightRawPlots = {}; // To hold uPlot instances
let flightCalcPlots = {}; // To hold uPlot instances
const flightAxisColors = {
    x: '#E63946', // Red
    y: '#52B788', // Green
    z: '#457B9D'  // Blue
};

// --- UI Element References (will be defined on DOMContentLoaded) ---
let sidebar, mainContent, menuToggle, pageTitle, navLinks, fileDropArea, csvFileInput,
    statsSidebar,
    plotButton, startRandomPlottingButton, pauseButton, resumeButton, downloadCsvButton,
    connectMotorTestButton, connectHydrostaticTestButton, restartCsvButton, restartRandomButton,
    restartSerialButton, resetCsvButton, resetRandomButton, resetSerialButton,
    serialConfigSelectors, themeToggle, motorTestControls, cmdArmButton, cmdDisarmButton, cmdLaunchButton,
    thumbnailContainers,
    // NEW: Flight Mode UI References
    flightPhaseDisplay, plotSwitchButton, flightPlottingArea, flightRawPlotsContainer,
    flightCalcPlotsContainer, connectRocketFlightButton, previewFlightLayoutButton,
    flightCheckPressure, flightCheckAcceleration, flightCheckGyroscope, flightDelimiterSelect,
    flightModeColorKey; // <<< ADDED


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Define UI Element References ---
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
    serialConfigSelectors = [
        document.getElementById('serialCol1'),
        document.getElementById('serialCol2'),
        document.getElementById('serialCol3')
    ];
    themeToggle = document.getElementById('themeToggle');
    motorTestControls = document.getElementById('motorTestControls');
    cmdArmButton = document.getElementById('cmdArm');
    cmdDisarmButton = document.getElementById('cmdDisarm');
    cmdLaunchButton = document.getElementById('cmdLaunch');
    launchOverlay = document.getElementById('launch-overlay');
    launchRocket = document.getElementById('launch-rocket');
    thumbnailContainers = document.querySelectorAll('.thumbnail-chart-container');

    // NEW: Flight Mode UI References
    flightPhaseDisplay = document.getElementById('flightPhaseDisplay');
    plotSwitchButton = document.getElementById('plotSwitchButton');
    flightPlottingArea = document.getElementById('flightPlottingArea');
    flightRawPlotsContainer = document.getElementById('flightRawPlotsContainer');
    flightCalcPlotsContainer = document.getElementById('flightCalcPlotsContainer');
    connectRocketFlightButton = document.getElementById('connectRocketFlight');
    previewFlightLayoutButton = document.getElementById('previewFlightLayout');
    flightCheckPressure = document.getElementById('flightCheckPressure');
    flightCheckAcceleration = document.getElementById('flightCheckAcceleration');
    flightCheckGyroscope = document.getElementById('flightCheckGyroscope');
    flightDelimiterSelect = document.getElementById('flightDelimiter');
    flightModeColorKey = document.getElementById('flightModeColorKey'); // <<< ADDED


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
            const currentPageId = document.querySelector('.page.active').id;
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
    serialConfigSelectors.forEach(selector => {
        safeAddEventListener(selector, 'change', updateSerialConfigUI);
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
            // Swapping is disabled in motor test mode as there are no thumbnails to swap with
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

    // --- NEW: Flight Mode Event Listeners ---
    safeAddEventListener(connectRocketFlightButton, 'click', () => connectToSerial('rocketFlight'));
    safeAddEventListener(previewFlightLayoutButton, 'click', () => {
        // Show the plotting page, then run the preview
        showPage('plottingPage', () => {
            setupFlightPlotLayout(true); // true = isPreview
        });
    });
    safeAddEventListener(plotSwitchButton, 'click', toggleFlightPlotView);
    const flightConfigChanged = () => {
        flightConfig.pressure = flightCheckPressure.checked;
        flightConfig.acceleration = flightCheckAcceleration.checked;
        flightConfig.gyroscope = flightCheckGyroscope.checked;
        flightConfig.delimiter = flightDelimiterSelect.value;

        const anySelected = flightConfig.pressure || flightConfig.acceleration || flightConfig.gyroscope;
        connectRocketFlightButton.disabled = !anySelected;
    };
    safeAddEventListener(flightCheckPressure, 'change', flightConfigChanged);
    safeAddEventListener(flightCheckAcceleration, 'change', flightConfigChanged);
    safeAddEventListener(flightCheckGyroscope, 'change', flightConfigChanged);
    safeAddEventListener(flightDelimiterSelect, 'change', flightConfigChanged);


    window.addEventListener('resize', handleResize);
    safeAddEventListener(mainContent, 'dblclick', toggleFullScreen);
    setupCustomSelects();
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
    // --- MODIFIED: Handle flight plots ---
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
    } else {
        // --- Original Logic ---
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

// --- MODIFIED: Show/Hide new UI elements based on mode ---
function showPage(pageId, onPageShownCallback = null) {
    if (pageId !== 'plottingPage') {
        currentMode = pageId.replace('Page', '');
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageElement = document.getElementById(pageId);
    if (pageElement) pageElement.classList.add('active');

    const isPlotPage = pageId === 'plottingPage';
    const isFlightMode = currentMode === 'rocketFlight';

    // --- Manage Plotting Area Visibility ---
    const originalPlotArea = document.getElementById('mainChartArea');
    if (isPlotPage) {
        if (isFlightMode) {
            if (originalPlotArea) originalPlotArea.style.display = 'none';
            if (flightPlottingArea) flightPlottingArea.style.display = 'flex';
            if (plotSwitchButton) plotSwitchButton.style.display = 'inline-flex';
            if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'inline-block';
            if (statsSidebar) statsSidebar.classList.add('flight-mode-active'); // Hides stats content
            if (flightModeColorKey) flightModeColorKey.style.display = 'block'; // <<< ADDED
        } else {
            if (originalPlotArea) originalPlotArea.style.display = 'flex';
            if (flightPlottingArea) flightPlottingArea.style.display = 'none';
            if (plotSwitchButton) plotSwitchButton.style.display = 'none';
            if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'none';
            if (statsSidebar) statsSidebar.classList.remove('flight-mode-active'); // Shows stats content
            if (flightModeColorKey) flightModeColorKey.style.display = 'none'; // <<< ADDED
        }
        statsSidebar.style.display = 'flex';
    } else {
        statsSidebar.style.display = 'none';
        if (plotSwitchButton) plotSwitchButton.style.display = 'none';
        if (flightPhaseDisplay) flightPhaseDisplay.style.display = 'none';
        if (flightModeColorKey) flightModeColorKey.style.display = 'none'; // <<< ADDED
    }

    // --- Manage Motor Test Controls (Original Logic) ---
    if (isPlotPage && currentMode === 'motorTest') {
        motorTestControls.style.display = 'block';
    } else {
        motorTestControls.style.display = 'none';
    }

    // --- Manage Nav Link State ---
    navLinks.forEach(link => {
        const linkPage = link.dataset.page;
        // Highlight the mode page even when the generic 'plottingPage' is shown
        if (linkPage === pageId || (isPlotPage && linkPage === currentMode + 'Page')) {
            link.classList.add('active');
            pageTitle.textContent = link.textContent.trim(); // Update title based on active link
        } else {
            link.classList.remove('active');
        }
    });


    if (onPageShownCallback) requestAnimationFrame(onPageShownCallback);
}

// --- MODIFIED: Added flight plot destruction ---
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
}

// --- MODIFIED: Reset new flight vars ---
async function fullReset() {
    triggerAutoDownload(); // Trigger download *before* clearing state
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
             // Reader cancel/release now handled in readSerialData finally block
             // await reader.cancel().catch(() => {});
             // reader.releaseLock();
             reader = null; // Ensure reader is nullified
        }
        // Port closing is handled in readSerialData finally block
        // await port.close().catch(() => {});
        port = null; // Ensure port is nullified
    }

    // Clear data buffers AFTER potential download
    allData = [];
    availableSeries = [];
    serialData = [];
    serialBuffer = [];
    randomDataLog = []; // Clear random log too
    resetUplotData(); // Clear plot data arrays

    // --- Destroy All Plots ---
    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }
    destroyFlightPlots(); // NEW

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
    if (flightModeColorKey) flightModeColorKey.style.display = 'none'; // <<< ADDED

    serialConfigSelectors.forEach(sel => { if(sel) sel.value = 'none'; });

    // --- Reset Flight Config ---
    if (flightCheckPressure) flightCheckPressure.checked = false;
    if (flightCheckAcceleration) flightCheckAcceleration.checked = false;
    if (flightCheckGyroscope) flightCheckGyroscope.checked = false;
    if (flightDelimiterSelect) flightDelimiterSelect.value = ',';
    if (connectRocketFlightButton) connectRocketFlightButton.disabled = true;
    flightConfig = { pressure: false, acceleration: false, gyroscope: false, delimiter: ',' };
    flightPlotLayout = 'raw';

    setupCustomSelects(); // Re-initialize custom selects
    if(document.getElementById('motorTestStatus')) document.getElementById('motorTestStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('hydrostaticTestStatus')) document.getElementById('hydrostaticTestStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('rocketFlightStatus')) document.getElementById('rocketFlightStatus').textContent = 'Status: Disconnected';
    if(motorTestControls) motorTestControls.style.display = 'none';
    const fsmStateElement = document.getElementById('fsmState');
    if(fsmStateElement) fsmStateElement.textContent = 'FSM State: --';
    if(csvFileInput) csvFileInput.value = ''; // Clear file input
}

// --- MODIFIED: Clear new flight data arrays ---
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
        gyro_z: []
    };
}

function resetMaxValues() {
    maxValues = {
        pressure: { value: -Infinity, timestamp: null },
        thrust: { value: -Infinity, timestamp: null },
        temperature: { value: -Infinity, timestamp: null }
        // Note: Max values for flight mode are not requested yet.
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

// --- ORIGINAL FUNCTION (NO CHANGES) ---
function startCsvPlotting() {
    if (!allData || allData.length === 0) {
        alert('Please load a valid CSV file first');
        return;
    }
    isPlotting = true;
    isSerialConnected = false;
    randomPlotting = false;
    currentMode = 'csv';

    // Dynamic UI setup based on available series
    // Hide all potential data-driven elements first
    document.querySelectorAll('[data-series]').forEach(el => el.style.display = 'none');

    // Show only the elements that correspond to data in the CSV
    availableSeries.forEach(series => {
        document.querySelectorAll(`[data-series="${series}"]`).forEach(el => {
            el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
        });
    });

    showPage('plottingPage', () => {
        setupChartInstances(); // This will now create a dynamic layout
        restartCsvButton.style.display = 'inline-block';
        resetCsvButton.style.display = 'inline-block';
        pauseButton.style.display = 'inline-block';
        resumeButton.style.display = 'inline-block';
        restartRandomButton.style.display = 'none';
        resetRandomButton.style.display = 'none';
        restartSerialButton.style.display = 'none';
        resetSerialButton.style.display = 'none';
        downloadCsvButton.style.display = 'none';
        restartCsvPlotting();
    });
}
// --- ORIGINAL FUNCTION (NO CHANGES) ---
function restartCsvPlotting() {
    if (!allData || allData.length === 0) return;
    isPaused = false;
    index = 0;
    resetUplotData(); // Use centralized reset
    updateAllPlots();
    resetMaxValues();
    startTime = performance.now();
    plotStartTime = allData[0].timestamp;
    requestAnimationFrame(plotCSVInterval);
    pauseButton.disabled = false;
    resumeButton.disabled = true;
}
// --- ORIGINAL FUNCTION (NO CHANGES) ---
function startRandomPlotting() {
    availableSeries = ['thrust', 'pressure', 'temperature'];
    randomPlotting = true;
    isPlotting = false;
    isSerialConnected = false;
    currentMode = 'random';
    // Show all sidebar elements for random mode
    document.querySelectorAll('[data-series]').forEach(el => {
        el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
    });
    showPage('plottingPage', () => {
        setupChartInstances();
        restartRandomButton.style.display = 'inline-block';
        resetRandomButton.style.display = 'inline-block';
        downloadCsvButton.style.display = 'inline-block';
        restartCsvButton.style.display = 'none';
        resetCsvButton.style.display = 'none';
        restartSerialButton.style.display = 'none';
        resetSerialButton.style.display = 'none';
        pauseButton.style.display = 'none';
        resumeButton.style.display = 'none';
        restartRandomPlotting();
    });
}
// --- ORIGINAL FUNCTION (NO CHANGES) ---
function restartRandomPlotting() {
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    resetUplotData(); // Use centralized reset
    randomDataLog = [];
    updateAllPlots();
    resetMaxValues();
    startTime = performance.now();
    randomPlotInterval = setInterval(() => {
        const elapsedTime = (performance.now() - startTime) / 1000;
        const p = 1013 + Math.sin(elapsedTime) * 10 + (Math.random() - 0.5) * 5;
        const th = 25 + Math.cos(elapsedTime * 0.5) * 20 + (Math.random() - 0.5) * 5;
        const temp = 40 + Math.sin(elapsedTime * 0.2) * 15 + (Math.random() - 0.5) * 3;
        // Use elapsed time in ms for the timestamp to be consistent for CSV export
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

// --- MODIFIED: Clear all uplot data on serial restart ---
function restartSerialPlotting() {
    // Don't trigger auto download here, only on disconnect/reset
    resetUplotData(); // Use centralized reset
    serialData = []; // Clear log data
    serialBuffer = []; // Clear unprocessed buffer
    updateAllPlots(); // Update plots with empty data
    if(currentMode !== 'rocketFlight') {
        resetMaxValues(); // Don't reset max values for flight mode (yet)
    }
}

// --- MODIFIED: Handle flight mode config ---
async function connectToSerial(mode) {
    currentMode = mode;

    // --- Clear and Set up available series based on mode ---
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
        // availableSeries is not used; flightConfig is used instead.
        // Stats sidebar visibility is handled by showPage()
    }

    try {
        port = await navigator.serial.requestPort();
        if (!port) return;
        lastConnectedPortInfo = port.getInfo();
        localStorage.setItem('lastConnectedPortInfo', JSON.stringify(lastConnectedPortInfo));
        await port.open({ baudRate: 9600 });
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
            setupChartInstances(); // This will now delegate to flight or original setup
            restartSerialButton.style.display = 'inline-block';
            resetSerialButton.style.display = 'inline-block';
            downloadCsvButton.style.display = 'inline-block';
            restartCsvButton.style.display = 'none';
            resetCsvButton.style.display = 'none';
            restartRandomButton.style.display = 'none';
            resetRandomButton.style.display = 'none';
            pauseButton.style.display = 'none';
            resumeButton.style.display = 'none';

            const statusEl = document.getElementById(`${currentMode}Status`);
            if (statusEl) statusEl.textContent = 'Status: Connected';

            restartSerialPlotting(); // Clear data from previous sessions *before* starting to read
            keepReading = true; // Ensure reading is enabled
            readSerialData(); // Start reading in the background
            if (serialUpdateInterval) clearInterval(serialUpdateInterval);
            serialUpdateInterval = setInterval(updateFromBuffer, 50); // Start processing buffer
        });
    } catch (error) {
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to serial device.');
        showPage(`${currentMode}Page`);
        lastConnectedPortInfo = null; // Clear last connected info on failure
         isSerialConnected = false; // Ensure state is correct
         port = null; // Ensure port is nullified
    }
}
async function resetCsvMode() { await fullReset(); showPage('csvPage'); }
async function resetRandomMode() { await fullReset(); showPage('randomPage'); }
// --- MODIFIED: Handle new flight mode page ---
async function resetSerialMode() {
    const pageToRestore = currentMode; // Remember the mode before reset
     // Ensure reading stops *before* fullReset tries to close the port again
     keepReading = false;
     if (reader) {
        await reader.cancel().catch(() => {}); // Attempt to cancel reader if active
        reader = null;
     }
     // Port closing is handled within fullReset now
    await fullReset(); // Handles download, closing port, clearing data etc.
    // Restore the config page for the mode we just reset
    if (pageToRestore === 'motorTest') showPage('motorTestPage');
    else if (pageToRestore === 'hydrostaticTest') showPage('hydrostaticTestPage');
    else if (pageToRestore === 'rocketFlight') showPage('rocketFlightPage');
}
function attemptReconnect() {
    if (reconnectInterval) clearInterval(reconnectInterval); // Clear any existing interval
     console.log("Starting reconnect attempts...");
    reconnectInterval = setInterval(async () => {
        // Stop if we are already connected or if user intentionally disconnected
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
                // Check if vendor and product IDs exist before comparing
                return lastConnectedPortInfo.usbVendorId && lastConnectedPortInfo.usbProductId &&
                       info.usbVendorId === lastConnectedPortInfo.usbVendorId &&
                       info.usbProductId === lastConnectedPortInfo.usbProductId;
            });

            if (matchingPort) {
                console.log('Device re-detected. Attempting to connect...');
                clearInterval(reconnectInterval); // Stop trying once found
                reconnectInterval = null;
                // Don't set `port` here, let connectToSerial handle it
                await connectToSerial(currentMode); // Try to connect
            } else {
                 console.log('Reconnect: Device not found yet...');
                 // Update status only if still relevant
                 const statusEl = document.getElementById(`${currentMode}Status`);
                 if(statusEl && statusEl.textContent.includes('reconnecting')) {
                    // Optionally add dots or change message slightly
                 }
            }
        } catch (error) {
            console.error('Error during reconnect attempt:', error);
            // Consider stopping after multiple errors?
            // clearInterval(reconnectInterval);
            // reconnectInterval = null;
        }
    }, 2000); // Check every 2 seconds
}


// --- MODIFIED: Create new flight-specific chart options ---
function getFlightChartOptions(seriesType, isPreview = false) {
    const themeColors = getThemeColors();
    let opts = {
        legend: { show: false }, // <<< Keep legend off for cleaner look
        scales: { x: { time: false }, y: { auto: true } },
        series: [{}], // Placeholder for time
        axes: [
            { scale: 'x', label: 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } },
            { label: 'Value', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } }
        ],
        cursor: {
            y: false // Disable y-cursor for multi-series plots
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
        // Make preview charts simpler
        opts.legend.show = false;
        opts.axes[0].label = null;
        opts.axes[1].label = seriesType.charAt(0).toUpperCase() + seriesType.slice(1); // Simple label for preview
    }
    return opts;
}

// --- ORIGINAL FUNCTION (NO CHANGES) ---
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
            series: [{}, { stroke: seriesConfig[seriesName]?.stroke || '#ccc', width: 2 }], // Fallback color
        };

    } else {
        const config = seriesConfig[seriesName] || { label: seriesName, stroke: '#ccc' }; // Fallback config
        const opts = {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            series: [{}, { ...config, points: { show: false } }], // Use fetched or fallback config
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

// --- NEW/MODIFIED: Function to build the dynamic flight layout ---
function setupFlightPlotLayout(isPreview = false) {
    destroyFlightPlots();
    flightRawPlotsContainer.innerHTML = ''; // Clear previous layout
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
    const plotIds = []; // Keep track of generated plot IDs

    // Remove existing layout classes before adding new one
    flightRawPlotsContainer.className = 'main-chart-area'; // Reset class

    if (numSelected === 3) {
        // --- NEW 2x2 Layout ---
        flightRawPlotsContainer.classList.add('layout-two-by-two'); // Use a generic 2x2 class
        // Order: Bottom-Left, Top-Right, Bottom-Right (as per user request)
        plotIds.push('flight-plot-bottom-left', 'flight-plot-top-right', 'flight-plot-bottom-right');
        layoutHTML = `
            <div class="plot-wrapper blank plot-top-left"></div>
            <div id="flight-plot-top-right" class="plot-wrapper plot-top-right"></div>
            <div id="flight-plot-bottom-left" class="plot-wrapper plot-bottom-left"></div>
            <div id="flight-plot-bottom-right" class="plot-wrapper plot-bottom-right"></div>
        `;
    } else if (numSelected === 2) {
        flightRawPlotsContainer.classList.add('layout-three-split');
        plotIds.push('flight-plot-top-right', 'flight-plot-bottom-right'); // Plot IDs for the right column
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half"></div>
            <div class="plot-right-column">
                <div id="flight-plot-top-right" class="plot-wrapper plot-right-quarter"></div>
                <div id="flight-plot-bottom-right" class="plot-wrapper plot-right-quarter"></div>
            </div>
        `;
    } else if (numSelected === 1) {
        flightRawPlotsContainer.classList.add('layout-two-split');
         plotIds.push('flight-plot-right-half');
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half"></div>
            <div id="flight-plot-right-half" class="plot-wrapper plot-right-half"></div>
        `;
    } else {
        // No layout class needed for the message
        layoutHTML = `<div class="plot-wrapper blank-calc"><h2>Select data streams to preview layout.</h2></div>`;
    }

    flightRawPlotsContainer.innerHTML = layoutHTML;

    // Create uPlot instances, mapping selected types to plotIds
    selectedTypes.forEach((type, i) => {
        const plotId = plotIds[i]; // Get the correct ID based on the layout
        if (!plotId) return; // Should not happen if logic is correct
        const wrapper = document.getElementById(plotId);
        if (!wrapper) return;

        const opts = getFlightChartOptions(type, isPreview);
        // Ensure time array exists and provide initial data structure
        let data = [isPreview ? [0] : (uplotData.time || [])]; // Ensure time array

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

         // Ensure data arrays have at least one point for uPlot initialization if not preview
        if (!isPreview && data[0].length === 0) {
            data = data.map(() => [null]); // Use null placeholder if no real data yet
        } else if (isPreview && data[0].length === 0) {
             // For preview with no data, use a single [0] for time and corresponding [0]s for data
             data = data.map(() => [0]);
        }


        try {
            flightRawPlots[type] = {
                instance: new uPlot(opts, data, wrapper),
                wrapper: wrapper
            };
        } catch (uPlotError) {
             console.error(`Error creating uPlot for ${type} in ${plotId}:`, uPlotError, "Options:", opts, "Data:", data);
             // Optionally display an error message in the plot wrapper
             wrapper.innerHTML = `<p style="color: red; text-align: center; padding-top: 20px;">Error creating plot.</p>`;
        }
    });


    handleResize(); // Adjust size after creating plots
}


// --- NEW: Function to switch between raw/calculated plots ---
function toggleFlightPlotView() {
    if (flightPlotLayout === 'raw') {
        flightPlotLayout = 'calculated';
        flightRawPlotsContainer.style.display = 'none'; // Hide raw plots
        flightCalcPlotsContainer.style.display = 'flex'; // Show calc plots
        plotSwitchButton.title = 'Show Raw Plots';
    } else {
        flightPlotLayout = 'raw';
        // Re-apply correct display based on selected number
        const numSelected = (flightConfig.pressure ? 1 : 0) + (flightConfig.acceleration ? 1 : 0) + (flightConfig.gyroscope ? 1 : 0);
        if (numSelected === 3) {
            flightRawPlotsContainer.style.display = 'grid'; // Use grid for the 2x2 layout
        } else if (numSelected > 0) {
            flightRawPlotsContainer.style.display = 'flex'; // Use flex for other layouts
        } else {
             flightRawPlotsContainer.style.display = 'flex'; // Default flex for message
        }
        flightCalcPlotsContainer.style.display = 'none'; // Hide calc plots
        plotSwitchButton.title = 'Show Calculated Plots';
    }
    handleResize(); // Resize needed after display change
}



// --- MODIFIED: Branch logic for flight mode vs. other modes ---
function setupChartInstances() {
    // --- THIS IS THE CRITICAL BRANCH ---
    if (currentMode === 'rocketFlight') {
        setupFlightPlotLayout(false); // false = not a preview

    } else {
        // --- ORIGINAL LOGIC (UNAFFECTED) ---
        // Clear previous instances
        if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
        if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
        if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
        if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
        if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }

        const mainChartArea = document.getElementById('mainChartArea');
        const wrapper1 = document.getElementById('uplot-main-wrapper-1');
        const wrapper2 = document.getElementById('uplot-main-wrapper-2');

        // Ensure plot data arrays exist
        const timeData = uplotData.time || [];

        // This logic now applies to CSV, Random, and Serial modes (Hydro/Motor)
        if (availableSeries.length === 1) {
            // --- SINGLE CHART LAYOUT ---
            mainChartArea.classList.remove('two-chart-layout');
            wrapper1.style.display = 'flex';
            wrapper2.style.display = 'none';

            mainPlot1.series = availableSeries[0];
            const opts1 = getChartOptions(mainPlot1.series);
            const data1 = [timeData, uplotData[mainPlot1.series] || []];
             // Ensure data arrays have at least one point or null
            if (data1[0].length === 0) data1.forEach(arr => arr.push(null));
            mainPlot1.instance = new uPlot(opts1, data1, wrapper1);


        } else if (availableSeries.length >= 2) {
            // --- TWO CHART LAYOUT ---
            mainChartArea.classList.add('two-chart-layout');
            wrapper1.style.display = 'flex';
            wrapper2.style.display = 'flex';

            // Plot first series in the left chart
            mainPlot1.series = availableSeries[0];
            const opts1 = getChartOptions(mainPlot1.series);
            const data1 = [timeData, uplotData[mainPlot1.series] || []];
             if (data1[0].length === 0) data1.forEach(arr => arr.push(null));
            mainPlot1.instance = new uPlot(opts1, data1, wrapper1);


            // Plot second series in the right chart
            mainPlot2.series = availableSeries[1];
            const opts2 = getChartOptions(mainPlot2.series);
            const data2 = [timeData, uplotData[mainPlot2.series] || []];
            if (data2[0].length === 0) data2.forEach(arr => arr.push(null));
            mainPlot2.instance = new uPlot(opts2, data2, wrapper2);
        }

        // Create all thumbnail plots (their containers' visibility is controlled by each mode's setup function)
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
         // Define axis configuration with checks for theme colors
        const axisConfig = {
            stroke: themeColors.axes,
            grid: { stroke: themeColors.grid },
            ticks: { stroke: themeColors.grid },
            labelFont: '14px sans-serif',
            valueFont: '12px sans-serif'
        };
        // Update both axes using the configuration
         // Check if instance has axes before setting
         if (instance.axes && instance.axes.length >= 2) {
            instance.setAxes([axisConfig, axisConfig]);
         } else {
             // Handle cases where axes might not be fully initialized (less common)
             instance.redraw(); // Attempt a redraw which might apply styles
         }


        const svg = instance.root?.querySelector('svg'); // Use optional chaining
        if (svg) {
            svg.querySelectorAll('.u-axis text, .u-legend th, .u-legend td').forEach(el => {
                 if (el) el.style.fill = themeColors.labels; // Apply label color to legend too
            });
        }
    };

    // --- MODIFIED: Update new flight plots ---
    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(plot => updateInstanceStyles(plot.instance));
        Object.values(flightCalcPlots).forEach(plot => updateInstanceStyles(plot.instance));
    } else {
        // --- Original Logic ---
        updateInstanceStyles(mainPlot1.instance);
        updateInstanceStyles(mainPlot2.instance);
        updateInstanceStyles(uplotPressureThumb);
        updateInstanceStyles(uplotThrustThumb);
        updateInstanceStyles(uplotTempThumb);
    }
}

// --- ORIGINAL FUNCTION (NO CHANGES) ---
function swapMainChart(seriesName) {
     // Ensure not in flight mode
     if (currentMode === 'rocketFlight' || !seriesName || mainPlot1.series === seriesName) {
        return;
    }


    // Update the series for the first main plot
    mainPlot1.series = seriesName;

    // Destroy and recreate the first uPlot instance with the new series
    if (mainPlot1.instance) {
        mainPlot1.instance.destroy();
    }
    const wrapper = document.getElementById('uplot-main-wrapper-1');
     if (!wrapper) return; // Add check for wrapper existence
    const opts = getChartOptions(mainPlot1.series);
     // Ensure data arrays exist and have at least one point or null
     const data = [uplotData.time || [], uplotData[mainPlot1.series] || []];
     if (data[0].length === 0) data.forEach(arr => arr.push(null));
    mainPlot1.instance = new uPlot(opts, data, wrapper);


    updateActiveThumbnails();
    handleResize();
}

// --- ORIGINAL FUNCTION (NO CHANGES) ---
function updateActiveThumbnails() {
    // Ensure this only runs if thumbnailContainers exist (not in flight mode)
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

// =================================================================================
// MODIFIED: This function now branches logic for flight mode
// =================================================================================
function updateAllPlots() {
    // Ensure uplotData.time exists and is an array
    const timeData = Array.isArray(uplotData.time) ? uplotData.time : [];

    // --- THIS IS THE CRITICAL BRANCH ---
    if (currentMode === 'rocketFlight') {
        // --- Flight Mode Plot Update ---
        if (flightRawPlots.pressure && flightRawPlots.pressure.instance) {
            flightRawPlots.pressure.instance.setData([timeData, uplotData.pressure || []], false); // Use false to defer redraw
        }
        if (flightRawPlots.acceleration && flightRawPlots.acceleration.instance) {
            flightRawPlots.acceleration.instance.setData([timeData, uplotData.acc_x || [], uplotData.acc_y || [], uplotData.acc_z || []], false);
        }
        if (flightRawPlots.gyroscope && flightRawPlots.gyroscope.instance) {
            flightRawPlots.gyroscope.instance.setData([timeData, uplotData.gyro_x || [], uplotData.gyro_y || [], uplotData.gyro_z || []], false);
        }
        // (Add logic for calculated plots here when ready)

    } else {
        // --- Original Mode Plot Update ---
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


    // --- Shared X-Axis Scaling Logic ---
    const dataLength = timeData.length; // Use guaranteed timeData array

    // Only adjust scale if we have data and are connected or doing CSV playback
    let newScale = null; // Initialize to null
    if (dataLength >= 1 && (isSerialConnected || randomPlotting || isPlotting)) {
        // For Random and Serial (ALL serial) modes, use a 20-second sliding window *while connected*
        if ((randomPlotting || isSerialConnected) && dataLength >= 2) { // Need 2 points for sliding window
            const windowEndTime = timeData[dataLength - 1];
            if (typeof windowEndTime === 'number' && !isNaN(windowEndTime)) {
                const windowStartTime = Math.max(0, windowEndTime - 20); // Prevent negative start time
                newScale = { min: windowStartTime, max: windowEndTime };
            }
        } else if (isPlotting && dataLength >= 1) { // CSV playback needs only 1 point to determine range
            const windowStartTime = timeData[0];
             const windowEndTime = timeData[dataLength - 1]; // Use last point for max
             if (typeof windowStartTime === 'number' && !isNaN(windowStartTime) &&
                 typeof windowEndTime === 'number' && !isNaN(windowEndTime)) {
                const duration = windowEndTime - windowStartTime;
                const padding = duration > 0 ? duration * 0.1 : 1; // Add padding of 1 if duration is 0
                const newMin = windowStartTime; // Start from the actual beginning
                const newMax = windowEndTime + padding;
                newScale = { min: newMin, max: newMax };
             }
        }
         // If NOT connected/playing back (e.g., after disconnect), scale is handled elsewhere (readSerialData finally block for flight mode)
    }


    // Apply the determined scale and redraw all relevant plots
    const applyScaleAndRedraw = (instance, scale) => {
        if (instance) {
            if (scale) {
                instance.setScale('x', scale);
            } else {
                instance.redraw(false); // Redraw without changing scale if no new scale determined
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


// --- MODIFIED: Added auto-rescale logic for flight mode on disconnect ---
async function readSerialData() {
    if (!port || !port.readable) {
        console.warn("readSerialData called but port is not readable.");
        return; // Exit if port is already gone
    }
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    let readableStreamClosed;
    try {
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        while (true) {
            // Check keepReading flag *before* reading
            if (!keepReading) {
                 console.log("keepReading is false, exiting read loop before read().");
                 break;
            }
            const { value, done } = await reader.read();
            if (done) {
                 console.log("Reader stream reported done.");
                 break; // Exit loop if stream ended
            }
            // value will be Uint8Array if keepReading became false during read()
            if (!value) continue;

            lineBuffer += value; // value is already decoded string here
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || ''; // Handle potential empty pop
            for (const line of lines) {
                if (line.trim()) serialBuffer.push(line.trim());
            }
        }
    } catch (error) {
         // Only log error if we weren't intentionally stopping
        if (keepReading) {
            console.error('Error reading from serial port:', error);
        } else {
             console.log("Read loop caught error during intentional disconnect/stop.");
        }
    } finally {
         console.log("Entering readSerialData finally block...");
         const wasSerialConnected = isSerialConnected; // Capture state before changing
         const disconnectedMode = currentMode; // Capture mode at time of disconnect

         isSerialConnected = false; // Set connected state to false

        if (serialUpdateInterval) {
            clearInterval(serialUpdateInterval);
            serialUpdateInterval = null;
            console.log("Cleared serialUpdateInterval.");
        }


         // --- Cleanup Reader ---
        if (reader) {
            console.log("Attempting to cancel and release reader...");
            try {
                 // Cancel might throw if stream is already closed/errored, which is okay
                await reader.cancel().catch(e => console.log("Reader cancel error (expected on disconnect):", e));
                reader.releaseLock();
                console.log("Reader released.");
            } catch (releaseError) {
                console.warn("Error releasing reader lock:", releaseError);
            } finally {
                 reader = null; // Nullify reader
            }
        } else {
             console.log("Reader was already null.");
        }

         // Wait for the stream piping to finish (catches errors if pipe failed)
        if (readableStreamClosed) {
             console.log("Waiting for readableStreamClosed...");
            await readableStreamClosed.catch(() => {}); // Catch error, but don't log it verbosely
             console.log("readableStreamClosed finished.");
        }

        // --- Cleanup Port ---
        // Close the port if it's still openable/closable
        if (port && port.close) { // Check if port object exists and has close method
             console.log("Attempting to close port...");
             try {
                await port.close();
                console.log("Port closed.");
             } catch (closeError) {
                console.warn("Error closing port (might be already closed):", closeError);
             } finally {
                 port = null; // Nullify port
             }
        } else {
            console.log("Port was already null or not closable.");
             port = null; // Ensure it's nullified
        }

        // --- Post-Disconnect Actions ---
        console.log("Performing post-disconnect actions...");
        // Trigger auto-download if the connection *was* active and data exists
        if (wasSerialConnected && serialData.length > 0) {
            console.log("Session ended with data. Triggering auto-download.");
            downloadDataAsCSV(); // Download the data collected
            // serialData = []; // Clear log data *after* download for next session (Handled by restart/reset now)

            // --- *** MODIFIED: Auto-rescale for ALL Serial Modes *** ---
            const isAnySerialMode = ['rocketFlight', 'motorTest', 'hydrostaticTest'].includes(disconnectedMode);
            if (isAnySerialMode && uplotData.time && uplotData.time.length > 0) {
                console.log(`Rescaling ${disconnectedMode} plot to full range after disconnect.`);
                const minTime = uplotData.time[0];
                const maxTime = uplotData.time[uplotData.time.length - 1];
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
                } else { // Motor Test or Hydrostatic Test
                    if (mainPlot1.instance) mainPlot1.instance.setScale('x', fullScale);
                    if (mainPlot2.instance) mainPlot2.instance.setScale('x', fullScale);
                    // Optionally rescale thumbnails too, though less critical
                    // if (uplotPressureThumb) uplotPressureThumb.setScale('x', fullScale);
                    // if (uplotThrustThumb) uplotThrustThumb.setScale('x', fullScale);
                    // if (uplotTempThumb) uplotTempThumb.setScale('x', fullScale);
                }
                 console.log(`${disconnectedMode} plot rescale applied.`);
            }
             // --- *** End Auto-rescale Modification *** ---

        } else if (wasSerialConnected) {
             console.log("Session ended, but no serial data logged.");
        }

        // Reset FSM state display if it was motor test mode
        if (disconnectedMode === 'motorTest') {
             const fsmStateElement = document.getElementById('fsmState');
            if (fsmStateElement) {
                fsmStateElement.textContent = 'FSM State: --'; // Reset state on disconnect
                fsmStateElement.className = 'stat-box fsm-state';
            }
        }

        // Update status display and handle reconnection logic
        const statusEl = document.getElementById(`${disconnectedMode}Status`); // Use captured mode
        // Attempt reconnect only if disconnect wasn't intentional (keepReading was true)
        // and we had info about the last port
        if (lastConnectedPortInfo && keepReading) {
            if (statusEl) statusEl.textContent = 'Status: Disconnected. Attempting to reconnect...';
            // Start reconnect interval only if not already running
            if (!reconnectInterval) {
                 attemptReconnect();
            }
        } else {
             // If disconnect was intentional (Reset button clicked -> keepReading = false)
             // or if we never had port info
            if (statusEl) statusEl.textContent = 'Status: Disconnected';
             // If we stopped intentionally, clear last port info and stop reconnect attempts
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


// --- MODIFIED: Push data to new flight arrays ---
function updateFromBuffer() {
    if (serialBuffer.length === 0 || !isSerialConnected) return; // Don't process if disconnected

    const pointsToProcess = serialBuffer.splice(0, serialBuffer.length);
    let plotNeedsUpdate = false; // Flag to update plots only once per batch

    pointsToProcess.forEach(line => {
        const data = processSerialLine(line);
        if (data && typeof data.timestamp === 'number' && !isNaN(data.timestamp)) {
            serialData.push(data); // Log all parsed data points

            // Use absolute timestamp in seconds for plotting
            const timeInSeconds = data.timestamp / 1000;

            // Basic check for time monotonicity (optional, but good practice)
            if (uplotData.time.length > 0 && timeInSeconds <= uplotData.time[uplotData.time.length - 1]) {
                // console.warn("Timestamp not increasing, skipping point:", timeInSeconds, data);
                // Decide whether to skip or just plot anyway
                 // return; // Uncomment to strictly enforce monotonicity
            }


            uplotData.time.push(timeInSeconds);

            if (currentMode === 'rocketFlight') {
                // Ensure arrays exist before pushing
                 if (!uplotData.pressure) uplotData.pressure = [];
                 if (!uplotData.acc_x) uplotData.acc_x = [];
                 if (!uplotData.acc_y) uplotData.acc_y = [];
                 if (!uplotData.acc_z) uplotData.acc_z = [];
                 if (!uplotData.gyro_x) uplotData.gyro_x = [];
                 if (!uplotData.gyro_y) uplotData.gyro_y = [];
                 if (!uplotData.gyro_z) uplotData.gyro_z = [];

                uplotData.pressure.push(data.pressure ?? null);
                uplotData.acc_x.push(data.acc_x ?? null);
                uplotData.acc_y.push(data.acc_y ?? null);
                uplotData.acc_z.push(data.acc_z ?? null);
                uplotData.gyro_x.push(data.gyro_x ?? null);
                uplotData.gyro_y.push(data.gyro_y ?? null);
                uplotData.gyro_z.push(data.gyro_z ?? null);
                // (No max/min update for flight mode yet)
            } else {
                // Ensure these arrays exist before pushing
                if (!uplotData.thrust) uplotData.thrust = [];
                if (!uplotData.pressure) uplotData.pressure = [];
                if (!uplotData.temperature) uplotData.temperature = [];

                uplotData.thrust.push(data.thrust ?? null);
                uplotData.pressure.push(data.pressure ?? null);
                uplotData.temperature.push(data.temperature ?? null);
                updateMaxMinValues(data, timeInSeconds); // Update stats for non-flight modes
            }
            plotNeedsUpdate = true; // Mark that plots need updating
        }
    });

    if (plotNeedsUpdate) {
        updateAllPlots(); // Update plots once after processing the buffer
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
            if(plotButton) plotButton.disabled = true; // Disable button on error
             if(csvFileInput) csvFileInput.value = ''; // Clear file input on error

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
     resetUplotData(); // Clear previous data before parsing new file
    allData = [];
    availableSeries = [];

    const lines = csvText.trim().split(/[\r\n]+/).map(line => line.trim()).filter(line => line); // Handle different line endings and filter empty lines
    if (lines.length < 2) {
        console.error("CSV has less than 2 lines (header + data).");
        return false;
    }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '')); // Remove quotes from headers
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
            return null; // Skip rows with invalid timestamps
        }
        if (timestampUnitSelected === 's') {
            time *= 1000; // Convert seconds to milliseconds
        }
        const point = { timestamp: time };
        availableSeries.forEach(s => {
            const colIdx = seriesIndices[s];
            if (cols.length > colIdx) {
                 const valStr = cols[colIdx]?.trim();
                const val = parseFloat(valStr);
                // Allow 0 but treat empty strings or non-numeric as null
                point[s] = (valStr !== '' && !isNaN(val)) ? val : null;
            } else {
                point[s] = null; // Assign null if column doesn't exist for this row
            }
        });
        return point;
    }).filter(point => point !== null); // Remove skipped rows

    if (allData.length === 0) {
         console.error("No valid data rows found in CSV after parsing.");
        return false;
    }

    allData.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
    return true; // Success
}
function plotCSVInterval() {
    if (!isPlotting || isPaused || index >= allData.length) {
        if (index >= allData.length && isPlotting) {
            console.log("CSV plotting finished.");
            isPlotting = false; // Stop plotting when done
            if(pauseButton) pauseButton.disabled = true;
            if(resumeButton) resumeButton.disabled = true;
        }
        return;
    }

    const elapsedRealTime = performance.now() - startTime;
    // Calculate the target timestamp in the data's time domain (milliseconds)
    const targetTimestamp = plotStartTime + elapsedRealTime;

    let pointsAdded = false;
    while (index < allData.length && allData[index].timestamp <= targetTimestamp) {
        const point = allData[index];
        // Convert timestamp to seconds for plotting
        const timeInSeconds = point.timestamp / 1000;

        // Check for required arrays before pushing
        if (!uplotData.time) uplotData.time = [];
        if (!uplotData.pressure) uplotData.pressure = [];
        if (!uplotData.thrust) uplotData.thrust = [];
        if (!uplotData.temperature) uplotData.temperature = [];

        uplotData.time.push(timeInSeconds);
        // Push data based on availableSeries determined during parsing
        uplotData.pressure.push(availableSeries.includes('pressure') ? (point.pressure ?? null) : null);
        uplotData.thrust.push(availableSeries.includes('thrust') ? (point.thrust ?? null) : null);
        uplotData.temperature.push(availableSeries.includes('temperature') ? (point.temperature ?? null) : null);

        updateMaxMinValues(point, timeInSeconds); // Update stats
        index++;
        pointsAdded = true;
    }

    if (pointsAdded) {
        updateAllPlots(); // Update charts only if new points were added
    }

    requestAnimationFrame(plotCSVInterval); // Continue the loop
}


// --- MODIFIED: Add 'rocketFlight' parsing logic ---
function processSerialLine(line) {
    const cleanLine = line.replace(/[^\x20-\x7E]/g, '').trim(); // Trim whitespace too

     // Ignore empty lines
    if (!cleanLine) return null;

    if (currentMode === 'motorTest') {
        if (cleanLine.startsWith("AT+SEND") || cleanLine === "OK") {
            return null; // Ignore command echoes and confirmations
        }

        if (cleanLine.startsWith("+RCV=")) {
            const parts = cleanLine.split(',');
            // Example: +RCV=42,3,1000.5,20.1,1013.2,-10,0
            if (parts.length < 5) {
                 console.warn("Ignoring short +RCV message:", cleanLine);
                 return null;
            }

            // Extract the data payload (flexible extraction)
            // Assumes format: +RCV=ID,LEN,DATA1,DATA2,...,RSSI,SNR
            const dataPayloadString = parts.slice(2, -2).join(',').trim(); // Data between LEN and RSSI

            // Check if payload is a known FSM state
            const FSM_STATES = ['SAFE', 'ARMED', 'LAUNCHED', 'BOOT', 'FAILURE'];
            if (FSM_STATES.includes(dataPayloadString)) {
                const state = dataPayloadString;
                const fsmStateElement = document.getElementById('fsmState');
                 if (fsmStateElement) {
                    fsmStateElement.textContent = `FSM State: ${state}`;
                    fsmStateElement.className = 'stat-box fsm-state'; // Reset classes
                    if (state === 'ARMED') fsmStateElement.classList.add('armed');
                    else if (state === 'LAUNCHED') fsmStateElement.classList.add('launched');
                    else if (state === 'FAILURE') fsmStateElement.classList.add('failure');
                 }


                // Check if this state confirms a pending command
                if (waitingForState && state === waitingForState) {
                    console.log(`State confirmation received: ${state}. Stopping retries.`);
                    clearTimeout(commandTimeout);
                    isRetryingCommand = false;
                    waitingForState = null;
                     // Re-enable buttons after confirmation
                    if (cmdArmButton) cmdArmButton.disabled = false;
                    if (cmdDisarmButton) cmdDisarmButton.disabled = false;
                    if (cmdLaunchButton) cmdLaunchButton.disabled = false;
                }

                 // Restart plot *only* on transitions indicating a new test sequence might start
                 if (state === 'ARMED' || state === 'LAUNCHED') {
                     console.log(`State changed to ${state}, restarting plot.`);
                     restartSerialPlotting(); // Clear previous plot data
                 }


                return null; // Handled as state, not plot data
            }
            else {
                // --- Attempt to parse as Sensor Data ---
                 // Expected format within payload: timestamp,thrust,pressure
                const dataValues = dataPayloadString.split(',');
                if (dataValues.length === 3) {
                    const timestamp = parseFloat(dataValues[0]);
                    const thrust = parseFloat(dataValues[1]);
                    const pressure = parseFloat(dataValues[2]);

                     // Validate parsed numbers
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
            // Log unexpected lines in motor test mode if necessary
             // console.log("Motor Test - Unrecognized line:", cleanLine);
        }
    } else if (currentMode === 'hydrostaticTest') {
         // Expected format: timestamp,val1,val2,val3 (depending on selection)
        const cols = cleanLine.split(','); // Assuming comma delimiter for hydro
        const timestamp = parseFloat(cols[0]);
        if (isNaN(timestamp)) {
             console.warn("Hydro - Invalid timestamp:", cols[0], "Line:", cleanLine);
            return null;
        }

        const point = { timestamp: timestamp };
        availableSeries.forEach((seriesName, index) => {
            const colIndex = index + 1; // Data starts from index 1
            if (cols.length > colIndex) {
                 const valStr = cols[colIndex]?.trim();
                const val = parseFloat(valStr);
                point[seriesName] = (valStr !== '' && !isNaN(val)) ? val : null;
            } else {
                point[seriesName] = null; // Assign null if column missing
            }
        });
        return point;
    }
    // --- NEW: Rocket Flight Parsing Logic ---
    else if (currentMode === 'rocketFlight') {
         // Expected format: timestamp<DELIM>pressure<DELIM>accX,Y,Z<DELIM>gyroX,Y,Z
        const cols = cleanLine.split(flightConfig.delimiter);
        const timestamp = parseFloat(cols[0]);
        if (isNaN(timestamp)) {
             console.warn("Flight - Invalid timestamp:", cols[0], "Line:", cleanLine);
            return null;
        }

        const point = { timestamp: timestamp };
        let expectedCols = 1; // Start with 1 for timestamp
        if (flightConfig.pressure) expectedCols += 1;
        if (flightConfig.acceleration) expectedCols += 3;
        if (flightConfig.gyroscope) expectedCols += 3;

         // Basic check for column count, might need adjustment if some are optional AND missing at the end
        if (cols.length < expectedCols) {
             console.warn(`Flight - Incorrect number of columns. Expected ${expectedCols}, got ${cols.length}. Line:`, cleanLine);
            // return null; // Optionally skip, or try to parse what's available
        }

        let colIndex = 1; // Start parsing data after timestamp

        try {
            if (flightConfig.pressure) {
                 const valStr = cols[colIndex++]?.trim();
                const val = parseFloat(valStr);
                point.pressure = (valStr !== '' && !isNaN(val)) ? val : null;
            } else { point.pressure = null; } // Ensure property exists even if not selected

            if (flightConfig.acceleration) {
                 const xStr = cols[colIndex++]?.trim();
                 const yStr = cols[colIndex++]?.trim();
                 const zStr = cols[colIndex++]?.trim();
                 const x = parseFloat(xStr);
                 const y = parseFloat(yStr);
                 const z = parseFloat(zStr);
                point.acc_x = (xStr !== '' && !isNaN(x)) ? x : null;
                point.acc_y = (yStr !== '' && !isNaN(y)) ? y : null;
                point.acc_z = (zStr !== '' && !isNaN(z)) ? z : null;
            } else { point.acc_x = null; point.acc_y = null; point.acc_z = null; } // Ensure properties exist

            if (flightConfig.gyroscope) {
                 const xStr = cols[colIndex++]?.trim();
                 const yStr = cols[colIndex++]?.trim();
                 const zStr = cols[colIndex++]?.trim();
                 const x = parseFloat(xStr);
                 const y = parseFloat(yStr);
                 const z = parseFloat(zStr);
                point.gyro_x = (xStr !== '' && !isNaN(x)) ? x : null;
                point.gyro_y = (yStr !== '' && !isNaN(y)) ? y : null;
                point.gyro_z = (zStr !== '' && !isNaN(z)) ? z : null;
            } else { point.gyro_x = null; point.gyro_y = null; point.gyro_z = null; } // Ensure properties exist

            return point;
        } catch (e) {
            console.error("Error during flight data parsing:", e, "Line:", cleanLine);
            return null; // Return null if any parsing error occurs
        }
    }

    // If none of the modes matched or parsing failed within a mode
    return null;
}


// --- ORIGINAL FUNCTION (NO CHANGES) ---
function updateSerialConfigUI() {
    const connectBtn = document.getElementById('connectHydrostaticTest');
    const selectedValues = serialConfigSelectors.map(sel => sel.value);
    if(connectBtn) connectBtn.disabled = selectedValues[0] === 'none'; // Only need first column selected

    serialConfigSelectors.forEach((currentSelector, currentIndex) => {
        // Ensure options exist before iterating
        if (!currentSelector || !currentSelector.options) return;

        Array.from(currentSelector.options).forEach(option => {
            if (option.value === 'none') {
                option.disabled = false; // 'None' is always selectable
                return;
            }
            // Disable if another selector has already chosen this value
            option.disabled = selectedValues.some((v, i) => v === option.value && i !== currentIndex);
        });
    });
    // Update the custom dropdown UI after changing disabled states
    setupCustomSelects(document.getElementById('serialConfig'));
}
// --- MODIFIED: Added checks for element existence ---
function updateMaxMinValues(data, timeInSeconds) {
    // Only update if not in flight mode
    if (currentMode === 'rocketFlight') return;

    // Format the timestamp as a simple number with 's' suffix
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

    // Update current values
    if (data.pressure != null && curP) curP.textContent = `Current Pressure: ${data.pressure.toFixed(2)} hPa`;
    if (data.thrust != null && curT) curT.textContent = `Current Thrust: ${data.thrust.toFixed(2)} N`;
    if (data.temperature != null && curTemp) curTemp.textContent = `Current Temp: ${data.temperature.toFixed(2)} °C`;
}

// --- DEPRECATED - Logic moved to readSerialData finally block ---
function triggerAutoDownload() {
    // This function can be kept for manual calls if needed, but auto-download on disconnect is handled elsewhere.
     console.warn("triggerAutoDownload called - this is likely deprecated for auto-downloads.");
     if (serialData.length > 0 || randomDataLog.length > 0) {
        downloadDataAsCSV();
     } else if (!document.hidden) {
         // Alert only if manually triggered (e.g., button click, though button doesn't call this)
         // alert("No data logged to download.");
     }
}

// --- MODIFIED: Add flight mode headers to CSV ---
function downloadDataAsCSV() {
    let dataToDownload = [];
    let filename = "plot-data.csv";
    let headers = [];

    let dataAvailable = false;
    // Determine which dataset to use (logged serial or random data)
    // Check serialData first, only if the currentMode matches one of the serial modes
     // ** MODIFIED: Capture sourceMode *before* potential disconnect changes currentMode **
     const sourceMode = currentMode || (isSerialConnected ? 'unknownSerial' : 'unknown'); // Fallback if currentMode is unset
     const isSerialDataSource = ['motorTest', 'hydrostaticTest', 'rocketFlight'].includes(sourceMode);


    if (isSerialDataSource && serialData.length > 0) {
        dataToDownload = [...serialData]; // Copy data to prevent modification issues
        filename = `${sourceMode}-log-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.csv`; // Add timestamp

        // --- Determine Headers based on sourceMode ---
        if (sourceMode === 'rocketFlight') {
            headers = ['timestamp'];
            // Add headers based on the *active configuration* when download is triggered
             // ** Use flightConfig directly **
            if (flightConfig.pressure) headers.push('pressure');
            if (flightConfig.acceleration) headers.push('acc_x', 'acc_y', 'acc_z');
            if (flightConfig.gyroscope) headers.push('gyro_x', 'gyro_y', 'gyro_z');
        } else if (sourceMode === 'motorTest') {
             headers = ['timestamp', 'thrust', 'pressure']; // Fixed headers for motor test
        } else if (sourceMode === 'hydrostaticTest') {
             // ** Use availableSeries directly **
            headers = ['timestamp', ...availableSeries]; // Headers based on hydro config
        }
        dataAvailable = true;

    } else if (randomPlotting && randomDataLog.length > 0) {
        dataToDownload = [...randomDataLog]; // Copy data
        filename = `random-log-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.csv`;
        headers = ['timestamp', 'pressure', 'thrust', 'temperature']; // Fixed headers for random
        dataAvailable = true;
    }

    if (!dataAvailable) {
         // Only alert if the button was manually clicked (i.e., not during auto-download on disconnect)
         // Check if *currently* not connected AND not doing random plotting
        if (!isSerialConnected && !randomPlotting && !document.hidden) {
             alert("No data was logged to download.");
        } else {
             console.log("Download requested, but no data available or session active.");
        }
        return;
    }

    // Convert data to CSV string using the determined headers
     let csvContent = headers.join(",") + "\n";
     csvContent += dataToDownload.map(row => {
        // Ensure row exists before mapping
        if (!row) return '';
        return headers.map(header => {
             // Handle potential undefined/null values gracefully
             const value = row[header];
             // Ensure boolean `false` is exported as "false", not empty string
             if (value === false) return 'false';
             return value === undefined || value === null ? '' : value;
         }).join(",");
     }).filter(line => line).join("\n"); // Filter out potential empty lines


    // Create and trigger download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Check for download attribute support
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up blob URL
         console.log(`CSV downloaded: ${filename}`);
    } else {
         // Fallback for browsers that don't support download attribute
         console.error("Download attribute not supported. Could not download CSV.");
         alert("Could not automatically download CSV. Your browser might not support this feature.");
    }

    // Data clearing is now handled by restart/reset/disconnect logic
}

