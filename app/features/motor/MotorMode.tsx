"use client";
import { useState, useRef, useCallback } from 'react';
import Header from '../../components/Header';
import GraphGrid from '../../components/GraphGrid'; 
import { useMotorSerial } from '../../hooks/useMotorSerial'; 
import { MotorUpdate } from '../../utils/motorParser';    
import MotorConsole from './MotorConsole'; 
import { Play, Square, Link, Terminal, Download } from 'lucide-react';
import uPlot from 'uplot';

interface Props {
    isDark: boolean;
    toggleTheme: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function MotorMode({ isDark, toggleTheme, activeTab, onTabChange }: Props) {
    const [motorData, setMotorData] = useState<uPlot.AlignedData>([[], [], [], [], []]); 
    const startTimeRef = useRef<number | null>(null);
    const [lastLog, setLastLog] = useState<string>("Ready to Connect");
    
    // --- CONSOLE STATE ---
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

    // --- SERIAL HOOK ---
    const { isConnected, connect, disconnect, sendCommand } = useMotorSerial((update: MotorUpdate) => {
        
        if (update.type === 'DATA' && update.timestamp) {
             if (startTimeRef.current === null) startTimeRef.current = update.timestamp;
             const relTime = (update.timestamp - startTimeRef.current) / 1000;
             
             setMotorData(prev => {
                const data = prev as number[][];
                return [
                    data[0].concat(relTime),
                    data[1].concat(update.thrust || 0),   // A0 (Volts)
                    data[2].concat(update.pressure || 0), // A1 (Volts)
                    data[3].concat(update.voltage || 0),  // A2 (Volts)
                    data[4].concat(update.valve || 0)     // A3 (Volts)
                ] as unknown as uPlot.AlignedData;
             });
        }

        if (update.raw) {
            setLastLog(update.raw);
            setConsoleLogs(prev => [...prev.slice(-49), `[RX] ${update.raw}`]);
        }
    });

    const handleSendCommand = (cmd: string) => {
        setConsoleLogs(prev => [...prev.slice(-49), `[TX] ${cmd}`]);
        sendCommand(cmd);
    };

    const handleDisconnect = () => {
        disconnect();
        startTimeRef.current = null;
    };

    // --- CSV DOWNLOAD ---
    const downloadCSV = useCallback(() => {
        const data = motorData as number[][];
        if (!data[0] || data[0].length === 0) return alert("No data to download.");

        const headers = ["Time_s", "A0_V", "A1_V", "A2_V", "A3_V"];
        const rows = data[0].map((_, i) =>
            data.map(col => (col[i] ?? 0).toFixed(4)).join(",")
        );

        const csvContent = headers.join(",") + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `motor_test_${new Date().toISOString()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, [motorData]);

    // --- UPDATED GRAPHS WITH VOLTAGE UNITS ---
    const motorGraphs = [
        { 
            id: 'ch_a0', 
            title: 'CHANNEL A0', 
            type: 'chart' as const, 
            series: [{ label: 'Voltage', stroke: '#ef4444', unit: 'V', idx: 1 }], 
            dataIdx: [1] 
        },
        { 
            id: 'ch_a1', 
            title: 'CHANNEL A1', 
            type: 'chart' as const, 
            series: [{ label: 'Voltage', stroke: '#3b82f6', unit: 'V', idx: 2 }], 
            dataIdx: [2] 
        },
        { 
            id: 'ch_a2', 
            title: 'CHANNEL A2', 
            type: 'chart' as const, 
            series: [{ label: 'Voltage', stroke: '#10b981', unit: 'V', idx: 3 }], 
            dataIdx: [3] 
        },
        { 
            id: 'ch_a3', 
            title: 'CHANNEL A3', 
            type: 'chart' as const, 
            series: [{ label: 'Voltage', stroke: '#f59e0b', unit: 'V', idx: 4 }], 
            dataIdx: [4] 
        }
    ];

    const HeaderActions = (
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsConsoleOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-bold border border-slate-300 dark:border-slate-700 transition-colors shadow-sm dark:shadow-none"
            >
                <Terminal size={14} /> COMMANDS
            </button>

            {(motorData as number[][])[0].length > 0 && (
                <button
                    onClick={downloadCSV}
                    className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] font-bold uppercase transition-colors shadow-sm dark:shadow-none"
                >
                    <Download size={12} /> CSV
                </button>
            )}

            <button 
                onClick={isConnected ? handleDisconnect : connect}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all text-white shadow-sm dark:shadow-none ${isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
                {isConnected ? <Square size={14} fill="white" /> : <Link size={14} fill="white" />}
                {isConnected ? "DISCONNECT" : "CONNECT"}
            </button>
        </div>
    );

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-black relative overflow-hidden">
            <Header actions={HeaderActions} isDark={isDark} toggleTheme={toggleTheme} activeTab={activeTab} onTabChange={onTabChange} />
            
            <div className="flex-1 p-4 overflow-hidden flex flex-col gap-2">
                <GraphGrid data={motorData} isDark={isDark} customConfigs={motorGraphs} />
                
                <div className="h-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center px-4 transition-colors">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mr-2">LAST MSG:</span>
                    <span className="text-xs font-mono text-green-600 dark:text-green-400">{lastLog}</span>
                </div>
            </div>

            <MotorConsole 
                isOpen={isConsoleOpen} 
                onClose={() => setIsConsoleOpen(false)} 
                sendCommand={handleSendCommand}
                logs={consoleLogs}
            />
        </div>
    );
}