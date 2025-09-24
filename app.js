// data structures containing data for plotting
let allData = [];
let uplotData = { time: [], pressure: [], thrust: [], temp: [] };

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
let serialHeaderMap = null;
let reconnectInterval = null;
let lastConnectedPortInfo = null;
let serialPlotStartTime = null;

// --- UI Element References ---
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const menuToggle = document.getElementById('menuToggle');
const pageTitle = document.getElementById('pageTitle');
const navLinks = document.querySelectorAll('.nav-link');
const fileDropArea = document.getElementById('fileDropArea');
const csvFileInput = document.getElementById('csvFile');
const statsSidebar = document.getElementById('statsSidebar');
const currentPressureDisplay = document.getElementById('currentPressure');
const currentThrustDisplay = document.getElementById('currentThrust');
const currentTemperatureDisplay = document.getElementById('currentTemperature');
const plotButton = document.getElementById('plotButton');
const startRandomPlottingButton = document.getElementById('startRandomPlotting');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const downloadCsvButton = document.getElementById('downloadCsvButton');
const connectSerialButton = document.getElementById('connectSerial');
const restartCsvButton = document.getElementById('restartCsvButton');
const restartRandomButton = document.getElementById('restartRandomButton');
const restartSerialButton = document.getElementById('restartSerialButton');
const resetCsvButton = document.getElementById('resetCsvButton');
const resetRandomButton = document.getElementById('resetRandomButton');
const resetSerialButton = document.getElementById('resetSerialButton');
const serialConfigSelectors = [
    document.getElementById('serialCol1'),
    document.getElementById('serialCol2'),
    document.getElementById('serialCol3')
];
const themeToggle = document.getElementById('themeToggle');
const serialControlsContainer = document.getElementById('serialControlsContainer');

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // This function adds event listeners safely, checking if the element exists first.
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

    safeAddEventListener(menuToggle, 'click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => { handleResize(); }, 310);
    });

    navLinks.forEach(link => {
        safeAddEventListener(link, 'click', async (e) => {
            e.preventDefault();
            triggerAutoDownload(); // Download before changing page
            const pageId = link.dataset.page;
            await fullReset();
            showPage(pageId);
            sidebar.classList.add('collapsed');
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
    safeAddEventListener(connectSerialButton, 'click', () => connectToSerial());
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

    safeAddEventListener(document.getElementById('pressureThumbnail'), 'mouseover', () => setActiveChart('pressure'));
    safeAddEventListener(document.getElementById('thrustThumbnail'), 'mouseover', () => setActiveChart('thrust'));
    safeAddEventListener(document.getElementById('temperatureThumbnail'), 'mouseover', () => setActiveChart('temperature'));
    
    safeAddEventListener(document.getElementById('cmdArm'), 'click', () => sendSerialCommand('AT+SEND=0,3,ARM'));
    safeAddEventListener(document.getElementById('cmdLaunch'), 'click', () => {
        if (confirm("WARNING: This will initiate the LAUNCH sequence. Are you absolutely sure?")) {
            sendSerialCommand('AT+SEND=0,6,LAUNCH');
        }
    });

    window.addEventListener('resize', handleResize);
    safeAddEventListener(mainContent, 'dblclick', toggleFullScreen);
    
    setupCustomSelects();

    const savedPortInfo = JSON.parse(localStorage.getItem('lastConnectedPortInfo'));
    if (savedPortInfo) {
        lastConnectedPortInfo = savedPortInfo;
        console.log("Found last used port. Attempting to reconnect automatically...");
        document.getElementById('serialStatus').textContent = 'Status: Auto-reconnecting...';
        attemptReconnect();
    }
});

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
        alert("Serial port is not connected.");
        return;
    }
    const encoder = new TextEncoder();
    const dataToSend = encoder.encode(command + '\r\n');
    const writer = port.writable.getWriter();
    try {
        await writer.write(dataToSend);
    } catch (error) {
        console.error("Error sending command:", error);
    } finally {
        writer.releaseLock();
    }
    console.log(`Sent command: ${command}`);
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
        mainPlot1.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
    }
    if (mainPlot2.instance) {
        const wrapper = document.getElementById('uplot-main-wrapper-2');
        mainPlot2.instance.setSize({ width: wrapper.clientWidth, height: wrapper.clientHeight });
    }
    if (uplotPressureThumb) uplotPressureThumb.setSize({ width: document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart').clientWidth, height: document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart').clientHeight });
    if (uplotThrustThumb) uplotThrustThumb.setSize({ width: document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart').clientWidth, height: document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart').clientHeight });
    if (uplotTempThumb) uplotTempThumb.setSize({ width: document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart').clientWidth, height: document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart').clientHeight });
}

function showPage(pageId, onPageShownCallback = null) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    
    const isPlotPage = pageId === 'plottingPage';
    statsSidebar.style.display = isPlotPage ? 'flex' : 'none';
    
    if (isPlotPage && isSerialConnected) {
        serialControlsContainer.style.display = 'block';
    } else {
        serialControlsContainer.style.display = 'none';
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
    localStorage.removeItem('lastConnectedPortInfo');
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    lastConnectedPortInfo = null;
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    if (serialUpdateInterval) clearInterval(serialUpdateInterval);
    
    randomPlotting = false;
    isPlotting = false;
    isPaused = false;

    if (port && port.readable) {
        keepReading = false;
        if (reader) await reader.cancel().catch(() => {});
        // Note: The download on disconnect is handled in readSerialData's cleanup
    }
    
    allData = [];
    availableSeries = [];
    serialData = [];
    serialBuffer = [];
    serialHeaderMap = null;
    randomDataLog = [];
    
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
    
    if(document.getElementById('serialStatus')) document.getElementById('serialStatus').textContent = 'Status: Disconnected';
    if(document.getElementById('fsmState')) document.getElementById('fsmState').textContent = 'FSM State: --';
    if(serialControlsContainer) serialControlsContainer.style.display = 'none';

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
    if (currentPressureDisplay) currentPressureDisplay.textContent = 'Current Pressure: -- hPa';
    if (currentThrustDisplay) currentThrustDisplay.textContent = 'Current Thrust: -- N';
    if (currentTemperatureDisplay) currentTemperatureDisplay.textContent = `Current Temp: -- °C`;
}

// --- Plotting Logic & Mode Management ---
function startCsvPlotting() {
    if (!allData || allData.length === 0) {
        alert('Please load a valid CSV file first');
        return;
    }
    isPlotting = true;
    isSerialConnected = false;
    randomPlotting = false;
    showPage('plottingPage', () => {
        setupChartInstances();
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
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
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
    showPage('plottingPage', () => {
        setupChartInstances();
        restartRandomButton.style.display = 'inline-block';
        resetRandomButton.style.display = 'inline-block';
        downloadCsvButton.style.display = 'none';
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
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
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
        uplotData.temp.push(temp);
        updateAllPlots();
    }, 100);
}

function restartSerialPlotting() {
    triggerAutoDownload(); // Download before clearing data
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
    serialData = [];
    serialBuffer = [];
    serialPlotStartTime = null;
    updateAllPlots();
    resetMaxValues();
}

async function connectToSerial(existingPort = null) {
    if (!existingPort) {
        availableSeries = ['thrust', 'pressure']; 
    }
    serialHeaderMap = true;
    try {
        port = existingPort || await navigator.serial.requestPort();
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

        document.getElementById('fsmState').textContent = 'FSM State: BOOT';
        document.getElementById('fsmState').className = 'stat-box fsm-state';

        showPage('plottingPage', () => {
            restartSerialButton.style.display = 'inline-block';
            resetSerialButton.style.display = 'inline-block';
            downloadCsvButton.style.display = 'inline-block';
            restartCsvButton.style.display = 'none';
            resetCsvButton.style.display = 'none';
            restartRandomButton.style.display = 'none';
            resetRandomButton.style.display = 'none';
            pauseButton.style.display = 'none';
            resumeButton.style.display = 'none';
            document.getElementById('serialStatus').textContent = 'Status: Connected';
            setupChartInstances();
            restartSerialPlotting();
            keepReading = true;
            readSerialData();
            if (serialUpdateInterval) clearInterval(serialUpdateInterval);
            serialUpdateInterval = setInterval(updateFromBuffer, 50);
        });
    } catch (error) {
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to serial device.');
        showPage('serialPage');
        lastConnectedPortInfo = null;
    }
}

async function resetCsvMode() { await fullReset(); showPage('csvPage'); }
async function resetRandomMode() { await fullReset(); showPage('randomPage'); }
async function resetSerialMode() {
    triggerAutoDownload(); // Download before resetting
    await fullReset();
    showPage('serialPage');
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
                await connectToSerial(matchingPort);
            }
        } catch (error) {
            console.error('Error during reconnect attempt:', error);
        }
    }, 2000);
}

// --- Chart and Data Handling ---

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
    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1 = { instance: null, series: null }; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2 = { instance: null, series: null }; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }

    const mainChartArea = document.getElementById('mainChartArea');
    const wrapper1 = document.getElementById('uplot-main-wrapper-1');
    const wrapper2 = document.getElementById('uplot-main-wrapper-2');

    let mainSeriesNames = [];
    let thumbSeriesName = null;
    const isDynamicLayout = isPlotting || isSerialConnected;

    if (isDynamicLayout && availableSeries.length > 0) {
        mainSeriesNames = availableSeries.slice(0, 2);
        if (availableSeries.length === 3) {
            thumbSeriesName = availableSeries[2];
        }
    } else {
        mainSeriesNames = ['thrust', 'pressure', 'temperature'];
    }

    mainChartArea.classList.remove('two-chart-layout');
    wrapper1.innerHTML = '';
    wrapper2.innerHTML = '';

    if (isDynamicLayout && mainSeriesNames.length >= 2) {
        mainChartArea.classList.add('two-chart-layout');
        wrapper1.style.display = 'flex';
        wrapper2.style.display = 'flex';
    } else {
        wrapper1.style.display = 'flex';
        wrapper2.style.display = 'none';
    }

    if (isDynamicLayout) {
        if (mainSeriesNames.length >= 1) {
            mainPlot1.series = mainSeriesNames[0];
            const opts = getChartOptions(mainPlot1.series);
            mainPlot1.instance = new uPlot(opts, [uplotData.time, uplotData[mainPlot1.series]], wrapper1);
        }
        if (mainSeriesNames.length >= 2) {
            mainPlot2.series = mainSeriesNames[1];
            const opts = getChartOptions(mainPlot2.series);
            mainPlot2.instance = new uPlot(opts, [uplotData.time, uplotData[mainPlot2.series]], wrapper2);
        }
        if (thumbSeriesName) {
            if (thumbSeriesName === 'pressure') uplotPressureThumb = new uPlot(getChartOptions('pressure', true), [uplotData.time, uplotData.pressure], document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart'));
            if (thumbSeriesName === 'thrust') uplotThrustThumb = new uPlot(getChartOptions('thrust', true), [uplotData.time, uplotData.thrust], document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart'));
            if (thumbSeriesName === 'temperature') uplotTempThumb = new uPlot(getChartOptions('temperature', true), [uplotData.time, uplotData.temperature], document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart'));
        }
    } else {
        const themeColors = getThemeColors();
        const mainOpts = {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            series: [{}, { label: 'Pressure (hPa)', stroke: 'blue' }, { label: 'Thrust (N)', stroke: 'red' }, { label: 'Temperature (°C)', stroke: 'orange' }],
            axes: [
                { scale: 'x', label: 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } },
                { scale: 'y', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.grid } }
            ],
        };
        mainPlot1.series = 'all'; 
        mainPlot1.instance = new uPlot(mainOpts, [uplotData.time, uplotData.pressure, uplotData.thrust, uplotData.temp], wrapper1);
        uplotPressureThumb = new uPlot(getChartOptions('pressure', true), [uplotData.time, uplotData.pressure], document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart'));
        uplotThrustThumb = new uPlot(getChartOptions('thrust', true), [uplotData.time, uplotData.thrust], document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart'));
        uplotTempThumb = new uPlot(getChartOptions('temperature', true), [uplotData.time, uplotData.temperature], document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart'));
        setActiveChart('thrust');
    }

    ['pressure', 'thrust', 'temperature'].forEach(series => {
        const thumbContainer = document.getElementById(`${series}Thumbnail`);
        if (thumbContainer) {
            const isThumb = series === thumbSeriesName;
            thumbContainer.style.display = isThumb || !isDynamicLayout ? 'flex' : 'none';
        }
    });
    
    handleResize();
}

function updateChartStyles() {
    const themeColors = getThemeColors();

    const updateInstanceStyles = (instance) => {
        if (!instance) return;
        instance.setAxes({
            stroke: themeColors.axes,
            grid: { stroke: themeColors.grid },
            ticks: { stroke: themeColors.grid },
            labelFont: '14px sans-serif',
            valueFont: '12px sans-serif',
        });
        
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

function setActiveChart(chartType) {
    if (randomPlotting && mainPlot1.instance) {
        mainPlot1.instance.setSeries(1, { show: chartType === 'pressure' });
        mainPlot1.instance.setSeries(2, { show: chartType === 'thrust' });
        mainPlot1.instance.setSeries(3, { show: chartType === 'temperature' });
        document.getElementById('pressureThumbnail').classList.toggle('active', chartType === 'pressure');
        document.getElementById('thrustThumbnail').classList.toggle('active', chartType === 'thrust');
        document.getElementById('temperatureThumbnail').classList.toggle('active', chartType === 'temperature');
    }
}

function updateAllPlots() {
    if (mainPlot1.instance) {
        if (mainPlot1.series === 'all') {
            mainPlot1.instance.setData([uplotData.time, uplotData.pressure, uplotData.thrust, uplotData.temp]);
        } else {
            mainPlot1.instance.setData([uplotData.time, uplotData[mainPlot1.series]]);
        }
    }
    if (mainPlot2.instance) {
        mainPlot2.instance.setData([uplotData.time, uplotData[mainPlot2.series]]);
    }
    
    if (uplotPressureThumb) uplotPressureThumb.setData([uplotData.time, uplotData.pressure]);
    if (uplotThrustThumb) uplotThrustThumb.setData([uplotData.time, uplotData.thrust]);
    if (uplotTempThumb) uplotTempThumb.setData([uplotData.time, uplotData.temp]);

    const dataLength = uplotData.time.length;
    if (dataLength < 2) return;

    const isSlidingWindow = randomPlotting || isSerialConnected;
    let windowStartTime = uplotData.time[0];
    const windowEndTime = uplotData.time[dataLength - 1];
    let newMax;
    
    if (isSlidingWindow) {
        windowStartTime = Math.max(0, windowEndTime - 30); // 30-second window
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

    document.getElementById('fsmState').textContent = 'FSM State: BOOT';
    document.getElementById('fsmState').className = 'stat-box fsm-state';

    if (lastConnectedPortInfo && keepReading) {
        document.getElementById('serialStatus').textContent = 'Status: Disconnected. Attempting to reconnect...';
        attemptReconnect();
    } else {
        document.getElementById('serialStatus').textContent = 'Status: Disconnected';
    }
}

function renderFullSerialPlot() {
    if (serialData.length < 2) return;
    const firstTimestamp = serialData[0].timestamp;
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
    serialData.forEach(point => {
        const timeInSeconds = (point.timestamp - firstTimestamp) / 1000;
        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(point.pressure ?? null);
        uplotData.thrust.push(point.thrust ?? null);
        uplotData.temp.push(point.temperature ?? null);
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
            uplotData.temp.push(data.temperature ?? null);
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
        uplotData.temp.push(point.temperature ?? null);
        updateMaxMinValues(point, timeInSeconds);
        index++;
        pointsAdded = true;
    }
    if (pointsAdded) updateAllPlots();
    requestAnimationFrame(plotCSVInterval);
}

function processSerialLine(line) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("AT+SEND") || trimmedLine === "OK") {
        return null;
    }

    if (trimmedLine.startsWith("+RCV=")) {
        const parts = trimmedLine.split(',');
        if (parts.length < 5) return null;

        const dataPayload = parts.slice(2, parts.length - 2).join(',');

        if (dataPayload.startsWith("TESTBED STATE:")) {
            const state = dataPayload.substring(15).trim();
            const fsmStateElement = document.getElementById('fsmState');
            
            fsmStateElement.textContent = `FSM State: ${state}`;
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

                if (!isNaN(point.timestamp) && !isNaN(point.thrust) && !isNaN(point.pressure)) {
                    return point;
                }
            }
        }
    }
    
    return null;
}


function updateSerialConfigUI() {
    connectSerialButton.disabled = false;
    const selectedValues = serialConfigSelectors.map(sel => sel.value);
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

// REMOVED `setupDefaultViewSelector` function

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
    if (currentPressureDisplay && data.pressure != null) currentPressureDisplay.textContent = `Current Pressure: ${data.pressure.toFixed(2)} hPa`;
    if (currentThrustDisplay && data.thrust != null) currentThrustDisplay.textContent = `Current Thrust: ${data.thrust.toFixed(2)} N`;
    if (currentTemperatureDisplay && data.temperature != null) currentTemperatureDisplay.textContent = `Current Temp: ${data.temperature.toFixed(2)} °C`;
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
    
    if (isSerialConnected && serialData.length > 0) {
        dataToDownload = serialData;
        filename = "serial-data.csv";
    } else {
        if (document.hidden) {
            console.log("No serial data to auto-download.");
        } else {
            if(serialData.length === 0) alert("No serial data was logged to download.");
        }
        return;
    }
    
    const firstTimestamp = dataToDownload.length > 0 ? dataToDownload[0].timestamp : 0;
    const normalizedData = dataToDownload.map(row => ({
        timestamp: ((row.timestamp - firstTimestamp) / 1000).toFixed(3),
        thrust: row.thrust,
        pressure: row.pressure
    }));

    const headers = ['timestamp', 'thrust', 'pressure'];
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

