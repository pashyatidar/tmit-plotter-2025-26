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

            // Timestamp is ALWAYS the first CSV value (parts[0])
            let t = parseFloat(parts[0]);
            if (isNaN(t)) return;
            if (timestampUnitRef.current === 'ms') t /= 1000;

            // Map remaining values per sequence (sequence[i] → parts[i+1])
            const values: Partial<Record<ParameterType, number>> = {};
            sequence.forEach((item, idx) => {
                if (item.type && item.type !== 'IGNORE') {
                    const val = parseFloat(parts[idx + 1]);
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
            await port.open({ baudRate: 115200 }); 
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
                await streamClosedRef.current.catch(() => {});
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