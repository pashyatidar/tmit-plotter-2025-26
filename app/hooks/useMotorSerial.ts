import { useState, useCallback, useRef } from 'react';
import { parseMotorSerialLine, MotorUpdate } from '../utils/motorParser';

export const useMotorSerial = (onUpdate: (update: MotorUpdate) => void) => {
    const [isConnected, setIsConnected] = useState(false);
    
    // Use ref to avoid stale closure in readLoop
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const portRef = useRef<any>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
    const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
    const readableClosedRef = useRef<Promise<void> | null>(null);
    const writableClosedRef = useRef<Promise<void> | null>(null);
    const keepReading = useRef(false);

    const connect = useCallback(async () => {
        const nav = navigator as any;
        if (!nav.serial) return alert("Web Serial API not supported.");

        try {
            const port = await nav.serial.requestPort();
            await port.open({ baudRate: 115200 }); 
            
            portRef.current = port;
            keepReading.current = true;

            // 1. Setup Reader (Incoming Data)
            const textDecoder = new TextDecoderStream();
            readableClosedRef.current = port.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            readerRef.current = reader;

            // 2. Setup Writer (Outgoing Commands)
            const textEncoder = new TextEncoderStream();
            writableClosedRef.current = textEncoder.readable.pipeTo(port.writable);
            const writer = textEncoder.writable.getWriter();
            writerRef.current = writer;

            setIsConnected(true);
            
            // Start read loop (uses ref for callback)
            readLoop(reader);

        } catch (err) {
            console.error("Connection Failed:", err);
            setIsConnected(false);
        }
    }, []);

    const sendCommand = useCallback(async (cmd: string) => {
        if (!writerRef.current) return;
        try {
            await writerRef.current.write(cmd + "\r\n");
            console.log("Sent:", cmd);
        } catch (err) {
            console.error("Write Error:", err);
        }
    }, []);

    const readLoop = async (reader: ReadableStreamDefaultReader<string>) => {
        let buffer = "";
        try {
            while (keepReading.current) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += value;
                const lines = buffer.split('\n');
                
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    // Parse the line for structured data
                    const parsed = parseMotorSerialLine(line);
                    if (parsed) {
                        // Single callback with parsed data (includes .raw for console)
                        onUpdateRef.current(parsed);
                    } else {
                        // Non-data lines: send as raw log only
                        onUpdateRef.current({ type: 'ALERT', raw: line });
                    }
                }
                buffer = lines[lines.length - 1];
            }
        } catch (e) {
            console.error(e);
        } finally {
            reader.releaseLock();
        }
    };

    const disconnect = useCallback(async () => {
        keepReading.current = false;
        
        try {
            if (readerRef.current) {
                await readerRef.current.cancel();
                readerRef.current = null;
            }
            if (writerRef.current) {
                await writerRef.current.close();
                writerRef.current = null;
            }
            // Wait for streams to fully close before closing the port
            if (readableClosedRef.current) {
                await readableClosedRef.current.catch(() => {});
                readableClosedRef.current = null;
            }
            if (writableClosedRef.current) {
                await writableClosedRef.current.catch(() => {});
                writableClosedRef.current = null;
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
    }, []);

    return { isConnected, connect, disconnect, sendCommand };
};