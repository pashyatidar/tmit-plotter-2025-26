"use client";
import { useState, useEffect } from 'react';
import { 
    Gauge, 
    Wind, 
    Zap, 
    Thermometer, 
    Navigation, 
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { FlightDataPoint } from '../../hooks/useFlightData';

interface Props {
    data: FlightDataPoint | null;
    onHoverMetric: (metric: string | null) => void;
    isActive: boolean;
}

const colorStyles = {
    blue:    { text: "text-blue-500 dark:text-blue-400",    border: "border-l-blue-500",    bg: "bg-blue-500/5 dark:bg-blue-500/10" },
    emerald: { text: "text-emerald-500 dark:text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-500/5 dark:bg-emerald-500/10" },
    rose:    { text: "text-rose-500 dark:text-rose-400",    border: "border-l-rose-500",    bg: "bg-rose-500/5 dark:bg-rose-500/10" },
    amber:   { text: "text-amber-500 dark:text-amber-400",  border: "border-l-amber-500",   bg: "bg-amber-500/5 dark:bg-amber-500/10" },
    indigo:  { text: "text-indigo-500 dark:text-indigo-400", border: "border-l-indigo-500",  bg: "bg-indigo-500/5 dark:bg-indigo-500/10" },
};

const MetricRow = ({ label, value, unit, icon: Icon, colorTheme, metricKey, onHover }: any) => {
    const style = colorStyles[colorTheme as keyof typeof colorStyles];
    
    return (
        <div 
            className={`flex items-center gap-3 px-3 py-2 border-l-2 ${style.border} ${style.bg} cursor-crosshair transition-all hover:pl-4 hover:brightness-110`}
            onMouseEnter={() => onHover(metricKey)}
            onMouseLeave={() => onHover(null)}
        >
            <Icon size={13} className={style.text} />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-12 shrink-0">
                {label}
            </span>
            <div className="flex items-baseline gap-0.5 ml-auto">
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
                    {value}
                </span>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{unit}</span>
            </div>
        </div>
    );
};

export default function SlideInTelemetry({ data, onHoverMetric, isActive }: Props) {
    const [isPinned, setIsPinned] = useState(false);
    const [isMouseInZone, setIsMouseInZone] = useState(false);

    useEffect(() => {
        if (!isActive) {
            setIsMouseInZone(false);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (isPinned) return; // Don't auto-hide when pinned
            const triggerZone = 80; // Narrow trigger — just the left edge
            setIsMouseInZone(e.clientX <= triggerZone);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isActive, isPinned]);

    // SAFE G-FORCE CALCULATION
    let gForceDisplay = "0.00";
    if (data) {
        const az = isNaN(Number(data.accel_z)) ? 0 : Number(data.accel_z);
        gForceDisplay = Math.abs(az).toFixed(2);
    }

    const showPanel = isActive && (isMouseInZone || isPinned);

    return (
        <div 
            className={`fixed left-0 z-30 transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                showPanel ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ top: '50%', transform: showPanel ? 'translateY(-50%)' : 'translateX(-100%) translateY(-50%)' }}
        >
            <div className="flex items-center">
                {/* Main panel */}
                <div className="w-[220px] bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-r-xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            TELEMETRY
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    {/* Metrics */}
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        <MetricRow label="ALT" value={data?.altitude?.toFixed(1) || "0.0"} unit="m" icon={Navigation} colorTheme="blue" metricKey="alt" onHover={onHoverMetric} />
                        <MetricRow label="VEL" value={data?.velocity?.toFixed(1) || "0.0"} unit="m/s" icon={Wind} colorTheme="emerald" metricKey="vel" onHover={onHoverMetric} />
                        <MetricRow label="G" value={gForceDisplay} unit="G" icon={Zap} colorTheme="rose" metricKey="acc" onHover={onHoverMetric} />
                        <MetricRow label="PRESS" value={( (data?.pressure || 0) / 1000 ).toFixed(1)} unit="kPa" icon={Gauge} colorTheme="amber" metricKey="pres" onHover={onHoverMetric} />
                        <MetricRow label="TEMP" value={data?.temp?.toFixed(1) || "0.0"} unit="°C" icon={Thermometer} colorTheme="indigo" metricKey="temp" onHover={onHoverMetric} />
                    </div>
                </div>

                {/* Pin toggle tab */}
                <button 
                    onClick={() => setIsPinned(!isPinned)}
                    className={`h-10 w-5 flex items-center justify-center rounded-r-md border border-l-0 transition-colors ${
                        isPinned 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white'
                    }`}
                >
                    {isPinned ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                </button>
            </div>
        </div>
    );
}