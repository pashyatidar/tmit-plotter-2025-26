import { useState, useRef } from 'react';

export interface GPSPosition {
    time: number;
    lat: number;
    lon: number;
    sats: number;
    rssi: number;
    snr: number;
    hasFix: boolean;
    isLora: boolean;
}

export function useGPSSerial() {
    const [isConnected, setIsConnected] = useState(false);
    const [currentPos, setCurrentPos] = useState<GPSPosition>({ time: 0, lat: 0, lon: 0, sats: 0, rssi: 0, snr: 0, hasFix: false, isLora: false });
    
    const trajectoryRef = useRef<[number, number, number][]>([]);
    const [trajectory, setTrajectory] = useState<[number, number, number][]>([]);
    const logRef = useRef<string[]>(["Timestamp_ms,Lat,Lon,Sats,RSSI,SNR,Fix"]);
    
    const portRef = useRef<any>(null);
    const readerRef = useRef<any>(null);
    const streamClosedRef = useRef<Promise<void> | null>(null);

    const connect = async (unit: 'ms' | 'us' | 's') => {
        try {
            trajectoryRef.current = [];
            setTrajectory([]);
            logRef.current = ["Timestamp_ms,Lat,Lon,Sats,RSSI,SNR,Fix"];
            setCurrentPos({ time: 0, lat: 0, lon: 0, sats: 0, rssi: 0, snr: 0, hasFix: false, isLora: false });

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
                    lines.forEach((line) => processLine(line, unit));
                }
            } catch (error) {
                // stream closed explicitly
            } finally {
                reader.releaseLock();
            }
        } catch (err) {
            console.error("Serial Connection Failed:", err);
            setIsConnected(false);
        }
    };

    const processLine = (line: string, unit: 'ms' | 'us' | 's') => {
        const clean = line.trim();
        if (!clean || !clean.includes(',')) return;

        console.log("RAW SERIAL IN:", clean);

        let time: number;
        let lat = NaN;
        let lon = NaN;
        let sats = 0;
        let rssi = NaN;
        let snr = NaN;
        let hasFix = false;
        let isLora = false;

        try {
            if (clean.includes('+RCV=')) {
                isLora = true;
                const parts = clean.split('+RCV=')[1].split(',');
                time = parseFloat(parts[2]);
                if (parts[3] === 'no_fix') {
                    hasFix = false;
                    rssi = parseFloat(parts[4]);
                    snr = parseFloat(parts[5]);
                } else {
                    hasFix = true;
                    lat = parseFloat(parts[3]);
                    lon = parseFloat(parts[4]);
                    sats = parseInt(parts[5], 10);
                    rssi = parseFloat(parts[6]);
                    snr = parseFloat(parts[7]);
                }
            } else if (clean.includes('AT+SEND=')) {
                isLora = true;
                const parts = clean.split('AT+SEND=')[1].split(',');
                time = parseFloat(parts[2]);
                if (parts[3] === 'no_fix') {
                    hasFix = false;
                } else {
                    hasFix = true;
                    lat = parseFloat(parts[3]);
                    lon = parseFloat(parts[4]);
                    sats = parseInt(parts[5], 10);
                }
            } else {
                const parts = clean.split(',');
                time = parseFloat(parts[0]);
                if (parts[1] === 'no_fix') {
                    hasFix = false;
                } else {
                    hasFix = true;
                    lat = parseFloat(parts[1]);
                    lon = parseFloat(parts[2]);
                    sats = parseInt(parts[3] || '0', 10);
                }
            }

            if (time !== undefined && !isNaN(time)) {
                let timeMs = time;
                if (unit === 's') timeMs = time * 1000;
                else if (unit === 'us') timeMs = Math.round(time / 1000);

                setCurrentPos({ time: timeMs, lat: isNaN(lat)?0:lat, lon: isNaN(lon)?0:lon, sats: isNaN(sats)?0:sats, rssi, snr, hasFix, isLora });

                if (hasFix && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                    trajectoryRef.current.push([lat, lon, 0]); 
                    if (trajectoryRef.current.length % 3 === 0) {
                        setTrajectory([...trajectoryRef.current]);
                    }
                }

                const strLat = isNaN(lat) ? "NaN" : lat.toFixed(7);
                const strLon = isNaN(lon) ? "NaN" : lon.toFixed(7);
                const strRssi = isNaN(rssi) ? "" : rssi.toString();
                const strSnr = isNaN(snr) ? "" : snr.toString();

                logRef.current.push(`${timeMs},${strLat},${strLon},${sats},${strRssi},${strSnr},${hasFix?1:0}`);
            }

        } catch (e) {
            // structure error
        }
    };

    const disconnect = async () => {
        if (readerRef.current) {
            await readerRef.current.cancel();
            readerRef.current = null;
        }
        if (streamClosedRef.current) {
            await streamClosedRef.current.catch(() => {});
        }
        if (portRef.current) {
            await portRef.current.close();
            portRef.current = null;
        }
        setIsConnected(false);
    };

    const downloadLog = () => {
        if (logRef.current.length <= 1) return;
        const blob = new Blob([logRef.current.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `GPS_LOG_${new Date().getTime()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return {
        isConnected,
        currentPos,
        trajectory,
        hasLogs: logRef.current.length > 1,
        connect,
        disconnect,
        downloadLog
    };
}
