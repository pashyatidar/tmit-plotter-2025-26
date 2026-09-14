import { useState, useCallback, useRef } from 'react';
import { parseMotorTelemetry, MotorTelemetry } from '../utils/motorParser';

export interface LogEntry {
  type: 'RX' | 'TX' | 'SYS';
  message: string;
  timestamp: number;
}

export const useMotorSerial = (onUpdate: (update: MotorTelemetry) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const portRef = useRef<any>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
    
    const outputStreamRef = useRef<WritableStream<string> | null>(null);
    const outputDoneRef = useRef<Promise<void> | null>(null);
    const inputDoneRef = useRef<Promise<void> | null>(null);
    const keepReading = useRef(false);
    const awaitingConvertRef = useRef(false);
    const lastTelemetryRef = useRef<MotorTelemetry | null>(null);

    const addLog = useCallback((type: 'RX' | 'TX' | 'SYS', message: string) => {
        setLogs(prev => [...prev.slice(-99), { type, message, timestamp: Date.now() }]);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    const readLoop = async (reader: ReadableStreamDefaultReader<string>) => {
        let buffer = "";
        try {
            while (keepReading.current) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    buffer += value;
                    // Split strictly by newline so incomplete fragments stay in the buffer
                    const lines = buffer.split('\n');
                    // The last item is either empty (if line ended with \n) or the incomplete fragment
                    buffer = lines.pop() || "";
                    
                    for (const line of lines) {
                        const clean = line.replace(/[\r\n]+/g, '').trim();
                        if (clean) {
                            addLog('RX', clean);
                            
                            const upper = clean.toUpperCase();

                            // Check for convert confirmation from hardware
                            const isConvertAck = 
                                (awaitingConvertRef.current && (
                                    upper.includes('OK') || 
                                    upper.includes('ACK') || 
                                    upper.includes('DONE') || 
                                    upper.includes('COMPLETE') || 
                                    upper.includes('BOOT') ||
                                    upper.includes('SUCCESS') ||
                                    upper === 'CONVERT'
                                )) ||
                                upper.includes('CONVERT_OK') ||
                                upper.includes('CONVERT_CONFIRM') ||
                                upper.includes('CONVERT COMPLETE') ||
                                upper.includes('CONVERT DONE');

                            if (isConvertAck) {
                                awaitingConvertRef.current = false;
                                addLog('SYS', 'CONVERT confirmed by testbed. State visibility reset to BOOT.');
                                const base = lastTelemetryRef.current;
                                onUpdateRef.current({
                                    timestamp: Date.now(),
                                    raw: clean,
                                    state: 'BOOT',
                                    rpt: base?.rpt ?? 14.7,
                                    ipt: base?.ipt ?? 14.7,
                                    ppt: base?.ppt ?? 14.7,
                                    mass: base?.mass ?? 0,
                                    thrust: 0,
                                    valves: base?.valves ?? {
                                        fillAngle: 0,
                                        fillOpen: false,
                                        svAngle: 0,
                                        svOpen: false,
                                        ventOpen: false,
                                        oxAngle: 0,
                                        oxOpen: false,
                                        igniterActive: false
                                    }
                                });
                            }

                            const parsed = parseMotorTelemetry(clean);
                            if (parsed) {
                                // If incoming telemetry state is CONVERT, transition visibility to BOOT
                                if (parsed.state === 'CONVERT') {
                                    awaitingConvertRef.current = false;
                                    parsed.state = 'BOOT';
                                    addLog('SYS', 'CONVERT telemetry received. State visibility reset to BOOT.');
                                }
                                lastTelemetryRef.current = parsed;
                                onUpdateRef.current(parsed);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            addLog('SYS', `Read Loop Error: ${e}`);
        } finally {
            reader.releaseLock();
        }
    };

    const connect = useCallback(async () => {
        const nav = navigator as any;
        if (!nav.serial) {
            addLog('SYS', "Web Serial API not supported in this browser.");
            return alert("Web Serial API not supported.");
        }

        try {
            const port = await nav.serial.requestPort();
            await port.open({ baudRate: 9600 }); 
            
            portRef.current = port;
            keepReading.current = true;

            const encoder = new TextEncoderStream();
            outputDoneRef.current = encoder.readable.pipeTo(port.writable);
            outputStreamRef.current = encoder.writable;

            const decoder = new TextDecoderStream();
            inputDoneRef.current = port.readable.pipeTo(decoder.writable);
            const reader = decoder.readable.getReader();
            readerRef.current = reader;

            setIsConnected(true);
            addLog('SYS', "Connected to Hardware via Web Serial (9600 baud).");
            
            readLoop(reader);

        } catch (err) {
            console.error("Connection Failed:", err);
            addLog('SYS', `Connection Failed: ${err}`);
            setIsConnected(false);
        }
    }, [addLog]);

    const sendCommand = useCallback(async (cmd: string) => {
        const trimmed = cmd.trim();
        addLog('TX', trimmed);
        
        if (trimmed.toUpperCase() === 'CONVERT') {
            awaitingConvertRef.current = true;
            addLog('SYS', 'CONVERT command sent. Awaiting confirmation from testbed...');
        }
        
        if (!portRef.current || !outputStreamRef.current) {
            addLog('SYS', `Cannot send '${cmd}'. Not connected.`);
            return;
        }

        try {
            const writer = outputStreamRef.current.getWriter();
            await writer.write(cmd + "\n");
            writer.releaseLock();
        } catch (err) {
            addLog('SYS', `Write Error: ${err}`);
            console.error("Write Error:", err);
        }
    }, [addLog]);

    const disconnect = useCallback(async () => {
        keepReading.current = false;
        
        try {
            if (readerRef.current) {
                await readerRef.current.cancel();
                readerRef.current = null;
            }
            if (inputDoneRef.current) {
                await inputDoneRef.current.catch(() => {});
                inputDoneRef.current = null;
            }
            if (outputStreamRef.current) {
                const writer = outputStreamRef.current.getWriter();
                await writer.close();
                outputStreamRef.current = null;
            }
            if (outputDoneRef.current) {
                await outputDoneRef.current.catch(() => {});
                outputDoneRef.current = null;
            }
            if (portRef.current) {
                await portRef.current.close();
                portRef.current = null;
            }
        } catch (err) {
            console.error("Disconnect Error:", err);
            addLog('SYS', `Disconnect Error: ${err}`);
        } finally {
            setIsConnected(false);
            addLog('SYS', "Disconnected from Hardware.");
        }
    }, [addLog]);

    return { 
        isConnected, 
        connect, 
        disconnect, 
        sendCommand, 
        logs,
        clearLogs 
    };
};