"use client";
import { useState, useRef, useCallback } from 'react';
import { ParameterType } from '../utils/parameters';

export type SequenceItem = { type: ParameterType | '', unit: string };

export const useSerial = (onData: (...args: any[]) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const portRef = useRef<any>(null);
    const readerRef = useRef<any>(null);
    const streamClosedRef = useRef<Promise<void> | null>(null);

    // Use refs to avoid stale closures in the serial read loop
    const onDataRef = useRef(onData);
    onDataRef.current = onData;

    const sequenceRef = useRef<SequenceItem[]>([]);
    const timestampUnitRef = useRef<'ms' | 's'>('ms');

    const processLine = useCallback((line: string) => {
        const clean = line.trim();
        if (!clean || !clean.includes(',')) return;

        try {
            const parts = clean.split(',');
            const sequence = sequenceRef.current;

            if (sequence.length === 0) return;

            let dataOffset = 0;
            let address, length, rssi, snr;
            let isLora = false;

            if (parts[0].startsWith('+RCV=')) {
                isLora = true;
                address = parts[0].replace('+RCV=', '');
                length = parts[1];
                snr = parts[parts.length - 1];
                rssi = parts[parts.length - 2];
                dataOffset = 2;
            }

            // Timestamp is ALWAYS the first CSV value in the actual sequence
            let t = parseFloat(parts[dataOffset]);
            if (isNaN(t)) return;
            if (timestampUnitRef.current === 'ms') t /= 1000;

            // Map remaining values per sequence (sequence[i] → parts[dataOffset + i + 1])
            const values: Partial<Record<ParameterType, number>> = {};
            sequence.forEach((item, idx) => {
                if (item.type && item.type !== 'IGNORE') {
                    const val = parseFloat(parts[dataOffset + idx + 1]);
                    if (!isNaN(val)) {
                        values[item.type as ParameterType] = val;
                    }
                }
            });

            // Extract positional args for addData(t, alt, vel, acc, lat, lon, state, extra)
            const alt = values['ALTITUDE'] ?? 0;
            const vel = values['VELOCITY'] ?? values['VEL_NET'] ?? 0;
            const acc = values['ACCEL_Z'] ?? values['ACCEL_NET'] ?? 0;
            const lat = values['GPS_LAT'] ?? 0;
            const lon = values['GPS_LON'] ?? 0;
            const state = values['STATE'] ?? 0;

            // Build extra object for all additional sensor data
            const extra: Record<string, number> = {};
            if (values['PRESSURE'] !== undefined) extra.pressure = values['PRESSURE'];
            if (values['TEMPERATURE'] !== undefined) extra.temp = values['TEMPERATURE'];
            if (values['ACCEL_X'] !== undefined) extra.ax = values['ACCEL_X'];
            if (values['ACCEL_Y'] !== undefined) extra.ay = values['ACCEL_Y'];
            if (values['ACCEL_Z'] !== undefined) extra.az = values['ACCEL_Z'];
            if (values['GYRO_X'] !== undefined) extra.gx = values['GYRO_X'];
            if (values['GYRO_Y'] !== undefined) extra.gy = values['GYRO_Y'];
            if (values['GYRO_Z'] !== undefined) extra.gz = values['GYRO_Z'];
            if (values['MAG_X'] !== undefined) extra.mx = values['MAG_X'];
            if (values['MAG_Y'] !== undefined) extra.my = values['MAG_Y'];
            if (values['MAG_Z'] !== undefined) extra.mz = values['MAG_Z'];
            if (values['GPS_ALT'] !== undefined) extra.gps_alt = values['GPS_ALT'];
            if (values['THRUST'] !== undefined) extra.thrust = values['THRUST'];

            // New mappings
            if (values['BITMASK'] !== undefined) extra.bitmask = values['BITMASK'];
            if (values['GPS_FIX'] !== undefined) extra.fix = values['GPS_FIX'];
            if (values['IMU_ACCEL_X'] !== undefined) extra.imu_ax = values['IMU_ACCEL_X'];
            if (values['IMU_ACCEL_Y'] !== undefined) extra.imu_ay = values['IMU_ACCEL_Y'];
            if (values['IMU_ACCEL_Z'] !== undefined) extra.imu_az = values['IMU_ACCEL_Z'];

            if (isLora) {
                if (address !== undefined) extra.address = parseInt(address, 10);
                if (length !== undefined) extra.length = parseInt(length, 10);
                if (rssi !== undefined) extra.rssi = parseFloat(rssi);
                if (snr !== undefined) extra.snr = parseFloat(snr);
            }

            onDataRef.current(t, alt, vel, acc, lat, lon, state, extra);
        } catch (e) {
            // Silently ignore broken serial lines
        }
    }, []);

    const connect = async (sequence: SequenceItem[] = [], timestampUnit: 'ms' | 's' = 'ms') => {
        sequenceRef.current = sequence;
        timestampUnitRef.current = timestampUnit;

        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 9600 });
            portRef.current = port;
            setIsConnected(true);

            const decoder = new TextDecoderStream();
            streamClosedRef.current = port.readable.pipeTo(decoder.writable);
            const reader = decoder.readable.getReader();
            readerRef.current = reader;

            let buffer = "";
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += value;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || "";
                    lines.forEach(processLine);
                }
            } catch (error) {
                // Catch disconnects
            } finally {
                reader.releaseLock();
            }
        } catch (err) {
            console.error("Serial Connection Failed:", err);
            setIsConnected(false);
        }
    };

    const disconnect = async () => {
        try {
            if (readerRef.current) {
                await readerRef.current.cancel();
                readerRef.current = null;
            }
            if (streamClosedRef.current) {
                await streamClosedRef.current.catch(() => { });
                streamClosedRef.current = null;
            }
            if (portRef.current) {
                await portRef.current.close();
                portRef.current = null;
            }
        } catch (err) {
            console.error("Disconnect Error:", err);
        } finally {
            setIsConnected(false);
        }
    };

    return { isConnected, connect, disconnect };
};