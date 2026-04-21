"use client";
import React, { useMemo } from 'react';
import UPlotChart from './UPlotChart';
import uPlot from 'uplot';
import GPSMap from '../features/flight/GPSMap'; 

export interface GraphConfig {
    id: string;
    title: string;
    type?: 'chart' | 'map';
    series: { 
        label: string; 
        color?: string;
        stroke?: string;
        unit?: string; 
        idx?: number; 
    }[];
    dataIdx?: number[]; 
}

interface Props {
    data: uPlot.AlignedData; 
    isDark: boolean;
    customConfigs?: GraphConfig[];
    mapResetKey?: number; 
    fullData?: uPlot.AlignedData | null;
    forceVertical?: boolean;
    isDetachable?: boolean;
}

// --- SUB-COMPONENT 1: MAP CARD ---
// Handles only Map rendering. No chart hooks here.
const MapCard = ({ 
    config, 
    data, 
    fullData, 
    mapResetKey, 
    styles,
    isDetachable
}: { 
    config: GraphConfig, 
    data: uPlot.AlignedData, 
    fullData?: uPlot.AlignedData | null,
    mapResetKey?: number,
    styles: any,
    isDetachable?: boolean
}) => {
    const latIdx = config.dataIdx ? config.dataIdx[0] : -1;
    const lonIdx = config.dataIdx ? config.dataIdx[1] : -1;
    
    // Current Marker Position
    const latArrCurrent = (data[latIdx] as number[]) || [];
    const lonArrCurrent = (data[lonIdx] as number[]) || [];
    const curLat = latArrCurrent.length > 0 ? latArrCurrent[latArrCurrent.length - 1] : 0;
    const curLon = lonArrCurrent.length > 0 ? lonArrCurrent[lonArrCurrent.length - 1] : 0;

    // Full Trajectory Path
    const sourceData = fullData || data; 
    const latArrFull = (sourceData[latIdx] as number[]) || [];
    const lonArrFull = (sourceData[lonIdx] as number[]) || [];

    const trajectory: [number, number][] = latArrFull
        .map((lat, i) => {
            const lon = lonArrFull[i];
            if (typeof lat !== 'number' || typeof lon !== 'number') return null;
            if (lat === 0 && lon === 0) return null;
            return [lat, lon] as [number, number];
        })
        .filter((p): p is [number, number] => p !== null);

    const onDragStart = (e: React.DragEvent) => {
        if (!isDetachable) return;
        const parent = e.currentTarget.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
        
        e.dataTransfer.setData('text/plain', JSON.stringify({ 
            id: config.id, 
            type: 'map',
            width: rect.width,
            height: rect.height
        }));
        
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setData('offset-x', offsetX.toString());
        e.dataTransfer.setData('offset-y', offsetY.toString());

        if (parent) {
            e.dataTransfer.setDragImage(parent, offsetX, offsetY);
        }
    };

    return (
        <div 
            style={{ flexBasis: styles.basis, height: styles.height }}
            className={`${styles.cardBg} border rounded-xl overflow-hidden shadow-lg relative group transition-all ${isDetachable ? 'hover:shadow-xl relative' : ''}`}
        >
            {/* INVISIBLE DRAG HIT-BOX FOR MAP */}
            {isDetachable && (
                <div 
                    draggable
                    onDragStart={onDragStart}
                    className="absolute top-0 left-0 right-0 h-8 z-30 cursor-grab active:cursor-grabbing hover:bg-white/5 dark:hover:bg-white/5 transition-colors pointer-events-auto" 
                />
            )}
            <div className="absolute top-2 left-3 z-10 pointer-events-none">
                <h3 className={`text-[9px] font-black uppercase tracking-[0.15em] ${styles.titleColor} shadow-black drop-shadow-md`}>
                    {config.title}
                </h3>
            </div>
            <div className={`${isDetachable ? 'pointer-events-none group-active:pointer-events-none' : ''} w-full h-full`}>
                <GPSMap lat={curLat} lon={curLon} trajectory={trajectory} key={mapResetKey} />
            </div>
        </div>
    );
};

// --- SUB-COMPONENT 2: CHART CARD ---
// Handles only Chart rendering. Hooks are safe here because they run every time.
const ChartCard = ({ 
    config, 
    data, 
    styles,
    isDetachable
}: { 
    config: GraphConfig, 
    data: uPlot.AlignedData, 
    styles: any,
    isDetachable?: boolean
}) => {
    // 1. Prepare Data (Safe useMemo)
    const chartData = useMemo(() => [ 
        data[0] || [], 
        ...config.series.map((s, i) => {
            const dataIndex = config.dataIdx ? config.dataIdx[i] : s.idx;
            return data[dataIndex!] || [];
        })
    ] as uPlot.AlignedData, [data, config]);

    // 2. Prepare Options (Safe useMemo)
    const options = useMemo<uPlot.Options>(() => ({
        width: 300, 
        height: 150, 
        series: [
            {}, 
            ...config.series.map(s => ({
                stroke: s.color || s.stroke || "#3b82f6",
                width: 2,
                points: { show: false }
            }))
        ],
        axes: [
            { stroke: styles.axisColor, grid: { stroke: styles.gridColor }, font: "9px monospace", size: 18 }, 
            { stroke: styles.axisColor, grid: { stroke: styles.gridColor }, font: "9px monospace", size: 40 }
        ],
        scales: { x: { time: false, auto: true }, y: { auto: true } },
        cursor: { show: true }, 
        legend: { show: false },
        padding: [25, 10, 10, 0]
    }), [styles.axisColor, styles.gridColor, config.series]);

    const onDragStart = (e: React.DragEvent) => {
        if (!isDetachable) return;
        const parent = e.currentTarget.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
        
        e.dataTransfer.setData('text/plain', JSON.stringify({ 
            id: config.id, 
            type: 'graph',
            width: rect.width,
            height: rect.height
        }));

        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setData('offset-x', offsetX.toString());
        e.dataTransfer.setData('offset-y', offsetY.toString());

        if (parent) {
            e.dataTransfer.setDragImage(parent, offsetX, offsetY);
        }
    };

    return (
        <div 
            style={{ flexBasis: styles.basis, height: styles.height }}
            className={`${styles.cardBg} border rounded-xl overflow-hidden shadow-lg flex flex-col relative group transition-all ${isDetachable ? 'hover:shadow-xl relative' : ''}`}
        >
            {/* INVISIBLE DRAG HIT-BOX FOR GRAPHS */}
            {isDetachable && (
                <div 
                    draggable
                    onDragStart={onDragStart}
                    className="absolute top-0 left-0 right-0 h-8 z-30 cursor-grab active:cursor-grabbing hover:bg-white/5 dark:hover:bg-white/5 transition-colors pointer-events-auto" 
                />
            )}

            <div className="absolute top-2 left-3 z-10 pointer-events-none">
                <h3 className={`text-[9px] font-black uppercase tracking-[0.15em] ${styles.titleColor} group-hover:opacity-100 transition-colors`}>
                    {config.title}
                </h3>
            </div>

            <div className="absolute top-2 right-3 z-10 flex flex-col items-end gap-1 pointer-events-none">
                {config.series.map((s, i) => {
                    const dataIndex = config.dataIdx ? config.dataIdx[i] : s.idx;
                    const seriesData = data[dataIndex!] as number[] || [];
                    const rawVal = seriesData[seriesData.length - 1] ?? 0;
                    return (
                        <div key={s.label} className={`flex items-center gap-2 ${styles.pillBg} px-1.5 py-0.5 rounded backdrop-blur-sm border shadow-sm`}>
                            <span className={`text-[7px] font-bold uppercase tracking-wider ${styles.titleColor}`}>{s.label}</span>
                            <span className="text-[10px] font-mono font-bold" style={{ color: s.color || s.stroke }}>
                                {rawVal.toFixed(2)}<span className={`text-[8px] ml-0.5 ${styles.titleColor}`}>{s.unit || ''}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex-1 w-full flex items-center justify-center pb-1">
                <UPlotChart data={chartData} options={options} />
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function GraphGrid({ data, fullData, isDark, customConfigs, mapResetKey, forceVertical, isDetachable }: Props) {
    if (!data) return <div className="w-full h-full flex items-center justify-center text-slate-500">INITIALIZING...</div>;

    const styles = {
        axisColor: isDark ? "#94a3b8" : "#64748b",
        gridColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)",
        cardBg: isDark ? "bg-slate-900/40 backdrop-blur-md border-white/10" : "bg-white border-slate-200 shadow-sm",
        titleColor: isDark ? "text-slate-400" : "text-slate-500",
        pillBg: isDark ? "bg-slate-950/40 border-white/10" : "bg-slate-50 border-slate-200",
        basis: '100%', 
        height: '100%' 
    };

    const defaultConfigs: GraphConfig[] = [
        { 
            id: "flight_dynamics", 
            title: "FLIGHT DYNAMICS", 
            type: 'chart',
            series: [
                { label: "ALT", idx: 1, color: "#3b82f6", unit: "m" },
                { label: "VEL", idx: 2, color: "#10b981", unit: "m/s" }
            ]
        },
        { 
            id: "forces", 
            title: "G-FORCE LOAD", 
            type: 'chart',
            series: [
                { label: "ACCEL", idx: 3, color: "#ef4444", unit: "G" }
            ]
        },
        { 
            id: "environment", 
            title: "ATMOSPHERE", 
            type: 'chart',
            series: [
                { label: "PRESS", idx: 14, color: "#f59e0b", unit: "Pa" }
            ]
        },
    ];

    const activeConfigs = customConfigs && customConfigs.length > 0 ? customConfigs : defaultConfigs;
    const count = activeConfigs.length;

    const getLayoutSettings = (n: number) => {
        if (forceVertical) {
            // Force 24% height for all counts to maintain identical size to the 4-stack
            return { basis: '100%', height: '24%' };
        }

        switch (n) {
            case 1: return { basis: '100%', height: '100%' };
            case 2: return { basis: '49%',  height: '100%' }; 
            case 3: return { basis: '32%',  height: '100%' }; 
            case 4: return { basis: '49%',  height: '48%' };  
            case 5: return { basis: '32%',  height: '48%' };  
            case 6: return { basis: '32%',  height: '48%' };  
            case 7: return { basis: '24%',  height: '48%' };  
            case 8: return { basis: '24%',  height: '48%' };  
            case 9: return { basis: '32%',  height: '32%' };  
            case 10: return { basis: '19%', height: '48%' };  
            case 11: return { basis: '24%', height: '32%' };  
            case 12: return { basis: '24%', height: '32%' };  
            case 13: return { basis: '19%', height: '32%' };  
            case 14: return { basis: '19%', height: '32%' };  
            case 15: return { basis: '19%', height: '32%' };  
            case 16: return { basis: '24%', height: '24%' };  
            default: return { basis: '19%', height: '24%' }; 
        }
    };

    const layout = getLayoutSettings(count);
    styles.basis = layout.basis;
    styles.height = layout.height;

    return (
        <div className={`flex flex-wrap justify-center content-start gap-4 w-full h-full px-2 overflow-hidden pb-4 pt-2`}>
            {activeConfigs.map((g) => (
                <React.Fragment key={g.id}>
                    {g.type === 'map' ? (
                        <MapCard 
                            config={g}
                            data={data}
                            fullData={fullData}
                            mapResetKey={mapResetKey}
                            styles={styles}
                        />
                    ) : (
                        <ChartCard 
                            config={g}
                            data={data}
                            styles={styles}
                            isDetachable={isDetachable}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}