// data structures containing data for plotting
let allData = [];
let uplotData = { time: [], pressure: [], thrust: [], temperature: [] };

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
let serialPlotStartTime = null;

let currentMode = 'home';
let commandTimeout = null;
let waitingForState = null;
let isRetryingCommand = false;
let launchOverlay, launchRocket;
let isFirstLoad = true;

// --- UI Element References (will be defined on DOMContentLoaded) ---
let sidebar, mainContent, menuToggle, pageTitle, navLinks, fileDropArea, csvFileInput,
    statsSidebar,
    plotButton, startRandomPlottingButton, pauseButton, resumeButton, downloadCsvButton,
    connectMotorTestButton, connectHydrostaticTestButton, restartCsvButton, restartRandomButton,
    restartSerialButton, resetCsvButton, resetRandomButton, resetSerialButton,
    serialConfigSelectors, themeToggle, motorTestControls, cmdArmButton, cmdDisarmButton, cmdLaunchButton,
    thumbnailContainers;


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
                    trigger.querySelector('span').textContent = option.textContent;
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
    if (mainPlot1.instance) {
        const wrapper = document.getElementById('uplot-main-wrapper-1');
        if (wrapper) mainPlot1.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
    }
    if (mainPlot2.instance) {
        const wrapper = document.getElementById('uplot-main-wrapper-2');
        if (wrapper) mainPlot2.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
    }
    if (uplotPressureThumb) {
        const thumb = document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart');
        if (thumb) uplotPressureThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
    }
    if (uplotThrustThumb) {
        const thumb = document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart');
        if (thumb) uplotThrustThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
    }
    if (uplotTempThumb) {
        const thumb = document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart');
        if (thumb) uplotTempThumb.setSize({ width: thumb.clientWidth, height: thumb.clientHeight });
    }
}
function showPage(pageId, onPageShownCallback = null) {
    if (pageId !== 'plottingPage') {
        currentMode = pageId.replace('Page', '');
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    const isPlotPage = pageId === 'plottingPage';
    statsSidebar.style.display = isPlotPage ? 'flex' : 'none';
    if (isPlotPage && currentMode === 'motorTest') {
        motorTestControls.style.display = 'block';
    } else {
        motorTestControls.style.display = 'none';
    }
    navLinks.forEach(link => {
        if (link.dataset.page === pageId) {
            link.classList.add('active');
            pageTitle.textContent = link.textContent.trim();
        } else {
            link.classList.remove('active');
        }
    });
    if (onPageShownCallback) requestAnimationFrame(onPageShownCallback);
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
            await reader.cancel().catch(() => {});
        }
    }
    allData = [];
    availableSeries = [];
    serialData = [];
    serialBuffer = [];
    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }
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
    serialConfigSelectors.forEach(sel => { if(sel) sel.value = 'none'; });
    setupCustomSelects();
    if(document.getElementById('motorTestStatus')) document.getElementById('motorTestStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('hydrostaticTestStatus')) document.getElementById('hydrostaticTestStatus').textContent = 'Status: Disconnected';
    if(motorTestControls) motorTestControls.style.display = 'none';
    const fsmStateElement = document.getElementById('fsmState');
    if(fsmStateElement) fsmStateElement.textContent = 'FSM State: --';
    if(csvFileInput) csvFileInput.value = '';
}
function resetMaxValues() {
    maxValues = {
        pressure: { value: -Infinity, timestamp: null },
        thrust: { value: -Infinity, timestamp: null },
        temperature: { value: -Infinity, timestamp: null }
    };
    document.getElementById('maxPressure').textContent = 'Max Pressure: -- hPa';
    document.getElementById('maxThrust').textContent = 'Max Thrust: -- N';
    document.getElementById('maxTemperature').textContent = 'Max Temp: -- °C';
    document.getElementById('currentPressure').textContent = 'Current Pressure: -- hPa';
    document.getElementById('currentThrust').textContent = 'Current Thrust: -- N';
    document.getElementById('currentTemperature').textContent = `Current Temp: -- °C`;
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
function restartCsvPlotting() {
    if (!allData || allData.length === 0) return;
    isPaused = false;
    index = 0;
    uplotData = { time: [], pressure: [], thrust: [], temperature: [] };
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
function restartRandomPlotting() {
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    uplotData = { time: [], pressure: [], thrust: [], temperature: [] };
    randomDataLog = [];
    updateAllPlots();
    resetMaxValues();
    startTime = performance.now();
    randomPlotInterval = setInterval(() => {
        const elapsedTime = (performance.now() - startTime) / 1000;
        const p = 1013 + Math.sin(elapsedTime) * 10 + (Math.random() - 0.5) * 5;
        const th = 25 + Math.cos(elapsedTime * 0.5) * 20 + (Math.random() - 0.5) * 5;
        const temp = 40 + Math.sin(elapsedTime * 0.2) * 15 + (Math.random() - 0.5) * 3;
        const randomData = { timestamp: elapsedTime, pressure: p, thrust: th, temperature: temp };
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
    triggerAutoDownload();
    uplotData = { time: [], pressure: [], thrust: [], temperature: [] };
    serialData = [];
    serialBuffer = [];
    serialPlotStartTime = null;
    updateAllPlots();
    resetMaxValues();
}
async function connectToSerial(mode) {
    currentMode = mode;
    
    // Logic to handle sidebar visibility for different serial modes
    document.querySelectorAll('[data-series]').forEach(el => el.style.display = 'none');
    
    if (currentMode === 'motorTest') {
        availableSeries = ['thrust', 'pressure'];
        // **MODIFIED**: Show ONLY the stat boxes for thrust and pressure, not thumbnails.
        availableSeries.forEach(series => {
            document.querySelectorAll(`.stat-box[data-series="${series}"]`).forEach(el => {
                el.style.display = 'block';
            });
        });
    } else if (currentMode === 'hydrostaticTest') {
        availableSeries = [];
        serialConfigSelectors.forEach(sel => {
            if (sel.value !== 'none') availableSeries.push(sel.value);
        });
        // For other serial modes, show all relevant boxes (thumbnails and stats).
        availableSeries.forEach(series => {
            document.querySelectorAll(`[data-series="${series}"]`).forEach(el => {
                el.style.display = el.classList.contains('stat-box') ? 'block' : 'flex';
            });
        });
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
            document.getElementById('fsmState').textContent = 'FSM State: BOOT';
            document.getElementById('fsmState').className = 'stat-box fsm-state';
        }
        showPage('plottingPage', () => {
            setupChartInstances();
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
            restartSerialPlotting();
            keepReading = true;
            readSerialData();
            if (serialUpdateInterval) clearInterval(serialUpdateInterval);
            serialUpdateInterval = setInterval(updateFromBuffer, 50);
        });
    } catch (error) {
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to serial device.');
        showPage(`${currentMode}Page`);
        lastConnectedPortInfo = null;
    }
}
async function resetCsvMode() { await fullReset(); showPage('csvPage'); }
async function resetRandomMode() { await fullReset(); showPage('randomPage'); }
async function resetSerialMode() {
    await fullReset();
    showPage(currentMode === 'motorTest' ? 'motorTestPage' : 'hydrostaticTestPage');
}
function attemptReconnect() {
    if (reconnectInterval) clearInterval(reconnectInterval);
    reconnectInterval = setInterval(async () => {
        if (!lastConnectedPortInfo) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            return;
        }
        try {
            const availablePorts = await navigator.serial.getPorts();
            const matchingPort = availablePorts.find(p => {
                const info = p.getInfo();
                return info.usbVendorId === lastConnectedPortInfo.usbVendorId && info.usbProductId === lastConnectedPortInfo.usbProductId;
            });
            if (matchingPort) {
                console.log('Device re-detected. Attempting to connect...');
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                port = matchingPort; // Use the found port
                await connectToSerial(currentMode); // Simplified reconnect logic
            }
        } catch (error) {
            console.error('Error during reconnect attempt:', error);
        }
    }, 2000);
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
            width: 100,
            height: 80,
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            axes: [{ show: false }, { show: false }],
            cursor: { show: false },
            series: [{}, { stroke: seriesConfig[seriesName].stroke, width: 2 }],
        };
    } else {
        const opts = {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            series: [{}, { ...seriesConfig[seriesName], points: { show: false } }],
            axes: [
                { scale: 'x', label: 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } },
                { label: seriesConfig[seriesName].label, stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } }
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
function setupChartInstances() {
    // Clear previous instances
    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }

    const mainChartArea = document.getElementById('mainChartArea');
    const wrapper1 = document.getElementById('uplot-main-wrapper-1');
    const wrapper2 = document.getElementById('uplot-main-wrapper-2');

    // This logic now applies to CSV, Random, and Serial modes
    if (availableSeries.length === 1) {
        // --- SINGLE CHART LAYOUT ---
        mainChartArea.classList.remove('two-chart-layout');
        wrapper1.style.display = 'flex';
        wrapper2.style.display = 'none';

        mainPlot1.series = availableSeries[0];
        const opts1 = getChartOptions(mainPlot1.series);
        mainPlot1.instance = new uPlot(opts1, [uplotData.time, uplotData[mainPlot1.series] || []], wrapper1);

    } else if (availableSeries.length >= 2) {
        // --- TWO CHART LAYOUT ---
        mainChartArea.classList.add('two-chart-layout');
        wrapper1.style.display = 'flex';
        wrapper2.style.display = 'flex';

        // Plot first series in the left chart
        mainPlot1.series = availableSeries[0];
        const opts1 = getChartOptions(mainPlot1.series);
        mainPlot1.instance = new uPlot(opts1, [uplotData.time, uplotData[mainPlot1.series] || []], wrapper1);

        // Plot second series in the right chart
        mainPlot2.series = availableSeries[1];
        const opts2 = getChartOptions(mainPlot2.series);
        mainPlot2.instance = new uPlot(opts2, [uplotData.time, uplotData[mainPlot2.series] || []], wrapper2);
    }
    
    // Create all thumbnail plots (their containers' visibility is controlled by each mode's setup function)
    uplotPressureThumb = new uPlot(getChartOptions('pressure', true), [uplotData.time, uplotData.pressure], document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart'));
    uplotThrustThumb = new uPlot(getChartOptions('thrust', true), [uplotData.time, uplotData.thrust], document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart'));
    uplotTempThumb = new uPlot(getChartOptions('temperature', true), [uplotData.time, uplotData.temperature], document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart'));
    
    updateActiveThumbnails();
    handleResize();
}

function updateChartStyles() {
    const themeColors = getThemeColors();

    const updateInstanceStyles = (instance) => {
        if (!instance) return;
        instance.setAxes([{
            stroke: themeColors.axes,
            grid: { stroke: themeColors.grid },
            ticks: { stroke: themeColors.grid },
            labelFont: '14px sans-serif',
            valueFont: '12px sans-serif',
        }]);
        
        const svg = instance.root.querySelector('svg');
        if (svg) {
            svg.querySelectorAll('.u-axis text').forEach(el => {
                el.style.fill = themeColors.labels;
            });
        }
    };

    updateInstanceStyles(mainPlot1.instance);
    updateInstanceStyles(mainPlot2.instance);
    updateInstanceStyles(uplotPressureThumb);
    updateInstanceStyles(uplotThrustThumb);
    updateInstanceStyles(uplotTempThumb);
}

function swapMainChart(seriesName) {
    if (!seriesName || mainPlot1.series === seriesName) {
        return; // Do nothing if it's the same chart or invalid
    }

    // Update the series for the first main plot
    mainPlot1.series = seriesName;

    // Destroy and recreate the first uPlot instance with the new series
    if (mainPlot1.instance) {
        mainPlot1.instance.destroy();
    }
    const wrapper = document.getElementById('uplot-main-wrapper-1');
    const opts = getChartOptions(mainPlot1.series);
    mainPlot1.instance = new uPlot(opts, [uplotData.time, uplotData[mainPlot1.series]], wrapper);
    
    updateActiveThumbnails();
    handleResize();
}

function updateActiveThumbnails() {
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
    if (mainPlot1.instance) {
        mainPlot1.instance.setData([uplotData.time, uplotData[mainPlot1.series] || []]);
    }
    if (mainPlot2.instance) {
        mainPlot2.instance.setData([uplotData.time, uplotData[mainPlot2.series] || []]);
    }
    
    if (uplotPressureThumb) uplotPressureThumb.setData([uplotData.time, uplotData.pressure]);
    if (uplotThrustThumb) uplotThrustThumb.setData([uplotData.time, uplotData.thrust]);
    if (uplotTempThumb) uplotTempThumb.setData([uplotData.time, uplotData.temperature]);

    const dataLength = uplotData.time.length;
    if (dataLength < 2) return;

    const isSlidingWindow = randomPlotting || isSerialConnected;
    let windowStartTime = uplotData.time[0];
    const windowEndTime = uplotData.time[dataLength - 1];
    let newMax;
    
    if (isSlidingWindow) {
        windowStartTime = Math.max(0, windowEndTime - 20);
        newMax = windowEndTime;
    } else {
        const duration = windowEndTime - windowStartTime;
        const padding = duration > 0 ? duration * 0.1 : 1;
        newMax = windowEndTime + padding;
    }
    
    const newScale = { min: windowStartTime, max: newMax };
    if (mainPlot1.instance) mainPlot1.instance.setScale('x', newScale);
    if (mainPlot2.instance) mainPlot2.instance.setScale('x', newScale);
    if (uplotPressureThumb) uplotPressureThumb.setScale('x', newScale);
    if (uplotThrustThumb) uplotThrustThumb.setScale('x', newScale);
    if (uplotTempThumb) uplotTempThumb.setScale('x', newScale);
}
async function readSerialData() {
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();
    while (true) {
        try {
            const { value, done } = await reader.read();
            if (done || !keepReading) break;
            lineBuffer += value;
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop(); 
            for (const line of lines) {
                if (line.trim()) serialBuffer.push(line.trim());
            }
        } catch (error) {
            console.error('Error reading from serial port:', error);
            break;
        }
    }
    
    reader.releaseLock();
    await readableStreamClosed.catch(() => {});
    if (port) await port.close().catch(() => {});
    port = null;
    isSerialConnected = false;
    if(serialUpdateInterval) clearInterval(serialUpdateInterval);
    serialUpdateInterval = null;
    
    triggerAutoDownload();
    
    renderFullSerialPlot();

    if (currentMode === 'motorTest') {
        document.getElementById('fsmState').textContent = 'FSM State: BOOT';
        document.getElementById('fsmState').className = 'stat-box fsm-state';
    }
    
    const statusEl = document.getElementById(`${currentMode}Status`);
    if (lastConnectedPortInfo && keepReading) {
        if(statusEl) statusEl.textContent = 'Status: Disconnected. Attempting to reconnect...';
        attemptReconnect();
    } else {
        if(statusEl) statusEl.textContent = 'Status: Disconnected';
    }
}
function renderFullSerialPlot() {
    if (serialData.length < 2) return;
    const firstTimestamp = serialData[0].timestamp;
    uplotData = { time: [], pressure: [], thrust: [], temperature: [] };
    serialData.forEach(point => {
        const timeInSeconds = (point.timestamp - firstTimestamp) / 1000;
        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(point.pressure ?? null);
        uplotData.thrust.push(point.thrust ?? null);
        uplotData.temperature.push(point.temperature ?? null);
    });
    updateAllPlots();
}
function updateFromBuffer() {
    if (serialBuffer.length === 0) return;

    const pointsToProcess = serialBuffer.splice(0, serialBuffer.length);
    pointsToProcess.forEach(line => {
        const data = processSerialLine(line);
        if (data) {
            if (serialPlotStartTime === null) {
                serialPlotStartTime = data.timestamp;
            }
            serialData.push(data);
            
            const timeInSeconds = (data.timestamp - serialPlotStartTime) / 1000;
            
            uplotData.time.push(timeInSeconds);
            uplotData.thrust.push(data.thrust ?? null);
            uplotData.pressure.push(data.pressure ?? null);
            uplotData.temperature.push(data.temperature ?? null);
            updateMaxMinValues(data, timeInSeconds);
        }
    });
    updateAllPlots();
}
function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (parseCSV(e.target.result)) {
            plotButton.disabled = false;
        } else {
            alert('Error: CSV must contain a "timestamp" column and at least one data column (pressure, thrust, or temperature).');
        }
    };
    reader.readAsText(file);
}
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n').map(line => line.trim());
    if (lines.length < 2) return false;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    if (!headers.includes('timestamp')) return false;
    const potentialSeries = ['pressure', 'thrust', 'temperature'];
    availableSeries = headers.filter(h => potentialSeries.includes(h));
    if (availableSeries.length === 0) return false;
    const idx = {
        ts: headers.indexOf('timestamp'),
        pressure: headers.indexOf('pressure'),
        thrust: headers.indexOf('thrust'),
        temperature: headers.indexOf('temperature')
    };
    allData = lines.slice(1).map(line => {
        const cols = line.split(',');
        let time = parseFloat(cols[idx.ts]);
        if (isNaN(time)) return null;
        if (document.getElementById('timestampUnit').value === 's') time *= 1000;
        const point = { timestamp: time };
        if (idx.pressure > -1) point.pressure = parseFloat(cols[idx.pressure]);
        if (idx.thrust > -1) point.thrust = parseFloat(cols[idx.thrust]);
        if (idx.temperature > -1) point.temperature = parseFloat(cols[idx.temperature]);
        return point;
    }).filter(Boolean);
    allData.sort((a, b) => a.timestamp - b.timestamp);
    return allData.length > 0;
}
function plotCSVInterval() {
    if (!isPlotting || isPaused) return;
    if (index >= allData.length) {
        isPlotting = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        return;
    }
    const elapsedRealTime = performance.now() - startTime;
    const targetTimestamp = plotStartTime + elapsedRealTime;
    let pointsAdded = false;
    while (index < allData.length && allData[index].timestamp <= targetTimestamp) {
        const point = allData[index];
        const timeInSeconds = (point.timestamp - plotStartTime) / 1000;
        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(point.pressure ?? null);
        uplotData.thrust.push(point.thrust ?? null);
        uplotData.temperature.push(point.temperature ?? null);
        updateMaxMinValues(point, timeInSeconds);
        index++;
        pointsAdded = true;
    }
    if (pointsAdded) updateAllPlots();
    requestAnimationFrame(plotCSVInterval);
}
function processSerialLine(line) {
    const cleanLine = line.replace(/[^\x20-\x7E]/g, '');

    if (currentMode === 'motorTest') {
        if (cleanLine.startsWith("AT+SEND") || cleanLine === "OK") {
            return null;
        }

        if (cleanLine.startsWith("+RCV=")) {
            const parts = cleanLine.split(',');
            if (parts.length < 5) return null;

            const dataPayload = parts.slice(2, parts.length - 2).join(',');

            if (dataPayload.startsWith("TESTBED STATE:")) {
                const state = dataPayload.substring(15).trim();
                const fsmStateElement = document.getElementById('fsmState');
                fsmStateElement.textContent = `FSM State: ${state}`;

                if (waitingForState && state === waitingForState) {
                    console.log(`State confirmation received: ${state}. Stopping retries.`);
                    clearTimeout(commandTimeout);
                    isRetryingCommand = false;
                    waitingForState = null;
                    if (cmdArmButton) cmdArmButton.disabled = false;
                    if (cmdDisarmButton) cmdDisarmButton.disabled = false;
                    if (cmdLaunchButton) cmdLaunchButton.disabled = false;
                }
                
                fsmStateElement.className = 'stat-box fsm-state';
                if (state === 'LAUNCHED' || state === 'ARMED') {
                     restartSerialPlotting();
                }
                if (state === 'ARMED') fsmStateElement.classList.add('armed');
                else if (state === 'LAUNCHED') fsmStateElement.classList.add('launched');
                else if (state === 'FAILURE') fsmStateElement.classList.add('failure');

                return null;
            } 
            else {
                const dataValues = dataPayload.split(',');
                if (dataValues.length === 3) {
                    const point = {
                        timestamp: parseFloat(dataValues[0]),
                        thrust: parseFloat(dataValues[1]),
                        pressure: parseFloat(dataValues[2])
                    };
                    if (!isNaN(point.timestamp)) return point;
                }
            }
        }
    } else if (currentMode === 'hydrostaticTest') {
        const cols = cleanLine.split(',');
        let time = parseFloat(cols[0]);
        if (isNaN(time)) return null;

        const point = { timestamp: time };
        availableSeries.forEach((seriesName, index) => {
            const colIndex = index + 1;
            if (cols.length > colIndex) {
                const val = parseFloat(cols[colIndex]);
                if (!isNaN(val)) point[seriesName] = val;
            }
        });
        return point;
    }
    
    return null;
}
function updateSerialConfigUI() {
    const connectBtn = document.getElementById('connectHydrostaticTest');
    const selectedValues = serialConfigSelectors.map(sel => sel.value);
    if(connectBtn) connectBtn.disabled = selectedValues[0] === 'none';

    serialConfigSelectors.forEach((currentSelector, currentIndex) => {
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
    if (data.pressure != null && data.pressure > maxValues.pressure.value) {
        maxValues.pressure.value = data.pressure;
        document.getElementById('maxPressure').textContent = `Max Pressure: ${data.pressure.toFixed(2)} hPa @ ${timeInSeconds.toFixed(1)}s`;
    }
    if (data.thrust != null && data.thrust > maxValues.thrust.value) {
        maxValues.thrust.value = data.thrust;
        document.getElementById('maxThrust').textContent = `Max Thrust: ${data.thrust.toFixed(2)} N @ ${timeInSeconds.toFixed(1)}s`;
    }
    if (data.temperature != null && data.temperature > maxValues.temperature.value) {
        maxValues.temperature.value = data.temperature;
        document.getElementById('maxTemperature').textContent = `Max Temp: ${data.temperature.toFixed(2)} °C @ ${timeInSeconds.toFixed(1)}s`;
    }
    if (data.pressure != null) document.getElementById('currentPressure').textContent = `Current Pressure: ${data.pressure.toFixed(2)} hPa`;
    if (data.thrust != null) document.getElementById('currentThrust').textContent = `Current Thrust: ${data.thrust.toFixed(2)} N`;
    if (data.temperature != null) document.getElementById('currentTemperature').textContent = `Current Temp: ${data.temperature.toFixed(2)} °C`;
}
function triggerAutoDownload() {
    if (isSerialConnected && serialData.length > 0) {
        console.log("Session ended. Triggering auto-download.");
        downloadDataAsCSV();
    }
}
function downloadDataAsCSV() {
    let dataToDownload = [];
    let filename = "plot-data.csv";
    
    let dataAvailable = false;
    if (isSerialConnected && serialData.length > 0) {
        dataToDownload = serialData;
        filename = `${currentMode}-data.csv`;
        dataAvailable = true;
    } else if (randomPlotting && randomDataLog.length > 0) {
        dataToDownload = randomDataLog;
        filename = `random-mode-data.csv`;
        dataAvailable = true;
    }

    if (!dataAvailable) {
        if (!document.hidden) {
            alert("No data was logged to download.");
        }
        return;
    }
    
    const firstTimestamp = dataToDownload.length > 0 ? dataToDownload[0].timestamp : 0;
    const headers = ['timestamp', ...availableSeries];
    
    const normalizedData = dataToDownload.map(row => {
        let rowObject = {
            timestamp: (currentMode === 'random' ? row.timestamp : (row.timestamp - firstTimestamp) / 1000).toFixed(3)
        };
        headers.slice(1).forEach(h => rowObject[h] = row[h]);
        return rowObject;
    });

    let csvContent = headers.join(",") + "\n";

    normalizedData.forEach(row => {
        csvContent += headers.map(header => row[header] ?? '').join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}