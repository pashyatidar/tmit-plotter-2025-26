/**
 * js/mock-device.js
 * Simulates a Web Serial Port for testing without hardware.
 * Generates synthetic data for Motor Test, Hydrostatic Test, and Rocket Flight modes.
 */

export class MockSerialPort {
    constructor(mode) {
        this.mode = mode;
        this.readable = new ReadableStream({
            start: (controller) => {
                this.controller = controller;
                this.active = true;
                this.startTime = Date.now();
                this.simulateData();
            },
            cancel: () => {
                this.active = false;
            }
        });
        
        this.writable = new WritableStream({
            write: (chunk) => {
                // Log commands sent to the mock device
                const cmd = new TextDecoder().decode(chunk).trim();
                console.log(`[Mock Device] Received command: ${cmd}`);
                
                // Handle Motor Test State Changes internally within the mock
                if (this.mode === 'motorTest') {
                    if (cmd.includes('ARM')) this.motorState = 'ARMED';
                    if (cmd.includes('DISARM')) this.motorState = 'SAFE';
                    if (cmd.includes('LAUNCH')) this.motorState = 'LAUNCHED';
                }
            }
        });
        
        // Internal State for Motor Test simulation
        this.motorState = 'BOOT';
        this.motorSequence = ['BOOT', 'BOOT', 'SAFE', 'SAFE']; // Initial startup sequence
    }

    open(options) { return Promise.resolve(); }
    close() { this.active = false; return Promise.resolve(); }
    getInfo() { return { usbVendorId: 0, usbProductId: 0 }; }

    simulateData() {
        const encoder = new TextEncoder();
        
        const sendLine = (line) => {
            if (this.controller && this.active) {
                this.controller.enqueue(encoder.encode(line + '\n'));
            }
        };

        const loop = setInterval(() => {
            if (!this.active) {
                clearInterval(loop);
                return;
            }

            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000;
            const t_ms = now - this.startTime; // timestamp in ms

            if (this.mode === 'rocketFlight') {
                // Rocket Flight Simulation
                // Default Order: GPS, Pres, Acc, Gyro
                const lat = 13.345076 + (elapsed * 0.0001);
                const lon = 74.794646 + (elapsed * 0.0001);
                const pres = 1013 - (elapsed * 2);
                const ax = Math.sin(elapsed);
                const ay = Math.cos(elapsed);
                const az = 9.8 + (Math.random() - 0.5);
                const gx = Math.random() * 0.2;
                const gy = Math.random() * 0.2;
                const gz = elapsed * 0.1;
                
                // Format: timestamp,lat,lon,pres,ax,ay,az,gx,gy,gz
                sendLine(`${t_ms},${lat.toFixed(6)},${lon.toFixed(6)},${pres.toFixed(2)},${ax.toFixed(2)},${ay.toFixed(2)},${az.toFixed(2)},${gx.toFixed(2)},${gy.toFixed(2)},${gz.toFixed(2)}`);

            } else if (this.mode === 'hydrostaticTest') {
                // Hydrostatic Simulation
                const val1 = 50 + 25 * Math.sin(elapsed);
                const val2 = 20 + 5 * Math.cos(elapsed);
                const val3 = 100 + (Math.random() * 10);
                
                // Format: timestamp,val1,val2,val3
                sendLine(`${t_ms},${val1.toFixed(2)},${val2.toFixed(2)},${val3.toFixed(2)}`);

            } else if (this.mode === 'motorTest') {
                // Motor Test Simulation (Complex FSM)
                let payload = "";
                
                // 1. Startup Sequence handling
                if (this.motorSequence.length > 0) {
                    this.motorState = this.motorSequence.shift();
                }

                // 2. Generate Message based on State
                if (['BOOT', 'SAFE', 'ARMED'].includes(this.motorState)) {
                    // Protocol: +RCV=ID,LEN,STATE,-10,0
                    payload = this.motorState;
                    sendLine(`+RCV=00,${payload.length},${payload},-10,0`);
                } else if (this.motorState === 'LAUNCHED') {
                    // Simulate Thrust Data
                    let thrust = 0;
                    if (elapsed < 5) thrust = 1500; // Boost
                    else thrust = Math.max(0, 1500 - ((elapsed-5)*100)); // Coast
                    
                    const pressure = 1013 - (elapsed * 5);
                    const dataStr = `${t_ms},${thrust.toFixed(2)},${pressure.toFixed(2)}`;
                    
                    // Protocol: +RCV=ID,LEN,DATA,-20,0
                    sendLine(`+RCV=42,${dataStr.length},${dataStr},-20,0`);
                }
            }
        }, 100); // 10Hz update rate
    }
}