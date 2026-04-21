"use client";
import { useState, useEffect, useMemo, useRef } from 'react'; 
import { Activity, Usb, StopCircle, Download, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import Header from '../../components/Header';
import TelemetryStrip from './TelemetryStrip';
import RocketStatus from '../../components/RocketStatus';
import ClientOnly from '../../components/ClientOnly';
import GraphGrid, { GraphConfig } from '../../components/GraphGrid'; 
import { useFlightData } from '../../hooks/useFlightData';
import { useSerial, SequenceItem as SerialSequenceItem } from '../../hooks/useSerial';
import { useFlightSimulation } from '../../hooks/useFlightSimulation';
import IntegratedMap from '../../components/IntegratedMap';
import { SIM_EXTRA_PARAMS, buildConsoleGraphs, PACKET_PRESETS } from './flightConstants';
import FlightConfigModal, { SequenceItem } from './components/FlightConfigModal';
import { TelemetryParam, CardDef, CARD_DEFS, SoloCard, MultiCard } from './TelemetryStrip';
import { X } from 'lucide-react';

export interface DetachedItem {
    id: string;
    type: 'card' | 'graph';
    x: number;
    y: number;
    width?: number;  // for graphs to maintain their original flex grid size
    height?: number;
}



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
    
    const [mapResetKey, setMapResetKey] = useState(0);
    const [showInfo, setShowInfo] = useState(false);
    const [graphPage, setGraphPage] = useState(0);

    const userModifiedLayout = useRef(false);

    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [lockedSequence, setLockedSequence] = useState<SequenceItem[]>([]);
    const [detachedItems, setDetachedItems] = useState<DetachedItem[]>([]);
    const isActive = isConnected || isSimulating;

    // Window Management States
    const [isMapManual, setIsMapManual] = useState(false);
    const [mapGeometry, setMapGeometry] = useState({ x: 336, y: 120, width: 800, height: 600 });
    const [resizingNode, setResizingNode] = useState<{ id: string, type: string, startX: number, startY: number, startW: number, startH: number } | null>(null);
    const [draggingNode, setDraggingNode] = useState<{ id: string, type: string, startX: number, startY: number, startLeft: number, startTop: number } | null>(null);

    const bitmaskStr = useMemo(() => {
        if (currentPacket?.bitmask === undefined) return null;
        return String(currentPacket.bitmask).padStart(4, '0');
    }, [currentPacket?.bitmask]);

    // Derive active parameter types from locked sequence
    const activeParamTypes = useMemo(() => {
        return lockedSequence
            .map(s => String(s.type))
            .filter(t => t && t !== 'IGNORE' && t !== '');
    }, [lockedSequence]);

    // Build console graphs dynamically from active params
    const consoleGraphs = useMemo(() => {
        if (activeParamTypes.length === 0) return [];
        return buildConsoleGraphs(activeParamTypes);
    }, [activeParamTypes]);

    // Filter out detached graphs from the right-hand panel
    const attachedGraphs = useMemo(() => {
        const detachedIds = new Set(detachedItems.filter(i => i.type === 'graph').map(i => i.id));
        return consoleGraphs.filter(g => !detachedIds.has(g.id));
    }, [consoleGraphs, detachedItems]);

    const GRAPHS_PER_PAGE = 4;
    const totalPages = Math.ceil(attachedGraphs.length / GRAPHS_PER_PAGE);
    
    // Safety check to reset pagination bounds when adding/removing configs.
    useEffect(() => {
        if (graphPage >= totalPages && totalPages > 0) {
            setGraphPage(0);
        }
    }, [totalPages, graphPage]);

    const currentGraphs = useMemo(() => {
        return attachedGraphs.slice(graphPage * GRAPHS_PER_PAGE, (graphPage + 1) * GRAPHS_PER_PAGE);
    }, [attachedGraphs, graphPage]);

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



    const restoreLayout = () => {
        try {
            const data = localStorage.getItem('tmit-plotter-layout-standard');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed) {
                    setDetachedItems(parsed.items || []);
                    setIsMapManual(parsed.manual || false);
                    if (parsed.geom) setMapGeometry(parsed.geom);
                    return true;
                }
            }
        } catch (e) {}
        return false;
    };

    const executeHardwareConnection = async (finalSequence: SequenceItem[], finalUnit: 'ms' | 's', isPreset: boolean = false) => {
        setIsConfigModalOpen(false);
        resetData(); 
        setMapResetKey(k => k+1); 

        if (isPreset) {
            if (!restoreLayout()) {
                setDetachedItems([]);
                setIsMapManual(false);
            }
        } else {
            setDetachedItems([]); 
            setIsMapManual(false); 
        }
        
        setLockedSequence(finalSequence);
        await connect(finalSequence, finalUnit); 
    };

    const executeSimulation = () => {
        resetData(); 
        setMapResetKey(k => k+1); 
        
        if (!restoreLayout()) {
            setDetachedItems([]); 
            setIsMapManual(false); 
        }

        const simSeq = PACKET_PRESETS[1].sequence.filter(s => s.type !== 'IGNORE' && s.type !== '');
        setLockedSequence(simSeq as SequenceItem[]);
        startSimulation('NOMINAL');
    };

    const getRotation = () => { return { x: currentPacket?.tilt_angle || 0, y: 0, z: 0 }; };

    useEffect(() => {
        if (userModifiedLayout.current) {
            try {
                localStorage.setItem('tmit-plotter-layout-standard', JSON.stringify({
                    items: detachedItems,
                    manual: isMapManual,
                    geom: mapGeometry
                }));
            } catch(e) {}
            userModifiedLayout.current = false;
        }
    }, [detachedItems, isMapManual, mapGeometry]);

    // ─── HEADER ACTIONS ──────────────────────────────────────────
    const HeaderActions = (
        <div className="flex items-center gap-3">
            {!isSimulating && (
                !isConnected ? (
                    <button onClick={() => { setDetachedItems([]); setIsMapManual(false); setIsConfigModalOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                        <Usb size={14} /> CONNECT
                    </button>
                ) : (
                    <button onClick={() => { setDetachedItems([]); setIsMapManual(false); disconnect(); }} className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm">
                        <StopCircle size={14} /> STOP
                    </button>
                )
            )}
            {!isConnected && (
                <button onClick={() => {
                    if (isSimulating) {
                        stopSimulation();
                        resetData();
                        setLockedSequence([]);
                        setDetachedItems([]);
                        setIsMapManual(false);
                    } else {
                        executeSimulation();
                    }
                }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm dark:shadow-none ${isSimulating ? "bg-amber-600 border-amber-500 text-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"}`}>
                    <Activity size={14} /> {isSimulating ? "END SIM" : "RUN SIM"}
                </button>
            )}
            {(isActive || (plotData && plotData[0] && plotData[0].length > 0)) && (
                <button onClick={() => downloadLog(activeParamTypes)} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] font-bold uppercase transition-colors shadow-sm dark:shadow-none">
                    <Download size={12} /> CSV
                </button>
            )}

            
            <div className="relative">
                <button 
                    onClick={() => setShowInfo(!showInfo)} 
                    className={`p-1.5 rounded-md text-slate-600 dark:text-slate-400 border transition-colors shadow-sm flex items-center justify-center ${showInfo ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-800'}`}
                    title="View Expected Stream Formats"
                >
                    <Activity size={14} />
                </button>

                {showInfo && (
                    <div className="absolute top-10 right-0 w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl p-4 z-50 text-left">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Expected Serial Streams</h3>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide">Standard CSV Sequence</span>
                                <code className="block mt-1 text-[10px] bg-slate-100 dark:bg-black p-2 rounded-lg font-mono text-emerald-600 dark:text-emerald-400">Time,Val1,Val2...</code>
                            </div>
                            <div>
                                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wide">Receiver Node (LoRa)</span>
                                <code className="block mt-1 text-[10px] bg-slate-100 dark:bg-black p-2 rounded-lg font-mono text-emerald-600 dark:text-emerald-400">+RCV=Addr,Len,Time,Val1,Val2,RSSI,SNR</code>
                            </div>
                        </div>
                    </div>
                )}
            </div>
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

            {/* MAIN WORKSPACE - Drop Zone spans entire screen */}
            <div 
                className="relative flex-1 flex min-h-0"
                id="workspace-bounds"
                onPointerMove={(e) => {
                    if (resizingNode) {
                        e.preventDefault(); 
                        const dx = e.clientX - resizingNode.startX;
                        const dy = e.clientY - resizingNode.startY;
                        
                        if (resizingNode.type === 'map') {
                            setMapGeometry(prev => ({ 
                                ...prev, 
                                width: Math.max(300, resizingNode.startW + dx), 
                                height: Math.max(200, resizingNode.startH + dy) 
                            }));
                            setIsMapManual(true);
                        } else {
                            setDetachedItems(prev => prev.map(i => i.id === resizingNode.id && i.type === resizingNode.type ? { 
                                ...i, 
                                width: Math.max(200, resizingNode.startW + dx), 
                                height: Math.max(100, resizingNode.startH + dy) 
                            } : i));
                        }
                    } else if (draggingNode) {
                        e.preventDefault();
                        const dx = e.clientX - draggingNode.startX;
                        const dy = e.clientY - draggingNode.startY;
                        
                        if (draggingNode.type === 'map') {
                            const minY = isActive ? 120 : 16;
                            setMapGeometry(prev => ({
                                ...prev,
                                x: draggingNode.startLeft + dx,
                                y: Math.max(minY, draggingNode.startTop + dy)
                            }));
                        }
                    }
                }}
                onPointerUp={() => {
                    if (resizingNode || draggingNode) {
                        userModifiedLayout.current = true;
                    }
                    if (resizingNode) setResizingNode(null);
                    if (draggingNode) setDraggingNode(null);
                }}
                onPointerLeave={() => {
                    if (resizingNode) setResizingNode(null);
                    if (draggingNode) setDraggingNode(null);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    userModifiedLayout.current = true;
                    const rawData = e.dataTransfer.getData('text/plain');
                    if (!rawData) return;
                    
                    try {
                        const data = JSON.parse(rawData);
                        const boundingBox = e.currentTarget.getBoundingClientRect();
                        
                        let localX = e.clientX - boundingBox.left;
                        let localY = e.clientY - boundingBox.top;
                        
                        const offsetXStr = e.dataTransfer.getData('offset-x');
                        const offsetYStr = e.dataTransfer.getData('offset-y');
                        const offsetX = offsetXStr ? parseInt(offsetXStr) : 0;
                        const offsetY = offsetYStr ? parseInt(offsetYStr) : 0;

                        const finalX = localX - offsetX;
                        const finalY = localY - offsetY;
                        
                        if (data.type === 'map') {
                            setIsMapManual(true);
                            setMapGeometry(prev => ({ ...prev, x: finalX, y: finalY }));
                            return;
                        }
                        
                        setDetachedItems(prev => {
                            const existing = prev.find(i => i.id === data.id && i.type === data.type);
                            if (existing) {
                                return prev.map(i => (i.id === data.id && i.type === data.type) ? { ...i, x: finalX, y: finalY } : i);
                            }
                            
                            return [...prev, {
                                id: data.id,
                                type: data.type,
                                x: finalX,
                                y: finalY,
                                width: data.width,
                                height: data.height
                            }];
                        });
                    } catch (err) {
                        console.error('Drop error', err);
                    }
                }}
            >
                
                {/* TELEMETRY STRIP (left pane) */}
                <TelemetryStrip 
                    data={currentPacket} 
                    isActive={isActive}
                    activeParamTypes={activeParamTypes}
                    detachedItems={detachedItems}
                    setDetachedItems={setDetachedItems}
                />
                
                {/* STATUS TABS - Center Top */}
                {isActive && (
                    <div 
                        className="absolute top-4 h-[88px] z-20 flex gap-4 pointer-events-none"
                        style={{ left: '336px', right: '336px' }}
                    >
                        <div className="flex-1 pointer-events-auto h-full">
                            <RocketStatus state={currentPacket?.state || 0} className="w-full" />
                        </div>
                        
                        {/* SENSOR HEALTH SECTION */}
                        {bitmaskStr && (
                            <div className="flex-1 bg-slate-900/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-3 flex flex-col justify-center pointer-events-auto transition-colors border-t-2 border-t-emerald-500 h-full">
                                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                                        <CheckCircle2 size={12} className="text-emerald-400"/> 
                                        SENSOR HEALTH
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {[
                                        { label: 'BARO', value: bitmaskStr[0] },
                                        { label: 'IMU', value: bitmaskStr[1] },
                                        { label: 'ACCL', value: bitmaskStr[2] },
                                        { label: 'GPS', value: bitmaskStr[3] },
                                    ].map((sensor) => (
                                        <div key={sensor.label} className="flex justify-between items-center bg-white/5 rounded px-2 py-0.5">
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">{sensor.label}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[8px] font-bold ${sensor.value === '1' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {sensor.value === '1' ? 'OK' : 'FAULT'}
                                                </span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${sensor.value === '1' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* LORA STATS SECTION */}
                        {currentPacket?.rssi !== undefined && (
                            <div className="flex-1 bg-slate-900/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-3 flex flex-col justify-center pointer-events-auto transition-colors border-t-2 border-t-cyan-500 h-full">
                                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                                        <Activity size={12} className="text-cyan-400"/> 
                                        LORA LINK
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">RSSI</span>
                                        <span className="text-xs font-mono font-bold tracking-tight text-white">{currentPacket.rssi} dBm</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">SNR</span>
                                        <span className="text-xs font-mono font-bold tracking-tight text-white">{currentPacket.snr} dB</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ADDR</span>
                                        <span className="text-xs font-mono font-bold tracking-tight text-slate-300">{currentPacket.address}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">LEN</span>
                                        <span className="text-xs font-mono font-bold tracking-tight text-slate-300">{currentPacket.length} B</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* LARGE 3D MAP */}
                <div 
                    className="absolute z-10 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto border border-slate-200 dark:border-white/10"
                    style={{ 
                        left: !isMapManual ? '336px' : `${mapGeometry.x}px`,
                        right: !isMapManual ? '336px' : undefined,
                        top: !isMapManual ? (isActive ? '120px' : '16px') : `${mapGeometry.y}px`,
                        bottom: !isMapManual ? '16px' : undefined,
                        width: isMapManual ? `${mapGeometry.width}px` : undefined,
                        height: isMapManual ? `${mapGeometry.height}px` : undefined,
                        transition: resizingNode?.type === 'map' || isMapManual ? 'none' : 'all 0.5s cubic-bezier(0.16,1,0.3,1)'
                     }}
                >
                    {/* PERMANENT DRAG HANDLE FOR MAP */}
                    <div 
                        className="absolute top-0 left-0 right-0 h-8 bg-slate-900/90 backdrop-blur z-50 cursor-grab active:cursor-grabbing border-b border-white/10 flex items-center justify-center transition-colors hover:bg-slate-800/90"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            let startX = mapGeometry.x;
                            let startY = mapGeometry.y;

                            if (!isMapManual) {
                                startX = 336;
                                startY = isActive ? 120 : 16;
                                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                                setMapGeometry({ x: startX, y: startY, width: rect.width, height: rect.height });
                                setIsMapManual(true);
                            }
                            
                            setDraggingNode({ 
                                id: 'main-map', type: 'map', 
                                startX: e.clientX, startY: e.clientY, 
                                startLeft: startX, startTop: startY 
                            });
                        }}
                    >
                        {/* Drag Handle Grip Icon */}
                        <div className="flex gap-1 opacity-50 pointer-events-none">
                            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                        </div>
                    </div>

                    {/* RESIZE HANDLE */}
                    <div 
                        className="absolute bottom-0 right-0 w-6 h-6 z-50 cursor-se-resize flex items-end justify-end p-1.5 opacity-50 hover:opacity-100"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            if (!isMapManual) {
                                const startX = 336;
                                const startY = isActive ? 120 : 16;
                                setMapGeometry({ x: startX, y: startY, width: rect.width, height: rect.height });
                            }
                            setResizingNode({ id: 'main-map', type: 'map', startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height });
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/70">
                            <path d="M21 15L15 21M21 8L8 21" strokeLinecap="round"/>
                        </svg>
                    </div>

                    <ClientOnly>
                        <IntegratedMap lat={currentPacket?.lat || 0} lon={currentPacket?.lon || 0} altitude={currentPacket?.altitude || 0} trajectory={trajectory} rotation={getRotation()} isDark={isDark} />
                    </ClientOnly>
                </div>

                    {/* RENDER DETACHED ITEMS (Floating over ENTIRE screen) */}
                    {detachedItems.map(item => {
                        const handleDragStart = (e: React.DragEvent) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData('text/plain', JSON.stringify({ 
                                id: item.id, type: item.type, width: item.width, height: item.height 
                            }));
                            e.dataTransfer.setData('offset-x', (e.clientX - rect.left).toString());
                            e.dataTransfer.setData('offset-y', (e.clientY - rect.top).toString());
                            
                            requestAnimationFrame(() => {
                                if (e.target instanceof HTMLElement) {
                                    e.target.style.opacity = '0';
                                }
                            });
                        };

                        const handleDragEnd = (e: React.DragEvent) => {
                            if (e.target instanceof HTMLElement) {
                                e.target.style.opacity = '1';
                            }
                        };

                        const closeBtn = (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    userModifiedLayout.current = true;
                                    setDetachedItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
                                }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 z-[110] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                        );
                        
                        const resizeHandle = (
                            <div 
                                className="absolute bottom-0 right-0 w-6 h-6 z-[110] cursor-se-resize flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                                    setResizingNode({ id: item.id, type: item.type, startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height });
                                }}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={isDark ? "text-white/40" : "text-black/40"}>
                                    <path d="M21 15L15 21M21 8L8 21" strokeLinecap="round"/>
                                </svg>
                            </div>
                        );

                        if (item.type === 'card') {
                            const cardDef = CARD_DEFS.find(c => c.id === item.id);
                            if (!cardDef) return null;
                            return (
                                <div 
                                    key={`detached-card-${item.id}`} 
                                    className="absolute z-[100] cursor-grab active:cursor-grabbing hover:z-[110] group" 
                                    style={{ 
                                        left: item.x, top: item.y, 
                                        width: 290, 
                                        height: 100
                                    }}
                                    draggable
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="relative w-full h-full pointer-events-none transform origin-top-left transition-transform duration-75">
                                        {cardDef.subs ? (
                                            <MultiCard card={cardDef} data={currentPacket} index={0} visible={true} />
                                        ) : (
                                            <SoloCard card={cardDef} data={currentPacket} index={0} visible={true} />
                                        )}
                                    </div>
                                    {closeBtn}
                                </div>
                            );
                        } else {
                            const graphDef = consoleGraphs.find(g => g.id === item.id);
                            if (!graphDef) return null;
                            return (
                                <div 
                                    key={`detached-graph-${item.id}`} 
                                    className="absolute z-[100] group cursor-grab active:cursor-grabbing hover:z-[110]" 
                                    style={{ 
                                        left: item.x, top: item.y, 
                                        width: item.width || 320, 
                                        height: item.height || 180
                                    }}
                                    draggable
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="relative w-full h-full pointer-events-none">
                                        <GraphGrid 
                                            data={safePlotData as any} 
                                            isDark={isDark} 
                                            customConfigs={[graphDef]} 
                                            mapResetKey={mapResetKey}
                                            forceVertical={false}
                                        />
                                    </div>
                                    {closeBtn}
                                    {resizeHandle}
                                </div>
                            );
                        }
                    })}

                {/* GRAPHS - Right Side Pane (320px wide) */}
                {consoleGraphs.length > 0 && (
                    <div className="absolute right-0 top-0 bottom-0 w-[320px] z-10 flex flex-col bg-slate-100 dark:bg-slate-950 border-l border-slate-200 dark:border-white/10"
                         style={{ display: attachedGraphs.length === 0 && detachedItems.length > 0 ? 'none' : 'flex' }}
                    >
                        <div className="flex-1 overflow-hidden pt-[88px] pb-4 px-2">
                            <GraphGrid 
                                data={safePlotData as any} 
                                isDark={isDark} 
                                customConfigs={currentGraphs} 
                                mapResetKey={mapResetKey} 
                                forceVertical={true} 
                                isDetachable={true}
                            />
                        </div>
                        
                        {/* PAGINATION */}
                        {totalPages > 1 && (
                            <div className="h-12 border-t border-slate-200 dark:border-white/10 flex items-center justify-between px-4 bg-white/50 dark:bg-black/20">
                                <button 
                                    onClick={() => setGraphPage(p => Math.max(0, p - 1))}
                                    disabled={graphPage === 0}
                                    className="p-1 px-3 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-30 enabled:hover:bg-slate-200 dark:enabled:hover:bg-slate-800 transition-colors"
                                >
                                    <ChevronDown className="rotate-90" size={14} />
                                </button>
                                <span className="text-xs font-bold text-slate-500 tracking-widest">
                                    PAGE {graphPage + 1}/{totalPages}
                                </span>
                                <button 
                                    onClick={() => setGraphPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={graphPage === totalPages - 1}
                                    className="p-1 px-3 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-30 enabled:hover:bg-slate-200 dark:enabled:hover:bg-slate-800 transition-colors"
                                >
                                    <ChevronUp className="rotate-90" size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}