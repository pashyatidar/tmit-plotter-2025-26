/**
 * js/plotting.js
 * Handles uPlot chart initialization, configuration, rendering, and resizing.
 */

import { appState } from './state.js';
import { getThemeColors } from './utils.js';
import { initFlightMap, resizeMap } from './ui.js';

// --- Module-Level State for Chart Instances ---
let standardPlots = []; 

// Thumbnails
let uplotPressureThumb = null;
let uplotThrustThumb = null;
let uplotTempThumb = null;

// Flight Mode Plots
let flightRawPlots = {};  
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
        setupFlightPlotLayout(false); 
    } else {
        // Standard Modes (CSV, Motor, Hydro, Random)
        destroyMainPlots();
        destroyThumbnailPlots();

        const mainChartArea = document.getElementById('mainChartArea');
        if (!mainChartArea) return;

        // Clear DOM and reset classes
        mainChartArea.innerHTML = '';
        mainChartArea.className = 'main-chart-area'; 

        const count = availableSeries.length;
        const timeData = uplotData.time || [];

        // Apply dynamic grid class for the "2-up, 1-down" layout
        if (count === 1) mainChartArea.classList.add('grid-1');
        else if (count === 2) mainChartArea.classList.add('grid-2');
        else if (count === 3) mainChartArea.classList.add('grid-3');
        else if (count >= 4) mainChartArea.classList.add('grid-4');

        // Create plots
        availableSeries.forEach(seriesName => {
            const wrapper = document.createElement('div');
            wrapper.className = 'uplot-main-wrapper';
            mainChartArea.appendChild(wrapper);

            const seriesData = uplotData[seriesName] || [];
            
            // Ensure data alignment for init
            const initialData = [timeData, seriesData];
            if (initialData[0].length === 0) {
                 initialData[0] = [null]; 
                 initialData[1] = [null];
            }

            const instance = createMainPlot(seriesName, wrapper, initialData);
            standardPlots.push({ instance, wrapper, seriesName });
        });

        // Initialize thumbnails
        const pThumbEl = document.getElementById('pressureThumbnail')?.querySelector('.thumbnail-chart');
        if (pThumbEl) uplotPressureThumb = createThumbnailPlot('pressure', pThumbEl, [timeData, uplotData.pressure || []]);

        const tThumbEl = document.getElementById('thrustThumbnail')?.querySelector('.thumbnail-chart');
        if (tThumbEl) uplotThrustThumb = createThumbnailPlot('thrust', tThumbEl, [timeData, uplotData.thrust || []]);

        const tempThumbEl = document.getElementById('temperatureThumbnail')?.querySelector('.thumbnail-chart');
        if (tempThumbEl) uplotTempThumb = createThumbnailPlot('temperature', tempThumbEl, [timeData, uplotData.temperature || []]);
    }

    requestAnimationFrame(resizePlots);
}

/**
 * Updates all active charts with the latest data.
 */
export function updateAllPlots() {
    const { uplotData, currentMode, isSerialConnected, randomPlotting, isPlotting } = appState;
    const timeData = uplotData.time || [];
    const dataLength = timeData.length;

    // 1. Push Data
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
        standardPlots.forEach(plot => {
            if (plot.instance) {
                plot.instance.setData([timeData, uplotData[plot.seriesName] || []], false);
            }
        });

        if (uplotPressureThumb) uplotPressureThumb.setData([timeData, uplotData.pressure || []], false);
        if (uplotThrustThumb) uplotThrustThumb.setData([timeData, uplotData.thrust || []], false);
        if (uplotTempThumb) uplotTempThumb.setData([timeData, uplotData.temperature || []], false);
    }

    // 2. Calculate Scaling
    let newScale = null;
    
    // Check if we have data to plot
    if (dataLength >= 1 && (isSerialConnected || randomPlotting || isPlotting)) {
        
        // CSV Playback Mode: Auto-expand
        if (isPlotting) {
            const windowStartTime = timeData[0];
            const windowEndTime = timeData[dataLength - 1];
            const duration = windowEndTime - windowStartTime;
            const padding = duration > 0 ? duration * 0.05 : 1; 
            newScale = { min: windowStartTime, max: windowEndTime + padding };
        } 
        // Live Mode: Sliding Window (20 seconds)
        else if ((randomPlotting || isSerialConnected) && dataLength >= 2) {
            const windowEndTime = timeData[dataLength - 1];
            const windowStartTime = Math.max(timeData[0] ?? 0, windowEndTime - 20);
            newScale = { min: windowStartTime, max: windowEndTime };
        }
    }

    // 3. Apply Scaling
    const applyScaleAndRedraw = (instance, scale) => {
        if (!instance) return;
        if (scale) instance.setScale('x', scale);
        else instance.redraw(false, false);
    };

    if (currentMode === 'rocketFlight') {
        Object.values(flightRawPlots).forEach(p => applyScaleAndRedraw(p.instance, newScale));
    } else {
        standardPlots.forEach(p => applyScaleAndRedraw(p.instance, newScale));
        applyScaleAndRedraw(uplotPressureThumb, newScale);
        applyScaleAndRedraw(uplotThrustThumb, newScale);
        applyScaleAndRedraw(uplotTempThumb, newScale);
    }
}

export function destroyAllPlots() {
    destroyMainPlots();
    destroyThumbnailPlots();
    destroyFlightPlots();
}

function destroyMainPlots() {
    standardPlots.forEach(p => { if (p.instance) p.instance.destroy(); });
    standardPlots = [];
    const mainChartArea = document.getElementById('mainChartArea');
    if (mainChartArea) mainChartArea.innerHTML = '';
}

function destroyThumbnailPlots() {
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }
}

export function destroyFlightPlots() {
    Object.values(flightRawPlots).forEach(p => { if (p.instance) p.instance.destroy(); });
    flightRawPlots = {};
    const rawContainer = document.getElementById('flightRawPlotsContainer');
    if (rawContainer) rawContainer.innerHTML = '';
}

export function resizePlots() {
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
    } else {
        standardPlots.forEach(plot => {
            if (plot.instance && plot.wrapper) {
                plot.instance.setSize({ 
                    width: plot.wrapper.clientWidth, 
                    height: plot.wrapper.clientHeight 
                });
            }
        });
        // Resize thumbnails
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

export function swapMainChart(seriesName) { return; }

/**
 * REFACTORED: Applies theme colors to all active charts via clean config reconstruction.
 * Fixes "dim/invisible" axes by ensuring ticks get solid colors and internal state is not spread.
 */
export function updateChartStyles() {
    const themeColors = getThemeColors();
    const allInstances = [
        ...standardPlots.map(p => p.instance),
        uplotPressureThumb, uplotThrustThumb, uplotTempThumb,
        ...Object.values(flightRawPlots).map(p => p.instance)
    ];

    allInstances.forEach(instance => {
        if (!instance) return;
        
        // Update Legend Colors (DOM based)
        const root = instance.root;
        if (root) {
            const legend = root.querySelector('.u-legend');
            if (legend) {
                legend.style.color = themeColors.labels;
            }
        }

        // Update Axes Colors (Canvas based)
        if (instance.axes && instance.axes.length >= 2) {
             const newAxes = instance.axes.map(axis => ({
                 // Essential structural properties
                 scale: axis.scale,
                 label: axis.label,
                 side: axis.side,
                 show: axis.show,
                 size: axis.size,
                 
                 // New Style Properties
                 stroke: themeColors.axes,           // Text/Value Color
                 labelFont: '14px sans-serif',
                 valueFont: '12px sans-serif',
                 
                 // Grid Config
                 grid: { 
                     show: axis.grid ? axis.grid.show : true,
                     stroke: themeColors.grid,
                     width: 1,
                     dash: axis.grid ? axis.grid.dash : [],
                 },
                 
                 // Tick Config - Force solid color matching axes
                 ticks: { 
                     show: axis.ticks ? axis.ticks.show : true,
                     stroke: themeColors.axes, // Use SOLID color, not faint grid color
                     width: 1,
                     dash: axis.ticks ? axis.ticks.dash : [],
                 }
             }));
             
             instance.setAxes(newAxes);
             // Force layout recalculation to ensure clean repaint
             instance.redraw(false, true);
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
    const seriesConfig = {
        pressure: { label: 'Pressure (hPa)', stroke: 'blue', width: 2 },
        thrust: { label: 'Thrust (N)', stroke: 'red', width: 2 },
        temperature: { label: 'Temperature (°C)', stroke: 'orange', width: 2 },
    };
    const config = seriesConfig[seriesName] || { label: seriesName, stroke: '#ccc', width: 2 };

    if (isThumbnail) {
        return {
            legend: { show: false },
            scales: { x: { time: false }, y: { auto: true } },
            axes: [{ show: false }, { show: false }],
            cursor: { show: false },
            series: [ {}, { stroke: config.stroke, width: 2 } ],
        };
    } else {
        return {
            legend: { show: false },
            // TIME: FALSE ensures raw timestamp display (seconds)
            scales: { x: { time: false }, y: { auto: true } },
            series: [ {}, { ...config, points: { show: false } } ],
            axes: [
                { 
                    scale: 'x', 
                    label: 'Time (s)', 
                    stroke: themeColors.axes, 
                    grid: { stroke: themeColors.grid }, 
                    ticks: { stroke: themeColors.axes } // Init with solid color
                },
                { 
                    label: config.label, 
                    stroke: themeColors.axes, 
                    grid: { stroke: themeColors.grid }, 
                    ticks: { stroke: themeColors.axes } // Init with solid color
                }
            ],
        };
    }
}

// --- Flight Mode Layout Logic ---

export function setupFlightPlotLayout(isPreview = false) {
    destroyFlightPlots();
    const container = document.getElementById('flightRawPlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    const { flightConfig, uplotData } = appState;
    const selectedTypes = [];
    if (flightConfig.pressure) selectedTypes.push('pressure');
    if (flightConfig.acceleration) selectedTypes.push('acceleration');
    if (flightConfig.gyroscope) selectedTypes.push('gyroscope');

    const numSelected = selectedTypes.length;
    let layoutHTML = '';
    const plotIds = [];
    const mapContainerHTML = `<div id="flightMapContainer" class="map-container"></div>`;

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
    initFlightMap('flightMapContainer');

    selectedTypes.forEach((type, i) => {
        const plotId = plotIds[i];
        if (!plotId) return;
        const wrapper = document.getElementById(plotId);
        const opts = getFlightChartOptions(type, isPreview);
        let data = [];
        const timeData = isPreview ? [0] : (uplotData.time || []);
        data.push(timeData);

        if (type === 'pressure') data.push(isPreview ? [0] : (uplotData.pressure || []));
        else if (type === 'acceleration') {
            data.push(isPreview ? [0] : (uplotData.acc_x || []));
            data.push(isPreview ? [0] : (uplotData.acc_y || []));
            data.push(isPreview ? [0] : (uplotData.acc_z || []));
        } else if (type === 'gyroscope') {
            data.push(isPreview ? [0] : (uplotData.gyro_x || []));
            data.push(isPreview ? [0] : (uplotData.gyro_y || []));
            data.push(isPreview ? [0] : (uplotData.gyro_z || []));
        }

        if (data[0].length === 0) data = data.map(() => [null]);

        flightRawPlots[type] = { instance: new uPlot(opts, data, wrapper), wrapper: wrapper };
    });
}

function getFlightChartOptions(seriesType, isPreview = false) {
    const themeColors = getThemeColors();
    let opts = {
        legend: { show: false },
        scales: { x: { time: false }, y: { auto: true } },
        series: [{}],
        axes: [
            { scale: 'x', label: isPreview ? null : 'Time (s)', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.axes } },
            { label: 'Value', stroke: themeColors.axes, grid: { stroke: themeColors.grid }, ticks: { stroke: themeColors.axes } }
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
    
    if (isPreview) opts.axes[1].label = seriesType.charAt(0).toUpperCase() + seriesType.slice(1);
    return opts;
}