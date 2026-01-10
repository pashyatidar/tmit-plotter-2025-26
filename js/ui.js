/**
 * js/ui.js
 * Handles User Interface interactions, DOM updates, and Map visualization.
 */

import { appState } from './state.js';

// --- Local Module State (Map References) ---
let flightMap = null;
let flightRocketMarker = null;
let flightPrimaryMarker = null;
let launchOverlay = null;
let launchRocket = null;

/**
 * Switches the active view/page.
 * @param {string} pageId - The ID of the page to show (e.g., 'homePage').
 * @param {Function} onPageShownCallback - Optional callback after transition.
 */
export function showPage(pageId, onPageShownCallback = null) {
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');
    const pageTitle = document.getElementById('pageTitle');
    
    // 1. Update Navigation State
    const currentMode = pageId.replace('Page', '');
    if (pageId !== 'plottingPage') {
        appState.currentMode = currentMode;
    }

    // 2. Hide all pages, Show target
    pages.forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // 3. Update Sidebar Active State
    navLinks.forEach(link => {
        const linkPage = link.dataset.page;
        // Highlight if exact match OR if we are on plotting page for that mode
        if (linkPage === pageId || (pageId === 'plottingPage' && linkPage === appState.currentMode + 'Page')) {
            link.classList.add('active');
            if (pageTitle) pageTitle.textContent = link.textContent.trim();
        } else {
            link.classList.remove('active');
        }
    });

    // 4. Update Sidebar & Controls Visibility
    updateSidebarVisibility(pageId);

    // 5. Callback (used for chart resizing/setup)
    if (onPageShownCallback) {
        requestAnimationFrame(onPageShownCallback);
    }
}

/**
 * Updates visibility of specific UI sections based on the active page.
 */
function updateSidebarVisibility(pageId) {
    const statsSidebar = document.getElementById('statsSidebar');
    const motorTestControls = document.getElementById('motorTestControls');
    const flightPlotControls = document.getElementById('flightPlotControls');
    const flightPhaseDisplay = document.getElementById('flightPhaseDisplay');
    const plotSwitchButton = document.getElementById('plotSwitchButton');
    
    const isPlotPage = (pageId === 'plottingPage');
    const isFlightMode = (appState.currentMode === 'rocketFlight');
    const isMotorTest = (appState.currentMode === 'motorTest');

    // Stats Sidebar
    if (statsSidebar) {
        statsSidebar.style.display = isPlotPage ? 'flex' : 'none';
        if (isPlotPage && isFlightMode) {
            statsSidebar.classList.add('flight-mode-active'); // Hides standard stats
        } else {
            statsSidebar.classList.remove('flight-mode-active');
        }
    }

    // Controls & Overlays
    if (motorTestControls) motorTestControls.style.display = (isPlotPage && isMotorTest) ? 'block' : 'none';
    if (flightPlotControls) flightPlotControls.style.display = (isPlotPage && isFlightMode) ? 'flex' : 'none';
    if (flightPhaseDisplay) flightPhaseDisplay.style.display = (isPlotPage && isFlightMode) ? 'inline-block' : 'none';
    if (plotSwitchButton) plotSwitchButton.style.display = (isPlotPage && isFlightMode) ? 'inline-flex' : 'none';
    
    // Toggle correct plot container visibility
    const mainChartArea = document.getElementById('mainChartArea');
    const flightPlottingArea = document.getElementById('flightPlottingArea');
    
    if (isPlotPage) {
        if (isFlightMode) {
            if (mainChartArea) mainChartArea.style.display = 'none';
            if (flightPlottingArea) flightPlottingArea.style.display = 'flex';
        } else {
            if (mainChartArea) mainChartArea.style.display = 'flex';
            if (flightPlottingArea) flightPlottingArea.style.display = 'none';
        }
    }
}

/**
 * Updates the text status of the current connection mode.
 * @param {string} mode - 'motorTest', 'hydrostaticTest', 'rocketFlight'
 * @param {string} text - Status text
 * @param {string} type - 'default', 'error'
 */
export function updateStatusDisplay(mode, text, type = 'default') {
    const el = document.getElementById(`${mode}Status`);
    if (!el) return;
    
    el.textContent = text;
    if (type === 'error') {
        el.classList.add('error');
    } else {
        el.classList.remove('error');
    }
}

/**
 * Updates the Finite State Machine (FSM) display for Motor Test.
 */
export function updateFSMDisplay(state) {
    const el = document.getElementById('fsmState');
    if (!el) return;

    el.textContent = `FSM State: ${state}`;
    el.className = 'stat-box fsm-state'; // Reset classes
    
    if (state === 'ARMED') el.classList.add('armed');
    else if (state === 'LAUNCHED') el.classList.add('launched');
    else if (state === 'FAILURE') el.classList.add('failure');
}

/**
 * Updates the max and current value displays in the sidebar.
 */
export function updateStatsDisplay(data, timeInSeconds) {
    // We don't update sidebar stats in Flight Mode
    if (appState.currentMode === 'rocketFlight') return;

    const timeString = `${timeInSeconds.toFixed(2)}s`;
    const { maxValues } = appState;

    // Helper to update text safely
    const setTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };

    // Check Max Values
    if (data.pressure != null && data.pressure > maxValues.pressure.value) {
        maxValues.pressure.value = data.pressure;
        maxValues.pressure.timestamp = timeInSeconds;
        setTxt('maxPressure', `Max Pressure: ${data.pressure.toFixed(2)} hPa @ ${timeString}`);
    }
    if (data.thrust != null && data.thrust > maxValues.thrust.value) {
        maxValues.thrust.value = data.thrust;
        maxValues.thrust.timestamp = timeInSeconds;
        setTxt('maxThrust', `Max Thrust: ${data.thrust.toFixed(2)} N @ ${timeString}`);
    }
    if (data.temperature != null && data.temperature > maxValues.temperature.value) {
        maxValues.temperature.value = data.temperature;
        maxValues.temperature.timestamp = timeInSeconds;
        setTxt('maxTemperature', `Max Temp: ${data.temperature.toFixed(2)} °C @ ${timeString}`);
    }

    // Update Current Values
    if (data.pressure != null) setTxt('currentPressure', `Current Pressure: ${data.pressure.toFixed(2)} hPa`);
    if (data.thrust != null) setTxt('currentThrust', `Current Thrust: ${data.thrust.toFixed(2)} N`);
    if (data.temperature != null) setTxt('currentTemperature', `Current Temp: ${data.temperature.toFixed(2)} °C`);
}

/**
 * Resets the stats sidebar text to default.
 */
export function resetStatsDisplay() {
    const setTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };
    setTxt('maxPressure', 'Max Pressure: -- hPa');
    setTxt('maxThrust', 'Max Thrust: -- N');
    setTxt('maxTemperature', 'Max Temp: -- °C');
    setTxt('currentPressure', 'Current Pressure: -- hPa');
    setTxt('currentThrust', 'Current Thrust: -- N');
    setTxt('currentTemperature', 'Current Temp: -- °C');
    setTxt('fsmState', 'FSM State: --');
}

/**
 * Initializes the Leaflet map in the specified container.
 */
export function initFlightMap(containerId) {
    if (typeof L === 'undefined') {
        console.error("Leaflet.js is not loaded.");
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // Cleanup existing map
    if (flightMap) {
        flightMap.remove();
        flightMap = null;
    }
    flightRocketMarker = null;
    flightPrimaryMarker = null;

    try {
        flightMap = L.map(containerId, { scrollWheelZoom: true })
            .setView(appState.flightPrimaryCoords, 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(flightMap);

        updatePrimaryMarker();
    } catch (e) {
        console.error("Error initializing map:", e);
        container.innerHTML = "<p>Error loading map.</p>";
    }
}

/**
 * Updates the Static Primary Marker (Launchpad/Home).
 */
export function updatePrimaryMarker() {
    const latInput = document.getElementById('flightLatInput');
    const lonInput = document.getElementById('flightLonInput');

    // If inputs exist, try to update appState from them
    if (latInput && lonInput) {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (!isNaN(lat) && !isNaN(lon)) {
            appState.flightPrimaryCoords = [lat, lon];
        } else {
            // Revert inputs to state if invalid
            latInput.value = appState.flightPrimaryCoords[0];
            lonInput.value = appState.flightPrimaryCoords[1];
        }
    }

    if (!flightMap) return;

    if (flightPrimaryMarker) {
        flightPrimaryMarker.setLatLng(appState.flightPrimaryCoords);
    } else {
        flightPrimaryMarker = L.marker(appState.flightPrimaryCoords)
            .addTo(flightMap)
            .bindPopup('Primary Location');
    }
    flightMap.panTo(appState.flightPrimaryCoords);
}

/**
 * Updates the Rocket's position marker on the map.
 */
export function updateFlightMapMarker(lat, lon) {
    if (!flightMap || !appState.flightConfig.gps) return;
    if (typeof lat !== 'number' || isNaN(lat) || typeof lon !== 'number' || isNaN(lon)) return;

    const newCoords = [lat, lon];

    if (!flightRocketMarker) {
        flightRocketMarker = L.marker(newCoords).addTo(flightMap);
        flightMap.setView(newCoords, 17);
    } else {
        flightRocketMarker.setLatLng(newCoords);
        flightMap.panTo(newCoords);
    }
}

/**
 * Forces the map to recalculate its size (useful when container resizes).
 */
export function resizeMap() {
    if (flightMap) flightMap.invalidateSize();
}

/**
 * Triggers the CSS animation for the rocket launch overlay.
 */
export function triggerLaunchAnimation() {
    launchOverlay = document.getElementById('launch-overlay');
    launchRocket = document.getElementById('launch-rocket');

    if (!launchOverlay || !launchRocket) return;

    launchOverlay.style.display = 'block';
    launchRocket.classList.add('launching');

    setTimeout(() => {
        launchOverlay.style.display = 'none';
        launchRocket.classList.remove('launching');
    }, 1500);
}

/**
 * Initializes custom styling for <select> elements.
 */
export function setupCustomSelects(scope = document) {
    scope.querySelectorAll('.select-wrapper').forEach(wrapper => {
        // Cleanup old
        const oldTrigger = wrapper.querySelector('.select-trigger');
        if (oldTrigger) oldTrigger.remove();
        const oldOptions = wrapper.querySelector('.options');
        if (oldOptions) oldOptions.remove();

        const select = wrapper.querySelector('select');
        if (!select) return;

        // Create UI
        const trigger = document.createElement('div');
        trigger.className = 'select-trigger';
        const optionsWrapper = document.createElement('div');
        optionsWrapper.className = 'options';

        // Populate options
        Array.from(select.options).forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'option';
            optionEl.textContent = option.textContent;
            optionEl.dataset.value = option.value;
            
            if (option.disabled) optionEl.classList.add('disabled');
            if (option.selected) optionEl.classList.add('selected');

            optionsWrapper.appendChild(optionEl);

            if (!option.disabled) {
                optionEl.addEventListener('click', () => {
                    select.value = option.value;
                    wrapper.classList.remove('open');
                    // Dispatch change event manually so listeners fire
                    select.dispatchEvent(new Event('change'));
                });
            }
        });

        // Trigger Text
        const selectedText = select.options.length > 0 
            ? select.options[select.selectedIndex].textContent 
            : '';
        trigger.innerHTML = `<span>${selectedText}</span>`;

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsWrapper);

        // Toggle Logic
        trigger.addEventListener('click', (e) => {
            // Close others
            document.querySelectorAll('.select-wrapper.open').forEach(openWrapper => {
                if (openWrapper !== wrapper) openWrapper.classList.remove('open');
            });
            wrapper.classList.toggle('open');
            e.stopPropagation();
        });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.select-wrapper')) {
            document.querySelectorAll('.select-wrapper.open').forEach(w => w.classList.remove('open'));
        }
    });
}