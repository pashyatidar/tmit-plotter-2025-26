"use client";
import { useState, useRef, useMemo, useEffect } from 'react';
import Header from '../../components/Header';
import { useMotorSerial } from '../../hooks/useMotorSerial';
import { MotorTelemetry, MOTOR_COMMANDS, MotorFSMState } from '../../utils/motorParser';
import UPlotChart from '../../components/UPlotChart';
import uPlot from 'uplot';
import { Link, Square, Download, Terminal, Flame, ShieldAlert, Rocket, Database, AlertOctagon, PowerOff, Zap, Shield, Maximize, Settings, Disc, Droplet, Wind } from 'lucide-react';

interface Props {
    isDark: boolean;
    toggleTheme: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

// --- HOLD TO LAUNCH COMPONENT ---
const HoldToLaunchButton = ({ onLaunch }: { onLaunch: () => void }) => {
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasLaunchedRef = useRef(false);

    const startHold = (e: React.MouseEvent | React.TouchEvent) => {
        // Only respond to left clicks for mouse events
        if ('button' in e && e.button !== 0) return;
        
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        hasLaunchedRef.current = false;
        setIsHolding(true);
        setProgress(0);
        
        const startTime = Date.now();
        
        holdIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percent = Math.min((elapsed / 3000) * 100, 100);
            setProgress(percent);
            
            if (percent >= 100) {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                setIsHolding(false);
                if (!hasLaunchedRef.current) {
                    hasLaunchedRef.current = true;
                    onLaunch();
                }
            }
        }, 50);
    };

    const stopHold = () => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setIsHolding(false);
        setProgress(0);
    };

    useEffect(() => {
        return () => {
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        };
    }, []);

    return (
        <button 
            onMouseDown={startHold}
            onTouchStart={startHold}
            onMouseUp={stopHold} 
            onMouseLeave={stopHold}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: 'none', userSelect: 'none' }}
            className="relative py-3 bg-red-100 dark:bg-red-900/40 border-2 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 font-black rounded flex justify-center items-center gap-2 text-sm uppercase tracking-widest shadow-md overflow-hidden select-none"
        >
            <div 
                className="absolute left-0 top-0 bottom-0 bg-red-500/30 dark:bg-red-500/50 transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
            />
            <span className="relative z-10 flex items-center gap-2">
                <Flame size={16} /> 
                {isHolding ? (progress >= 100 ? 'LAUNCHED' : `HOLDING... ${Math.floor(progress)}%`) : 'HOLD TO LAUNCH'}
            </span>
        </button>
    );
};

export default function MotorMode({ isDark, toggleTheme, activeTab, onTabChange }: Props) {
    const [latestData, setLatestData] = useState<MotorTelemetry | null>(null);
    const [history, setHistory] = useState<number[][]>([[], [], [], [], [], []]); // [Time, RPT, IPT, PPT, MASS, THRUST]
    const startTimeRef = useRef<number | null>(null);

    const { 
        isConnected, 
        connect, 
        disconnect, 
        sendCommand, 
        logs,
        clearLogs 
    } = useMotorSerial((update) => {
        setLatestData(update);
        
        if (update.timestamp) {
            if (startTimeRef.current === null) startTimeRef.current = update.timestamp;
            const relTime = (update.timestamp - startTimeRef.current) / 1000;
            
            setHistory(prev => {
                const maxPoints = 300; // rolling buffer
                const time = [...prev[0], relTime].slice(-maxPoints);
                const rpt = [...prev[1], update.rpt].slice(-maxPoints);
                const ipt = [...prev[2], update.ipt].slice(-maxPoints);
                const ppt = [...prev[3], update.ppt].slice(-maxPoints);
                const mass = [...prev[4], update.mass].slice(-maxPoints);
                const thrust = [...prev[5], update.thrust || 0].slice(-maxPoints);
                
                return [time, rpt, ipt, ppt, mass, thrust];
            });
        }
    });

    // --- CLEAR STATE ON DISCONNECT ---
    useEffect(() => {
        if (!isConnected) {
            setLatestData(null);
        }
    }, [isConnected]);

    // --- UPLOT CONFIGS ---
    const pressureData = useMemo(() => {
        if (!history || history[0].length === 0) return null;
        return [history[0], history[1], history[2], history[3]] as uPlot.AlignedData;
    }, [history]);

    const pressureOptions = useMemo<uPlot.Options>(() => ({
        title: "PRESSURE PROFILE (PSI)",
        width: 100, height: 100,
        series: [
            {}, 
            { stroke: "#3b82f6", label: "RPT", width: 2, value: (u, v) => v?.toFixed(1) },
            { stroke: "#10b981", label: "IPT", width: 2, value: (u, v) => v?.toFixed(1) },
            { stroke: "#f59e0b", label: "PPT", width: 2, value: (u, v) => v?.toFixed(1) },
        ],
        axes: [
            { stroke: isDark ? "#94a3b8" : "#475569", grid: { stroke: isDark ? "#334155" : "#e2e8f0" } },
            { stroke: isDark ? "#94a3b8" : "#475569", grid: { stroke: isDark ? "#334155" : "#e2e8f0" } }
        ],
        scales: { x: { time: false }, y: { auto: true } },
        legend: { show: true, stroke: isDark ? "#cbd5e1" : "#1e293b" },
        padding: [10, 10, 0, 0]
    }), [isDark]);

    const performanceData = useMemo(() => {
        if (!history || history[0].length === 0) return null;
        return [history[0], history[4], history[5]] as uPlot.AlignedData;
    }, [history]);

    const performanceOptions = useMemo<uPlot.Options>(() => ({
        title: "MASS (KG) & THRUST (N)",
        width: 100, height: 100,
        series: [
            {}, 
            { stroke: "#8b5cf6", label: "MASS (kg)", width: 2, value: (u, v) => v?.toFixed(2) },
            { stroke: "#ef4444", label: "THRUST (N)", width: 2, value: (u, v) => v?.toFixed(1), scale: "N" },
        ],
        axes: [
            { stroke: isDark ? "#94a3b8" : "#475569", grid: { stroke: isDark ? "#334155" : "#e2e8f0" } },
            { stroke: "#8b5cf6", grid: { show: false } },
            { stroke: "#ef4444", side: 1, scale: "N", grid: { show: false } }
        ],
        scales: { x: { time: false }, y: { auto: true }, N: { auto: true } },
        legend: { show: true, stroke: isDark ? "#cbd5e1" : "#1e293b" },
        padding: [10, 10, 0, 0]
    }), [isDark]);

    // --- UI HELPERS ---
    const getBadgeStyle = (state: MotorFSMState | undefined) => {
        switch (state) {
            case 'BOOT': return 'bg-slate-500 text-white shadow-[0_0_10px_rgba(100,116,139,0.5)]';
            case 'SAFE': return 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)]';
            case 'FILL': return 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-pulse';
            case 'VENT': return 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.6)]';
            case 'LAUNCH': return 'bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.8)] animate-pulse font-black';
            case 'CONVERT': return 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)]';
            case 'END': return 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)]';
            case 'FAILURE':
            case 'ABORT': return 'bg-red-700 text-white shadow-[0_0_30px_rgba(185,28,28,1)] animate-bounce font-black';
            default: return 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-300';
        }
    };

    const MetricCard = ({ label, value, unit, color = "text-slate-900 dark:text-white" }: { label: string, value: string, unit: string, color?: string }) => (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
            <div className={`text-2xl font-mono font-black tracking-tight ${color}`}>
                {value} <span className="text-[10px] text-slate-500 font-bold ml-0.5">{unit}</span>
            </div>
        </div>
    );

    const ActuatorCard = ({ label, open, angle }: { label: string, open: boolean, angle?: number }) => (
        <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${open ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
            <div className="flex items-center gap-3">
                {angle !== undefined && (
                    <span className="text-xs font-mono font-bold text-slate-500">{angle}°</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${open ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>
                    {open ? 'OPEN' : 'CLOSED'}
                </span>
            </div>
        </div>
    );

    const handleAction = (cmd: string) => {
        if (cmd === MOTOR_COMMANDS.ABORT) {
            if (confirm(`CRITICAL ACTION: Are you sure you want to send EMERGENCY ABORT?`)) {
                sendCommand(cmd);
            }
        } else {
            sendCommand(cmd);
        }
    };

    // --- TERMINAL SCROLLING ---
    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const HeaderActions = (
        <div className="flex items-center gap-3">
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${getBadgeStyle(latestData?.state)}`}>
                {latestData?.state || 'OFFLINE'}
            </div>
            
            {!isConnected ? (
                <button onClick={connect} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                    <Link size={14} /> CONNECT
                </button>
            ) : (
                <button onClick={disconnect} className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                    <Square size={14} /> DISCONNECT
                </button>
            )}
            
            <button onClick={() => {}} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] font-bold uppercase transition-colors shadow-sm">
                <Download size={12} /> CSV
            </button>
        </div>
    );

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-black relative overflow-hidden">
            <Header actions={HeaderActions} isDark={isDark} toggleTheme={toggleTheme} activeTab={activeTab} onTabChange={onTabChange} />
            
            <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">
                
                {/* TOP METRICS GRID */}
                <div className="grid grid-cols-5 gap-3 h-24">
                    <MetricCard label="TANK MASS" value={latestData?.mass.toFixed(2) || "0.00"} unit="kg" color="text-purple-600 dark:text-purple-400" />
                    <MetricCard label="RPT (RUN TANK)" value={latestData?.rpt.toFixed(1) || "0.0"} unit="psi" color="text-blue-600 dark:text-blue-400" />
                    <MetricCard label="IPT (INJECTOR)" value={latestData?.ipt.toFixed(1) || "0.0"} unit="psi" color="text-emerald-600 dark:text-emerald-400" />
                    <MetricCard label="PPT (PIPE)" value={latestData?.ppt.toFixed(1) || "0.0"} unit="psi" color="text-amber-600 dark:text-amber-400" />
                    <MetricCard label="THRUST" value={latestData?.thrust?.toFixed(1) || "0.0"} unit="N" color="text-red-600 dark:text-red-400" />
                </div>

                {/* MAIN DASHBOARD AREA */}
                <div className="flex-1 flex gap-3 min-h-0">
                    
                    {/* LEFT PANEL: CHARTS */}
                    <div className="flex-[3] flex flex-col gap-3 min-w-0">
                        <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 relative shadow-sm">
                             {pressureData ? (
                                <div className="absolute inset-2"><UPlotChart data={pressureData} options={pressureOptions} /></div>
                             ) : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono animate-pulse">Waiting for telemetry...</div>
                             )}
                        </div>
                        <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 relative shadow-sm">
                             {performanceData ? (
                                <div className="absolute inset-2"><UPlotChart data={performanceData} options={performanceOptions} /></div>
                             ) : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono animate-pulse">Waiting for telemetry...</div>
                             )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: ACTUATORS & COMMAND DECK */}
                    <div className="flex-[1] min-w-[280px] flex flex-col gap-3">
                        
                        {/* ACTUATOR MATRIX */}
                        <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Settings size={12}/> ACTUATORS</h3>
                            <div className="flex flex-col gap-2">
                                <ActuatorCard label="FILL SERVO" open={latestData?.valves.fillOpen || false} angle={latestData?.valves.fillAngle} />
                                <ActuatorCard label="SUB-VENT SERVO" open={latestData?.valves.svOpen || false} angle={latestData?.valves.svAngle} />
                                <ActuatorCard label="MAIN OX SERVO" open={latestData?.valves.oxOpen || false} angle={latestData?.valves.oxAngle} />
                                <ActuatorCard label="MAIN VENT VALVE" open={latestData?.valves.ventOpen || false} />
                            </div>
                        </div>

                        {/* COMMAND DECK */}
                        <div className="flex-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Terminal size={12}/> COMMAND DECK</h3>
                            
                            <div className="flex flex-col gap-2 flex-1">
                                <button onClick={() => handleAction(MOTOR_COMMANDS.SAFE)} className="py-2.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 font-bold rounded flex justify-center items-center gap-2 text-xs transition-colors"><Shield size={14} /> SAFE / DISARM</button>
                                
                                <button onClick={() => handleAction(MOTOR_COMMANDS.FILL)} className="py-2.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 border border-blue-300 dark:border-blue-700/50 text-blue-700 dark:text-blue-400 font-bold rounded flex justify-center items-center gap-2 text-xs transition-colors"><Droplet size={14} /> START FILL</button>
                                
                                <button onClick={() => handleAction(MOTOR_COMMANDS.VENT_OVERRIDE)} className="py-2.5 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 font-bold rounded flex justify-center items-center gap-2 text-xs transition-colors"><Wind size={14} /> VENT OVERRIDE</button>
                                
                                <button onClick={() => handleAction(MOTOR_COMMANDS.STOP)} className="py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-300 font-bold rounded flex justify-center items-center gap-2 text-xs transition-colors"><Square size={14} /> STOP FLOW</button>
                                
                                <button onClick={() => handleAction(MOTOR_COMMANDS.CONVERT)} className="py-2.5 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/50 border border-purple-300 dark:border-purple-700/50 text-purple-700 dark:text-purple-400 font-bold rounded flex justify-center items-center gap-2 text-xs transition-colors"><Database size={14} /> CONVERT LOGS</button>
                                
                                <div className="mt-auto flex flex-col gap-2">
                                    <HoldToLaunchButton onLaunch={() => sendCommand(MOTOR_COMMANDS.LAUNCH)} />
                                    
                                    <button onClick={() => handleAction(MOTOR_COMMANDS.ABORT)} className="py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded flex justify-center items-center gap-2 text-sm uppercase tracking-widest shadow-lg shadow-red-500/30 transition-colors"><AlertOctagon size={16} /> EMERGENCY ABORT</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM EMBEDDED SERIAL MONITOR */}
                <div className="h-48 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Terminal size={12} /> SERIAL STREAM
                        </span>
                        <div className="flex gap-2">
                            <button onClick={clearLogs} className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">CLEAR</button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed bg-slate-50 dark:bg-black/50">
                        {logs.length === 0 && <span className="text-slate-400 italic px-2">Awaiting connection...</span>}
                        {logs.map((log, i) => {
                            let color = 'text-slate-600 dark:text-slate-400';
                            let prefix = '';
                            if (log.type === 'RX') {
                                color = 'text-emerald-600 dark:text-emerald-400';
                                prefix = '← ';
                            } else if (log.type === 'TX') {
                                color = 'text-blue-600 dark:text-blue-400';
                                prefix = '→ ';
                            } else if (log.type === 'SYS') {
                                color = 'text-amber-600 dark:text-amber-400 font-bold';
                                prefix = '⚙ ';
                            }
                            
                            return (
                                <div key={i} className={`px-2 py-0.5 break-all hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded ${color}`}>
                                    <span className="text-slate-400 dark:text-slate-600 mr-2 opacity-50">
                                        {new Date(log.timestamp).toISOString().substring(11, 23)}
                                    </span>
                                    {prefix}{log.message}
                                </div>
                            );
                        })}
                        <div ref={logsEndRef} />
                    </div>
                    
                    <div className="px-2 py-2 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <span className="text-slate-400 font-bold ml-1">{'>'}</span>
                        <input 
                            type="text" 
                            placeholder="Type AT / Serial command..."
                            className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value) {
                                    handleAction(e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}