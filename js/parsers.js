/**
 * js/parsers.js
 * Logic for parsing CSV files and Serial data lines.
 * This module is designed to be pure (does not directly modify global state or UI).
 */

/**
 * Parses a CSV string into an array of data objects.
 * * @param {string} csvText - The raw CSV string content.
 * @param {string} timestampUnit - 'ms' (milliseconds) or 's' (seconds).
 * @returns {object|null} Returns an object { allData, availableSeries, plotStartTime } 
 * or null if parsing failed.
 */
export function parseCSV(csvText, timestampUnit = 'ms') {
    const lines = csvText.trim().split(/[\r\n]+/).map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
        console.error("CSV has less than 2 lines (header + data).");
        return null;
    }

    // Parse Headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const tsIndex = headers.indexOf('timestamp');

    if (tsIndex === -1) {
        console.error("CSV missing 'timestamp' header.");
        return null;
    }

    // Determine available series based on headers
    const potentialSeries = ['pressure', 'thrust', 'temperature'];
    const availableSeries = [];
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
        return null;
    }

    // Parse Data Rows
    const allData = lines.slice(1).map((line, lineIndex) => {
        const cols = line.split(',');
        if (cols.length <= tsIndex) {
            // Skip lines that don't have enough columns for the timestamp
            return null;
        }

        let time = parseFloat(cols[tsIndex]);
        if (isNaN(time)) {
            return null;
        }

        if (timestampUnit === 's') {
            time *= 1000; // Convert to ms
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
        return null;
    }

    // Sort by timestamp to ensure correct playback
    allData.sort((a, b) => a.timestamp - b.timestamp);

    return {
        allData,
        availableSeries,
        plotStartTime: allData[0].timestamp
    };
}

/**
 * Parses a single line of serial data based on the current mode.
 * * @param {string} line - The raw serial line.
 * @param {string} mode - 'motorTest', 'hydrostaticTest', 'rocketFlight'.
 * @param {object} flightConfig - The flight configuration object (sequence, delimiter).
 * @param {Array} availableSeries - Array of active series names (for hydrostatic mode).
 * @returns {object|null} Returns an object { type: 'data'|'fsm', payload: ... } 
 * or null if the line was invalid or ignored.
 */
export function processSerialLine(line, mode, flightConfig, availableSeries) {
    // Remove non-printable characters and trim
    const cleanLine = line.replace(/[^\x20-\x7E]/g, '').trim();

    if (!cleanLine) return null;

    // --- Motor Test Mode Parsing ---
    if (mode === 'motorTest') {
        // Ignore echo commands or OK responses
        if (cleanLine.startsWith("AT+SEND") || cleanLine === "OK") {
            return null;
        }

        // Protocol Check: +RCV=ID,LEN,PAYLOAD,RSSI,SNR
        if (cleanLine.startsWith("+RCV=")) {
            const parts = cleanLine.split(',');
            if (parts.length < 5) return null;

            // Extract the payload (middle part)
            const dataPayloadString = parts.slice(2, -2).join(',').trim();

            const FSM_STATES = ['SAFE', 'ARMED', 'LAUNCHED', 'BOOT', 'FAILURE'];
            
            // Case 1: FSM State Message
            if (FSM_STATES.includes(dataPayloadString)) {
                return {
                    type: 'fsm',
                    payload: dataPayloadString
                };
            }
            // Case 2: Sensor Data Message (timestamp, thrust, pressure)
            else {
                const dataValues = dataPayloadString.split(',');
                if (dataValues.length === 3) {
                    const timestamp = parseFloat(dataValues[0]);
                    const thrust = parseFloat(dataValues[1]);
                    const pressure = parseFloat(dataValues[2]);

                    if (!isNaN(timestamp) && !isNaN(thrust) && !isNaN(pressure)) {
                        return {
                            type: 'data',
                            payload: { timestamp, thrust, pressure }
                        };
                    }
                }
            }
        }
    } 
    
    // --- Hydrostatic Test Mode Parsing ---
    else if (mode === 'hydrostaticTest') {
        const cols = cleanLine.split(',');
        const timestamp = parseFloat(cols[0]);
        
        if (isNaN(timestamp)) return null;

        const point = { timestamp };
        
        // Map columns to configured series
        availableSeries.forEach((seriesName, index) => {
            const colIndex = index + 1; // 0 is timestamp
            if (cols.length > colIndex) {
                const valStr = cols[colIndex]?.trim();
                const val = parseFloat(valStr);
                point[seriesName] = (valStr !== '' && !isNaN(val)) ? val : null;
            } else {
                point[seriesName] = null;
            }
        });

        return { type: 'data', payload: point };
    } 
    
    // --- Rocket Flight Mode Parsing ---
    else if (mode === 'rocketFlight') {
        const cols = cleanLine.split(flightConfig.delimiter);
        const timestamp = parseFloat(cols[0]);

        if (isNaN(timestamp)) return null;

        const point = { 
            timestamp,
            gps_lat: null, gps_lon: null,
            pressure: null,
            acc_x: null, acc_y: null, acc_z: null,
            gyro_x: null, gyro_y: null, gyro_z: null
        };

        try {
            let colIndex = 1; // Start parsing after timestamp

            for (const type of flightConfig.sequence) {
                if (colIndex >= cols.length) break;

                if (type === 'gps') {
                    const lat = parseFloat(cols[colIndex]);
                    const lon = parseFloat(cols[colIndex + 1]);
                    point.gps_lat = (!isNaN(lat)) ? lat : null;
                    point.gps_lon = (!isNaN(lon)) ? lon : null;
                    colIndex += 2;
                } 
                else if (type === 'pressure') {
                    const val = parseFloat(cols[colIndex]);
                    point.pressure = (!isNaN(val)) ? val : null;
                    colIndex += 1;
                } 
                else if (type === 'acceleration') {
                    const x = parseFloat(cols[colIndex]);
                    const y = parseFloat(cols[colIndex + 1]);
                    const z = parseFloat(cols[colIndex + 2]);
                    point.acc_x = (!isNaN(x)) ? x : null;
                    point.acc_y = (!isNaN(y)) ? y : null;
                    point.acc_z = (!isNaN(z)) ? z : null;
                    colIndex += 3;
                } 
                else if (type === 'gyroscope') {
                    const x = parseFloat(cols[colIndex]);
                    const y = parseFloat(cols[colIndex + 1]);
                    const z = parseFloat(cols[colIndex + 2]);
                    point.gyro_x = (!isNaN(x)) ? x : null;
                    point.gyro_y = (!isNaN(y)) ? y : null;
                    point.gyro_z = (!isNaN(z)) ? z : null;
                    colIndex += 3;
                }
            }

            return { type: 'data', payload: point };

        } catch (e) {
            console.error("Error parsing flight data:", e);
            return null;
        }
    }

    return null;
}