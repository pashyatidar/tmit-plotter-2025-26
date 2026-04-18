import { useState, useRef, useCallback } from 'react';
import uPlot from 'uplot';

// --- 1. DATA INTERFACE ---
// Matches the "RocketState" struct from your firmware
export interface FlightDataPoint {
    timestamp: number;
    
    // Estimator
    altitude: number;
    velocity: number;
    accel_z: number;
    
    // GPS
    lat: number;
    lon: number;
    gps_alt?: number;
    gps_iTOW?: number;
    sats?: number;
    fix?: number;
    
    // State
    state: number;

    // --- Extended Data ---
    airbrake_extension?: number;
    mach_number?: number;
    airspeed_tas?: number;
    tilt_angle?: number;

    // IMU
    ax?: number; ay?: number; az?: number;
    gx?: number; gy?: number; gz?: number;
    mx?: number; my?: number; mz?: number;

    // Environment
    pressure?: number;
    temp?: number;
    diff_pressure?: number;

    // Continuity
    drogue_continuity?: number;
    main_continuity?: number;

    // Sensor Health
    bitmask?: string | number;

    // IMU Extension
    imu_ax?: number;
    imu_ay?: number;
    imu_az?: number;

    // LoRa Data
    rssi?: number;
    snr?: number;
    address?: number;
    length?: number;
}

// Map of parameter type → { plotData index, CSV header }
const PARAM_COLUMN_MAP: Record<string, { index: number; header: string }> = {
    ALTITUDE:    { index: 1,  header: 'Altitude_m' },
    VELOCITY:    { index: 2,  header: 'Velocity_ms' },
    ACCEL_Z:     { index: 3,  header: 'AccelZ_G' },
    GYRO_X:      { index: 8,  header: 'GyroX_dps' },
    GYRO_Y:      { index: 9,  header: 'GyroY_dps' },
    GYRO_Z:      { index: 10, header: 'GyroZ_dps' },
    MAG_X:       { index: 11, header: 'MagX_uT' },
    MAG_Y:       { index: 12, header: 'MagY_uT' },
    MAG_Z:       { index: 13, header: 'MagZ_uT' },
    PRESSURE:    { index: 14, header: 'Pressure_Pa' },
    TEMPERATURE: { index: 15, header: 'Temp_C' },
    GPS_ALT:     { index: 19, header: 'GPS_Alt_m' },
    ACCEL_X:     { index: 22, header: 'AccelX_G' },
    ACCEL_Y:     { index: 23, header: 'AccelY_G' },
    POS_X:       { index: 24, header: 'PosX_m' },
    POS_Y:       { index: 25, header: 'PosY_m' },
    POS_Z:       { index: 26, header: 'PosZ_m' },
    GPS_LAT:     { index: 27, header: 'GPS_Lat' },
    GPS_LON:     { index: 28, header: 'GPS_Lon' },
    IMU_ACCEL_X: { index: 29, header: 'IMU_AccelX_G' },
    IMU_ACCEL_Y: { index: 30, header: 'IMU_AccelY_G' },
    IMU_ACCEL_Z: { index: 31, header: 'IMU_AccelZ_G' },
};

// --- 2. HOOK ---
export const useFlightData = () => {
    // State for the "Live" dashboard numbers (Gauge/Text)
    const [currentPacket, setCurrentPacket] = useState<FlightDataPoint | null>(null);

    // Refs for history (Charts) to avoid re-rendering loop issues
    // We map the new fields to specific indices for uPlot
    /*
       INDEX MAPPING:
       0: Time         11: Mag X       22: Accel X
       1: Altitude     12: Mag Y       23: Accel Y
       2: Velocity     13: Mag Z       24: Pos X
       3: Accel Z      14: Pressure    25: Pos Y
       4: Airbrake     15: Temp        26: Pos Z
       5: Mach         16: Diff Press  27: GPS Lat
       6: Airspeed     17: Drogue Cont 28: GPS Lon
       7: Tilt         18: Main Cont
       8: Gyro X       19: GPS Alt
       9: Gyro Y       20: Sats
       10: Gyro Z      21: Fix
    */
    const plotDataRef = useRef<number[][]>(
        Array.from({ length: 35 }, () => [])
    );

    // State for the Charts (Updated less frequently if needed)
    const [plotData, setPlotData] = useState<uPlot.AlignedData>(plotDataRef.current as unknown as uPlot.AlignedData);

    // Trajectory for 3D Map [lat, alt, lon]
    const trajectoryRef = useRef<[number, number, number][]>([]);
    const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);

    // --- ADD DATA FUNCTION ---
    const addData = useCallback((
        t: number,
        alt: number,
        vel: number,
        acc: number,
        lat: number,
        lon: number,
        state: number,
        extra: Partial<FlightDataPoint> = {}
    ) => {
        // 1. Update Current Packet (Live UI)
        const point: FlightDataPoint = {
            timestamp: t,
            altitude: alt,
            velocity: vel,
            accel_z: acc,
            lat,
            lon,
            state,
            ...extra
        };
        setCurrentPacket(point);

        // 2. Update Plot History (Charts)
        const p = plotDataRef.current;
        p[0].push(t);
        p[1].push(alt);
        p[2].push(vel);
        p[3].push(acc);
        
        // Extended Fields (Default to 0 if missing)
        p[4].push(extra.airbrake_extension ?? 0);
        p[5].push(extra.mach_number ?? 0);
        p[6].push(extra.airspeed_tas ?? 0);
        p[7].push(extra.tilt_angle ?? 0);
        p[8].push(extra.gx ?? 0);
        p[9].push(extra.gy ?? 0);
        p[10].push(extra.gz ?? 0);
        p[11].push(extra.mx ?? 0);
        p[12].push(extra.my ?? 0);
        p[13].push(extra.mz ?? 0);
        p[14].push(extra.pressure ?? 0);
        p[15].push(extra.temp ?? 0);
        p[16].push(extra.diff_pressure ?? 0);
        p[17].push(extra.drogue_continuity ?? 0);
        p[18].push(extra.main_continuity ?? 0);
        p[19].push(extra.gps_alt ?? 0);
        p[20].push(extra.sats ?? 0);
        p[21].push(extra.fix ?? 0);
        // New extended indices
        p[22].push(extra.ax ?? 0);   // Accel X
        p[23].push(extra.ay ?? 0);   // Accel Y
        p[24].push(0);               // Pos X (placeholder)
        p[25].push(0);               // Pos Y (placeholder)
        p[26].push(0);               // Pos Z (placeholder)
        p[27].push(lat);             // GPS Lat
        p[28].push(lon);             // GPS Lon
        p[29].push(extra.imu_ax ?? 0); // IMU Accel X
        p[30].push(extra.imu_ay ?? 0); // IMU Accel Y
        p[31].push(extra.imu_az ?? 0); // IMU Accel Z
        p[32].push(0);
        p[33].push(0);
        p[34].push(0);

        // Trigger Chart Update
        setPlotData([...p] as unknown as uPlot.AlignedData);

        // 3. Update Trajectory (3D Map)
        // Filter out (0,0), NaN, and out-of-range coordinates
        const isValidCoord = Math.abs(lat) > 0.1 && Math.abs(lon) > 0.1
            && !isNaN(lat) && !isNaN(lon)
            && lat >= -90 && lat <= 90
            && lon >= -180 && lon <= 180;
        if (isValidCoord) {
            trajectoryRef.current.push([lat, lon, alt]);
            
            // Optimization: Update map state every 5th packet to save React cycles
            if (trajectoryRef.current.length % 5 === 0) {
                setTrajectory([...trajectoryRef.current]);
            }
        }
    }, []);

    // --- RESET FUNCTION ---
    const resetData = useCallback(() => {
        // Clear all arrays
        plotDataRef.current = Array.from({ length: 35 }, () => []);
        trajectoryRef.current = [];
        
        // Reset States
        setPlotData(plotDataRef.current as unknown as uPlot.AlignedData);
        setTrajectory([]);
        setCurrentPacket(null);
    }, []);

    // --- DOWNLOAD CSV ---
    const downloadLog = useCallback((activeParamTypes?: string[]) => {
        if (plotDataRef.current[0].length === 0) return alert("No data to download.");

        let headers: string[];
        let columnIndices: number[];

        if (activeParamTypes && activeParamTypes.length > 0) {
            // Only include Time + active parameters
            headers = ['Time_s'];
            columnIndices = [0];
            for (const paramType of activeParamTypes) {
                const mapping = PARAM_COLUMN_MAP[paramType];
                if (mapping) {
                    headers.push(mapping.header);
                    columnIndices.push(mapping.index);
                }
            }
        } else {
            // Fallback: all 29 columns
            headers = [
                "Time_s", "Altitude_m", "Velocity_ms", "AccelZ_G",
                "Airbrake_pct", "Mach", "Airspeed_TAS", "Tilt_deg",
                "GyroX_dps", "GyroY_dps", "GyroZ_dps",
                "MagX_uT", "MagY_uT", "MagZ_uT",
                "Pressure_Pa", "Temp_C", "DiffPress_Pa",
                "Drogue_Cont", "Main_Cont", "GPS_Alt_m",
                "Sats", "GPS_Fix", "AccelX_G", "AccelY_G",
                "PosX_m", "PosY_m", "PosZ_m", "GPS_Lat", "GPS_Lon"
            ];
            columnIndices = headers.map((_, i) => i);
        }

        const rows = plotDataRef.current[0].map((_, i) => 
            columnIndices.map(colIdx => plotDataRef.current[colIdx]?.[i] ?? 0).join(",")
        );

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `flight_log_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    return {
        currentPacket,
        plotData,
        trajectory,
        addData,
        resetData,
        downloadLog
    };
};