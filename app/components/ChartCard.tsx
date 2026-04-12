"use client";
import React, { useMemo } from 'react';
import UPlotChart from './UPlotChart';
import uPlot from 'uplot';
import { GraphConfig } from './GraphGrid'; // Imports the interface from GraphGrid

interface ChartCardProps {
    config: GraphConfig;
    data: uPlot.AlignedData;
    styles?: any; // Made optional so PeekGraph can use it without styles
}

export default function ChartCard({ config, data, styles }: ChartCardProps) {
    // Fallback styles if none are provided by the parent
    const safeStyles = styles || {
        axisColor: "#94a3b8", 
        gridColor: "rgba(255,255,255,0.05)",
        cardBg: "w-full h-full bg-transparent", 
        titleColor: "text-slate-400",
        pillBg: "bg-slate-900/60 border-white/10",
        basis: '100%',
        height: '100%'
    };

    // 1. Prepare Data
    // 1. Prepare Data with SAFE ZERO-PADDING
    const chartData = useMemo(() => {
        if (!data || !data[0]) return [[]] as unknown as uPlot.AlignedData;
        
        const timeArrayLength = data[0].length;

        return [ 
            data[0], 
            ...config.series.map((s, i) => {
                const dataIndex = config.dataIdx ? config.dataIdx[i] : s.idx;
                const seriesData = data[dataIndex!];
                
                // THE FIX: If the hardware didn't send enough parameters to fill this index,
                // seamlessly pad the graph with zeroes so uPlot doesn't crash.
                if (!seriesData || seriesData.length !== timeArrayLength) {
                    return Array(timeArrayLength).fill(0);
                }
                
                return seriesData;
            })
        ] as uPlot.AlignedData;
    }, [data, config]);

    // 2. Prepare uPlot Options
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
            { stroke: safeStyles.axisColor, grid: { stroke: safeStyles.gridColor }, font: "9px monospace", size: 18 }, 
            { stroke: safeStyles.axisColor, grid: { stroke: safeStyles.gridColor }, font: "9px monospace", size: 40 }
        ],
        scales: { x: { time: false, auto: true }, y: { auto: true } },
        cursor: { show: true }, 
        legend: { show: false },
        padding: [25, 10, 10, 0]
    }), [safeStyles.axisColor, safeStyles.gridColor, config.series]);

    return (
        <div 
            style={styles ? { flexBasis: safeStyles.basis, height: safeStyles.height, minHeight: '140px' } : { width: '100%', height: '100%' }}
            className={`${safeStyles.cardBg} border-none rounded-xl overflow-hidden flex flex-col relative group transition-all`}
        >
            {/* Title (Top Left) */}
            <div className="absolute top-2 left-3 z-10 pointer-events-none">
                <h3 className={`text-[9px] font-black uppercase tracking-[0.15em] ${safeStyles.titleColor} group-hover:opacity-100 transition-colors`}>
                    {config.title}
                </h3>
            </div>

            {/* Floating Live Values (Top Right) */}
            <div className="absolute top-2 right-3 z-10 flex flex-col items-end gap-1 pointer-events-none">
                {config.series.map((s, i) => {
                    const dataIndex = config.dataIdx ? config.dataIdx[i] : s.idx;
                    const seriesData = data[dataIndex!] as number[] || [];
                    const rawVal = seriesData[seriesData.length - 1] ?? 0;
                    return (
                        <div key={s.label} className={`flex items-center gap-2 ${safeStyles.pillBg} px-1.5 py-0.5 rounded backdrop-blur-sm border shadow-sm`}>
                            <span className={`text-[7px] font-bold uppercase tracking-wider ${safeStyles.titleColor}`}>{s.label}</span>
                            <span className="text-[10px] font-mono font-bold" style={{ color: s.color || s.stroke }}>
                                {rawVal.toFixed(2)}<span className={`text-[8px] ml-0.5 ${safeStyles.titleColor}`}>{s.unit || ''}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
            
            {/* Chart Canvas Container */}
            <div className="flex-1 w-full flex items-center justify-center pb-1">
                <UPlotChart data={chartData} options={options} />
            </div>
        </div>
    );
}