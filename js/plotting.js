/**
 * js/plotting.js
 * Handles uPlot chart initialization, configuration, rendering, and resizing.
 */

import { appState } from './state.js';
import { getThemeColors } from './utils.js';
import { initFlightMap, resizeMap } from './ui.js';

// --- Module-Level State for Chart Instances ---
// We keep these here because other modules generally don't need direct access to the chart objects,
// only the data in appState.
let mainPlot1 = { instance: null, series: null };
let mainPlot2 = { instance: null, series: null };

// Thumbnails
let uplotPressureThumb = null;
let uplotThrustThumb = null;
let uplotTempThumb = null;

// Flight Mode Plots
let flightRawPlots = {};  // Stores instances like { pressure: { instance, wrapper }, ... }
let flightCalcPlots = {};

// Axis Colors for Flight Mode
const flightAxisColors = {
    x: '#E63946', // Red
    y: '#52B788', // Green
    z: '#457B9D'  // Blue
};

/**
 * Main entry point to setup charts based on the current mode and available data.
 */
export function setupChartInstances() {
    const { currentMode, availableSeries, uplotData } = appState;

    if (currentMode === 'rocketFlight') {
        setupFlightPlotLayout(false); // False means not a preview, actual setup
    } else {
        // Standard Modes (CSV, Motor, Hydro, Random)
        destroyMainPlots();
        destroyThumbnailPlots();

        const wrapper1 = document.getElementById('uplot-main-wrapper-1');
        const wrapper2 = document.getElementById('uplot-main-wrapper-2');
        const mainChartArea = document.getElementById('mainChartArea');
        
        const timeData = uplotData.time || [];

        // Determine Layout (1 or 2 charts)
        if (availableSeries.length === 1) {
            if (mainChartArea) mainChartArea.classList.remove('two-chart-layout');
            if (wrapper1) wrapper1.style.display = 'flex';
            if (wrapper2) wrapper2.style.display = 'none';

            mainPlot1.series = availableSeries[0];
            mainPlot1.instance = createMainPlot(mainPlot1.series, wrapper1, [timeData, uplotData[mainPlot1.series] || []]);

        } else if (availableSeries.length >= 2) {
            if (mainChartArea) mainChartArea.classList.add('two-chart-layout');
            if (wrapper1) wrapper1.style.display = 'flex';
            if (wrapper2) wrapper2.style.display = 'flex';

            mainPlot1.series = availableSeries[0];
            mainPlot1.instance = createMainPlot(mainPlot1.series, wrapper1, [timeData, uplotData[mainPlot1.series] || []]);

            mainPlot2.series = availableSeries[1];
            mainPlot2.instance = createMainPlot(mainPlot2.series, wrapper2, [timeData, uplotData[mainPlot2.series] || []]);
        }

        // Setup Thumbnails (always attempt to create all three if elements exist)
        const pThumbEl = document.getElementById('pressureThumbnail')?.querySelector('.thumbnail-chart');
        if (pThumbEl) uplotPressureThumb = createThumbnailPlot('pressure', pThumbEl, [timeData, uplotData.pressure || []]);

        const tThumbEl = document.getElementById('thrustThumbnail')?.querySelector('.thumbnail-chart');
        if (tThumbEl) uplotThrustThumb = createThumbnailPlot('thrust', tThumbEl, [timeData, uplotData.thrust || []]);

        const tempThumbEl = document.getElementById('temperatureThumbnail')?.querySelector('.thumbnail-chart');
        if (tempThumbEl) uplotTempThumb = createThumbnailPlot('temperature', tempThumbEl, [timeData, uplotData.temperature || []]);

        updateActiveThumbnails();
    }

    // Force a resize to fit containers
    requestAnimationFrame(resizePlots);
}

/**
 * Updates all active charts with the latest data from appState.uplotData.
 * Also handles the sliding window logic for real-time plotting.
 */
export function updateAllPlots() {
    const { uplotData, currentMode, isSerialConnected, randomPlotting, isPlotting } = appState;
    const timeData = uplotData.time || [];
    const dataLength = timeData.length;

    // 1. Push Data to Instances
    if (currentMode === 'rocketFlight') {
        if (flightRawPlots.pressure?.instance) {
            flightRawPlots.pressure.instance.setData([timeData, uplotData.pressure || []], false);
        }
        if (flightRawPlots.acceleration?.instance) {
            flightRawPlots.acceleration.instance.setData([timeData, uplotData.acc_x || [], uplotData.acc_y || [], uplotData.acc_z || []], false);
        }
        if (flightRawPlots.gyroscope?.instance) {
            flightRawPlots.gyroscope.instance.setData([timeData, uplotData.gyro_x || [], uplotData.gyro_y || [], uplotData.gyro_z || []], false);
        }
    } else {
        if (mainPlot1.instance) {
            mainPlot1.instance.setData([timeData, uplotData[mainPlot1.series] || []], false);
        }
        if (mainPlot2.instance) {
            mainPlot2.instance.setData([timeData, uplotData[mainPlot2.series] || []], false);
        }
        if (uplotPressureThumb) uplotPressureThumb.setData([timeData, uplotData.pressure || []], false);
        if (uplotThrustThumb) uplotThrustThumb.setData([timeData, uplotData.thrust || []], false);
        if (uplotTempThumb) uplotTempThumb.setData([timeData, uplotData.temperature || []], false);
    }

    // 2. Calculate Scaling (Sliding Window)
    let newScale = null;
    if (dataLength >= 1 && (isSerialConnected || randomPlotting || isPlotting)) {
        if ((randomPlotting || isSerialConnected) && dataLength >= 2) {
            // Live Mode: Show last 20 seconds
            const windowEndTime = timeData[dataLength - 1];
            const windowStartTime = Math.max(timeData[0] ?? 0, windowEndTime - 20);
            newScale = { min: windowStartTime, max: windowEndTime };
        } else if (isPlotting && dataLength >= 1) {
            // CSV Playback Mode: Auto-expand
            const windowStartTime = timeData[0];
            const windowEndTime = timeData[dataLength - 1];
            const duration = windowEndTime - windowStartTime;
            const padding = duration > 0 ? duration * 0.1 : 1;
            newScale = { min: windowStartTime, max: windowEndTime + padding };
        }
    }

    // 3. Apply Scaling and Redraw
    const applyScaleAndRedraw = (instance, scale) => {
        if (!instance) return;
        if (scale) instance.setScale('x', scale);
        else instance.redraw(false, false);
    };

    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(p => applyScaleAndRedraw(p.instance, newScale));
    } else {
        applyScaleAndRedraw(mainPlot1.instance, newScale);
        applyScaleAndRedraw(mainPlot2.instance, newScale);
        applyScaleAndRedraw(uplotPressureThumb, newScale);
        applyScaleAndRedraw(uplotThrustThumb, newScale);
        applyScaleAndRedraw(uplotTempThumb, newScale);
    }
}

/**
 * Destroys all chart instances to free memory.
 */
export function destroyAllPlots() {
    destroyMainPlots();
    destroyThumbnailPlots();
    destroyFlightPlots();
}

function destroyMainPlots() {
    if (mainPlot1.instance) { mainPlot1.instance.destroy(); mainPlot1.instance = null; }
    if (mainPlot2.instance) { mainPlot2.instance.destroy(); mainPlot2.instance = null; }
}

function destroyThumbnailPlots() {
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }
}

export function destroyFlightPlots() {
    Object.values(flightRawPlots).forEach(p => { if (p.instance) p.instance.destroy(); });
    flightRawPlots = {};
    
    // Clear DOM containers
    const rawContainer = document.getElementById('flightRawPlotsContainer');
    if (rawContainer) rawContainer.innerHTML = '';
}

/**
 * Handles window resizing.
 */
export function resizePlots() {
    // 1. Resize Flight Mode Plots
    if (appState.currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(plot => {
            if (plot.instance && plot.wrapper) {
                plot.instance.setSize({ 
                    width: plot.wrapper.clientWidth, 
                    height: plot.wrapper.clientHeight 
                });
            }
        });
        resizeMap();
    } 
    // 2. Resize Standard Plots
    else {
        if (mainPlot1.instance) {
            const w = document.getElementById('uplot-main-wrapper-1');
            if (w) mainPlot1.instance.setSize({ width: w.clientWidth, height: w.clientHeight });
        }
        if (mainPlot2.instance) {
            const w = document.getElementById('uplot-main-wrapper-2');
            if (w) mainPlot2.instance.setSize({ width: w.clientWidth, height: w.clientHeight });
        }
        // Resize Thumbnails
        [
            { inst: uplotPressureThumb, id: 'pressureThumbnail' },
            { inst: uplotThrustThumb, id: 'thrustThumbnail' },
            { inst: uplotTempThumb, id: 'temperatureThumbnail' }
        ].forEach(item => {
            if (item.inst) {
                const el = document.getElementById(item.id)?.querySelector('.thumbnail-chart');
                if (el) item.inst.setSize({ width: el.clientWidth, height: el.clientHeight });
            }
        });
    }
}

/**
 * Swaps the data series displayed in Main Chart 1 (clicked from sidebar).
 */
export function swapMainChart(seriesName) {
    if (appState.currentMode === 'rocketFlight' || !seriesName || mainPlot1.series === seriesName) return;

    mainPlot1.series = seriesName;
    if (mainPlot1.instance) mainPlot1.instance.destroy();

    const wrapper = document.getElementById('uplot-main-wrapper-1');
    const { uplotData } = appState;
    const timeData = uplotData.time || [];
    const seriesData = uplotData[seriesName] || [];

    // Ensure data alignment
    const dataToUse = [timeData, seriesData];
    if (dataToUse[0].length === 0) dataToUse.forEach(arr => arr.push(null));

    mainPlot1.instance = createMainPlot(seriesName, wrapper, dataToUse);
    
    updateActiveThumbnails();
    resizePlots();
}

/**
 * Refreshes chart styles (colors/grids) when theme changes.
 */
export function updateChartStyles() {
    const themeColors = getThemeColors();
    const allInstances = [
        mainPlot1.instance, mainPlot2.instance,
        uplotPressureThumb, uplotThrustThumb, uplotTempThumb,
        ...Object.values(flightRawPlots).map(p => p.instance)
    ];

    const axisConfig = {
        stroke: themeColors.axes,
        grid: { stroke: themeColors.grid },
        ticks: { stroke: themeColors.grid },
        labelFont: '14px sans-serif',
        valueFont: '12px sans-serif'
    };

    allInstances.forEach(instance => {
        if (!instance) return;
        
        // Update Axes config if the chart has axes (thumbnails might not)
        if (instance.axes && instance.axes.length >= 2) {
             // We need to keep existing scale/label info, just update colors
             const newAxes = instance.axes.map(axis => ({
                 ...axis,
                 ...axisConfig,
                 label: axis.label // Preserve label
             }));
             instance.setAxes(newAxes);
        } else {
            instance.redraw();
        }

        // Update Legend & Text colors via DOM
        const svg = instance.root?.querySelector('svg');
        if (svg) {
            svg.querySelectorAll('.u-axis text, .u-legend th, .u-legend td').forEach(el => {
                if (el) el.style.fill = themeColors.labels;
            });
        }
    });
}

// --- Internal Helper Functions ---

function createMainPlot(seriesName, wrapper, data) {
    const opts = getChartOptions(seriesName, false);
    return new uPlot(opts, data, wrapper);
}

function createThumbnailPlot(seriesName, wrapper, data) {
    const opts = getChartOptions(seriesName, true);
    return new uPlot(opts, data, wrapper);
}

function getChartOptions(seriesName, isThumbnail = false) {
    const themeColors = getThemeColors();
    
    // Configuration for known series
    const seriesConfig = {
        pressure: { label: 'Pressure (hPa)', stroke: 'blue', width: 2 },
        thrust: { label: 'Thrust (N)', stroke: 'red', width: 2 },
        temperature: { label: 'Temperature (°C)', stroke: 'orange', width: 2 },
    };
    
    // Default fallback
    const config = seriesConfig[seriesName] || { label: seriesName, stroke: '#ccc', width: 2 };

    if (isThumbnail) {
        return {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            axes: [{ show: false }, { show: false }],
            cursor: { show: false },
            series: [
                {}, // x-axis
                { stroke: config.stroke, width: 2 }
            ],
        };
    } else {
        return {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            series: [
                {}, // x-axis
                { ...config, points: { show: false } }
            ],
            axes: [
                { 
                    scale: 'x', 
                    label: 'Time (s)', 
                    stroke: themeColors.axes, 
                    grid: { stroke: themeColors.grid }, 
                    ticks: { stroke: themeColors.grid } 
                },
                { 
                    label: config.label, 
                    stroke: themeColors.axes, 
                    grid: { stroke: themeColors.grid }, 
                    ticks: { stroke: themeColors.grid } 
                }
            ],
        };
    }
}

function updateActiveThumbnails() {
    const containers = document.querySelectorAll('.thumbnail-chart-container');
    const activeSeries = [mainPlot1.series, mainPlot2.series].filter(Boolean);
    
    containers.forEach(container => {
        if (activeSeries.includes(container.dataset.series)) {
            container.classList.add('active');
        } else {
            container.classList.remove('active');
        }
    });
}

// --- Flight Mode Layout Logic ---

/**
 * Dynamically builds the DOM layout for Flight Mode based on selected config.
 * @param {boolean} isPreview - If true, generates dummy data for visual preview.
 */
export function setupFlightPlotLayout(isPreview = false) {
    destroyFlightPlots();
    
    const container = document.getElementById('flightRawPlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    const { flightConfig, uplotData } = appState;
    
    // Determine selected plots
    const selectedTypes = [];
    if (flightConfig.pressure) selectedTypes.push('pressure');
    if (flightConfig.acceleration) selectedTypes.push('acceleration');
    if (flightConfig.gyroscope) selectedTypes.push('gyroscope');

    const numSelected = selectedTypes.length;
    let layoutHTML = '';
    const plotIds = [];
    const mapContainerHTML = `<div id="flightMapContainer" class="map-container"></div>`;

    // Grid Classes based on CSS logic
    container.className = 'main-chart-area'; 
    
    if (numSelected === 3) {
        container.classList.add('layout-two-by-two');
        plotIds.push('flight-plot-bottom-left', 'flight-plot-top-right', 'flight-plot-bottom-right');
        layoutHTML = `
            <div class="plot-wrapper blank plot-top-left">${mapContainerHTML}</div>
            <div id="flight-plot-top-right" class="plot-wrapper plot-top-right"></div>
            <div id="flight-plot-bottom-left" class="plot-wrapper plot-bottom-left"></div>
            <div id="flight-plot-bottom-right" class="plot-wrapper plot-bottom-right"></div>
        `;
    } else if (numSelected === 2) {
        container.classList.add('layout-three-split');
        plotIds.push('flight-plot-top-right', 'flight-plot-bottom-right');
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half">${mapContainerHTML}</div>
            <div class="plot-right-column">
                <div id="flight-plot-top-right" class="plot-wrapper plot-right-quarter"></div>
                <div id="flight-plot-bottom-right" class="plot-wrapper plot-right-quarter"></div>
            </div>
        `;
    } else if (numSelected === 1) {
        container.classList.add('layout-two-split');
        plotIds.push('flight-plot-right-half');
        layoutHTML = `
            <div class="plot-wrapper blank plot-left-half">${mapContainerHTML}</div>
            <div id="flight-plot-right-half" class="plot-wrapper plot-right-half"></div>
        `;
    } else {
        container.classList.add('layout-full-map');
        layoutHTML = `<div class="plot-wrapper blank">${mapContainerHTML}</div>`;
    }

    container.innerHTML = layoutHTML;

    // Initialize Map
    initFlightMap('flightMapContainer');

    // Create uPlot instances for selected types
    selectedTypes.forEach((type, i) => {
        const plotId = plotIds[i];
        if (!plotId) return;
        const wrapper = document.getElementById(plotId);
        
        const opts = getFlightChartOptions(type, isPreview);
        
        // Prepare Data
        let data = [];
        const timeData = isPreview ? [0] : (uplotData.time || []);
        data.push(timeData);

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

        // Handle empty data init
        if (data[0].length === 0) {
            data = data.map(() => [null]); // uPlot needs at least one point to render grid
        }

        flightRawPlots[type] = {
            instance: new uPlot(opts, data, wrapper),
            wrapper: wrapper
        };
    });
}

function getFlightChartOptions(seriesType, isPreview = false) {
    const themeColors = getThemeColors();
    let opts = {
        legend: { show: false },
        scales: { x: { time: false }, y: { auto: true } },
        series: [{}], // x-axis
        axes: [
            { 
                scale: 'x', 
                label: isPreview ? null : 'Time (s)', 
                stroke: themeColors.axes, 
                grid: { stroke: themeColors.grid }, 
                ticks: { stroke: themeColors.grid } 
            },
            { 
                label: 'Value', 
                stroke: themeColors.axes, 
                grid: { stroke: themeColors.grid }, 
                ticks: { stroke: themeColors.grid } 
            }
        ],
        cursor: { y: false }
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
        opts.axes[1].label = seriesType.charAt(0).toUpperCase() + seriesType.slice(1);
    }

    return opts;
}