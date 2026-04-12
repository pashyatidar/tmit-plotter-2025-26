"use client";
import React, { useState, useRef } from 'react';
import { Usb, StopCircle, Download, MapPin, Clock, Navigation2, Satellite, Target, Info, Activity } from 'lucide-react';
import Header from '../../components/Header';
import IntegratedMap from '../../components/IntegratedMap';
import ClientOnly from '../../components/ClientOnly';
import GPSConfigModal from './components/GPSConfigModal';
import { useGPSSerial } from '../../hooks/useGPSSerial';

interface Props {
    isDark: boolean;
    toggleTheme: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function GPSMode({ isDark, toggleTheme, activeTab, onTabChange }: Props) {
    const { 
        isConnected, currentPos, trajectory, hasLogs, 
        connect, disconnect, downloadLog 
    } = useGPSSerial();

    const [showInfo, setShowInfo] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const HeaderActions = (
        <div className="flex items-center gap-3 relative">
            {!isConnected ? (
                <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs transition-all shadow-sm">
                    <Usb size={14} /> CONNECT GPS
                </button>
            ) : (
                <button onClick={disconnect} className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md text-xs transition-all shadow-sm">
                    <StopCircle size={14} /> STOP TRACKING
                </button>
            )}
            
            {hasLogs && (
                <>
                    <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-800 mx-1" />
                    <button onClick={downloadLog} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] font-bold uppercase shadow-sm">
                        <Download size={12} /> SAVE LOG
                    </button>
                </>
            )}

            <button 
                onClick={() => setShowInfo(!showInfo)} 
                className={`p-1.5 rounded-md text-slate-600 dark:text-slate-400 border transition-colors shadow-sm flex items-center justify-center ${showInfo ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-800'}`}
                title="View Expected Stream Formats"
            >
                <Info size={14} />
            </button>

            {/* INFO DROPDOWN */}
            {showInfo && (
                <div className="absolute top-10 right-0 w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl p-4 z-50 text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Expected Serial Streams</h3>
                    <div className="space-y-3">
                        <div>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide">Standard CSV</span>
                            <code className="block mt-1 text-[10px] bg-slate-100 dark:bg-black p-2 rounded-lg font-mono text-emerald-600 dark:text-emerald-400">Time,Lat,Lon,Sats<br/>Time,no_fix</code>
                        </div>
                        <div>
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wide">Receiver Node (LoRa)</span>
                            <code className="block mt-1 text-[10px] bg-slate-100 dark:bg-black p-2 rounded-lg font-mono text-emerald-600 dark:text-emerald-400">+RCV=Addr,Len,Time,Lat,Lon,Sats,RSSI,SNR<br/>+RCV=Addr,Len,Time,no_fix,RSSI,SNR</code>
                        </div>
                        <div>
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wide">Transmitter Node (LoRa)</span>
                            <code className="block mt-1 text-[10px] bg-slate-100 dark:bg-black p-2 rounded-lg font-mono text-emerald-600 dark:text-emerald-400">AT+SEND=Addr,Len,Time,Lat,Lon,Sats<br/>AT+SEND=Addr,Len,Time,no_fix</code>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const hasFix = currentPos.hasFix;

    return (
        <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden relative">
            <Header actions={HeaderActions} isDark={isDark} toggleTheme={toggleTheme} activeTab={activeTab} onTabChange={onTabChange} />

            {/* GPS HUD OVERLAY */}
            {isConnected && (
                <div className="absolute left-4 top-24 z-40 pointer-events-none flex flex-col gap-3">
                    
                    {/* CARD 1: MAIN GNSS (ORANGE) */}
                    <div className="w-56 bg-slate-900/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-4 pointer-events-auto transition-colors border-t-2 border-t-orange-500">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                                <Satellite size={12} className={hasFix ? "text-orange-400" : "text-amber-500"}/> 
                                {hasFix ? "GNSS: FIX OK" : "GNSS: NO FIX"}
                            </span>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${hasFix ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" : "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"}`} />
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><MapPin size={10}/> LAT</span>
                                <span className={`text-sm font-mono font-bold tracking-tight ${hasFix ? "text-white" : "text-slate-600"}`}>
                                    {hasFix ? currentPos.lat.toFixed(7) : "---"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Navigation2 size={10}/> LON</span>
                                <span className={`text-sm font-mono font-bold tracking-tight ${hasFix ? "text-white" : "text-slate-600"}`}>
                                    {hasFix ? currentPos.lon.toFixed(7) : "---"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Target size={10}/> SATS</span>
                                <span className={`text-sm font-mono font-bold tracking-tight ${hasFix ? "text-white" : "text-slate-600"}`}>
                                    {hasFix ? currentPos.sats : 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: LORA SIGNAL STATS (Conditional) */}
                    {currentPos.isLora && !isNaN(currentPos.rssi) && (
                        <div className="w-56 bg-slate-900/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-4 pointer-events-auto transition-colors border-t-2 border-t-cyan-500">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                                    <Activity size={12} className="text-cyan-400"/> 
                                    LORA SIGNAL
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">RSSI</span>
                                    <span className="text-sm font-mono font-bold tracking-tight text-white">{currentPos.rssi} dBm</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">SNR</span>
                                    <span className="text-sm font-mono font-bold tracking-tight text-white">{currentPos.snr} dB</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CLOCK */}
                    <div className="w-56 bg-slate-900/80 dark:bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-3 flex justify-between items-center pointer-events-auto">
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Clock size={10}/> Telemetry Heartbeat</span>
                         <span className="text-xs font-mono font-bold text-slate-300 tracking-tight">{currentPos.time} ms</span>
                    </div>

                </div>
            )}

            {/* FULL SCREEN MAP */}
            <div className="flex-1 w-full h-full relative bg-slate-900">
                <ClientOnly>
                    <IntegratedMap 
                        lat={currentPos.lat} 
                        lon={currentPos.lon} 
                        trajectory={trajectory} 
                        altitude={0} 
                        isDark={isDark} 
                    />
                </ClientOnly>
            </div>

            {/* CONFIG MODAL */}
            <GPSConfigModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                onConnect={(unit) => {
                    setIsConfigOpen(false);
                    connect(unit);
                }}
            />
        </div>
    );
}