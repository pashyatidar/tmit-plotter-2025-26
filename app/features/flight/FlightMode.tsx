"use client";
import { useState, useEffect, useMemo } from 'react'; 
import { Activity, Usb, StopCircle, Download, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import Header from '../../components/Header';
import TelemetryStrip, { TELEMETRY_PARAMS, TelemetryParam } from './TelemetryStrip';
import RocketStatus from '../../components/RocketStatus';
import ClientOnly from '../../components/ClientOnly';
import GraphGrid, { GraphConfig } from '../../components/GraphGrid'; 
import { useFlightData } from '../../hooks/useFlightData';
import { useSerial, SequenceItem as SerialSequenceItem } from '../../hooks/useSerial';
import { useFlightSimulation } from '../../hooks/useFlightSimulation';
import IntegratedMap from '../../components/IntegratedMap';
import PeekGraph from '../analysis/PeekGraph';
import { SIM_EXTRA_PARAMS, buildConsoleGraphs, PACKET_PRESETS } from './flightConstants';
import FlightConfigModal, { SequenceItem } from './components/FlightConfigModal';



interface Props {
    isDark: boolean;
    toggleTheme: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function FlightMode({ isDark, toggleTheme, activeTab, onTabChange }: Props) {
    const { plotData, trajectory, currentPacket, addData, resetData, downloadLog } = useFlightData();
    const { isSimulating, startSimulation, stopSimulation } = useFlightSimulation(addData);
    const { isConnected, connect, disconnect } = useSerial(addData);
    
    const [isDeckOpen, setIsDeckOpen] = useState(false);
    const [mapResetKey, setMapResetKey] = useState(0);
    const [hoveredParam, setHoveredParam] = useState<TelemetryParam | null>(null);

    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [lockedSequence, setLockedSequence] = useState<SequenceItem[]>([]);
    
    const isActive = isConnected || isSimulating;

    // Derive active parameter types from locked sequence
    const activeParamTypes = useMemo(() => {
        const seqTypes = lockedSequence
            .map(s => String(s.type))
            .filter(t => t && t !== 'IGNORE' && t !== '');
        
        // For simulation, add extra params that the sim generates
        if (isSimulating) {
            const typeSet = new Set(seqTypes);
            for (const p of SIM_EXTRA_PARAMS) {
                typeSet.add(p);
            }
            return Array.from(typeSet);
        }
        
        return seqTypes;
    }, [lockedSequence, isSimulating]);

    // Build console graphs dynamically from active params
    const consoleGraphs = useMemo(() => {
        if (activeParamTypes.length === 0) return [];
        return buildConsoleGraphs(activeParamTypes);
    }, [activeParamTypes]);

    // THE FAIL-SAFE: Pad missing telemetry parameters so uPlot never crashes
    const safePlotData = useMemo(() => {
        if (!plotData || !plotData[0]) return plotData;
        const paddedData = [...plotData];
        const timeLength = plotData[0].length;
        for (let i = 0; i <= 28; i++) {
            if (!paddedData[i] || paddedData[i].length !== timeLength) {
                paddedData[i] = Array(timeLength).fill(0);
            }
        }
        return paddedData;
    }, [plotData]);

    // Auto-open console only when active AND there are charts to show
    useEffect(() => {
        if (isActive && consoleGraphs.length > 0) setIsDeckOpen(true);
        else setIsDeckOpen(false);
    }, [isActive, consoleGraphs.length]);

    const executeHardwareConnection = async (finalSequence: SequenceItem[], finalUnit: 'ms' | 's') => {
        setIsConfigModalOpen(false);
        resetData(); 
        setMapResetKey(k => k+1); 
        
        setLockedSequence(finalSequence);
        await connect(finalSequence, finalUnit); 
    };

    const executeSimulation = () => {
        resetData(); 
        setMapResetKey(k => k+1); 
        const simSeq = PACKET_PRESETS[1].sequence.filter(s => s.type !== 'IGNORE' && s.type !== '');
        setLockedSequence(simSeq as SequenceItem[]);
        startSimulation('NOMINAL');
    };

    const getRotation = () => { return { x: currentPacket?.tilt_angle || 0, y: 0, z: 0 }; };

    // ─── HEADER ACTIONS ──────────────────────────────────────────
    const HeaderActions = (
        <div className="flex items-center gap-3">
            {!isSimulating && (
                !isConnected ? (
                    <button onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                        <Usb size={14} /> CONNECT
                    </button>
                ) : (
                    <button onClick={() => disconnect()} className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                        <StopCircle size={14} /> STOP
                    </button>
                )
            )}
            {!isConnected && (
                <button onClick={() => isSimulating ? stopSimulation() : executeSimulation()} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm dark:shadow-none ${isSimulating ? "bg-amber-600 border-amber-500 text-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"}`}>
                    <Activity size={14} /> {isSimulating ? "END SIM" : "RUN SIM"}
                </button>
            )}
            {(isActive || (plotData && plotData[0] && plotData[0].length > 0)) && (
                <button onClick={() => downloadLog(activeParamTypes)} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] font-bold uppercase transition-colors shadow-sm dark:shadow-none">
                    <Download size={12} /> CSV
                </button>
            )}
            {isActive && consoleGraphs.length > 0 && (
                <>
                    <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-800 mx-1 transition-colors" />
                    <button onClick={() => setIsDeckOpen(!isDeckOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm dark:shadow-none ${isDeckOpen ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                        {isDeckOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                        {isDeckOpen ? "HIDE CONSOLE" : "SHOW CONSOLE"}
                    </button>
                </>
            )}
        </div>
    );

    // ─── RENDER ──────────────────────────────────────────────────
    return (
        <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden relative transition-colors duration-300">
            <Header actions={HeaderActions} isDark={isDark} toggleTheme={toggleTheme} activeTab={activeTab} onTabChange={onTabChange} />

            {/* CONFIG MODAL */}
            <FlightConfigModal 
                isOpen={isConfigModalOpen} 
                onClose={() => setIsConfigModalOpen(false)} 
                onExecute={executeHardwareConnection} 
            />

            {/* TELEMETRY STRIP (left) — always mounted, self-manages visibility */}
            <TelemetryStrip 
                data={currentPacket} 
                onHoverMetric={setHoveredParam} 
                isActive={isActive}
                activeParamTypes={activeParamTypes}
            />
            
            {/* PEEK GRAPH (right) — only when active */}
            {isActive && (
                <PeekGraph 
                    data={safePlotData as any} 
                    activeParam={hoveredParam} 
                    isDark={isDark} 
                />
            )}

            {/* ─── MAIN CONTENT: MAP stays full size, console overlays ─── */}
            <div className="flex-1 relative overflow-hidden">
                
                {/* 3D MAP — always full size, never shrinks */}
                <div className="absolute inset-0 bg-slate-900">
                    {isActive && (
                        <div className="absolute top-4 right-4 z-20 w-48 opacity-80 hover:opacity-100 transition-opacity">
                            <RocketStatus state={currentPacket?.state || 0} />
                        </div>
                    )}
                    <ClientOnly>
                        <IntegratedMap lat={currentPacket?.lat || 0} lon={currentPacket?.lon || 0} altitude={currentPacket?.altitude || 0} trajectory={trajectory} rotation={getRotation()} isDark={isDark} />
                    </ClientOnly>
                </div>

                {/* CONSOLE — overlays from bottom, only when there are charts to show */}
                {consoleGraphs.length > 0 && (
                    <div 
                        className={`absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 ${
                            isDeckOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                        }`}
                        style={{ height: '55%' }}
                    >
                        <div className="h-full p-3">
                            <div className="w-full h-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-black/20">
                                <GraphGrid data={safePlotData as any} isDark={isDark} customConfigs={consoleGraphs} mapResetKey={mapResetKey} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}