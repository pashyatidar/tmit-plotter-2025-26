"use client";
import React, { useMemo } from 'react';
import UPlotChart from '../../components/UPlotChart';
import uPlot from 'uplot';
import { TelemetryParam } from '../flight/TelemetryStrip';

interface Props {
    data: uPlot.AlignedData;
    activeParam: TelemetryParam | null;
    isDark: boolean;
}

export default function PeekGraph({ data, activeParam, isDark }: Props) {
    const axisColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)";

    // Safety: Ensure data exists before slicing
    const chartData = useMemo(() => {
        if (!activeParam || !data || !data[0] || data[0].length === 0) return null;
        const targetSeries = data[activeParam.plotIdx];
        if (!targetSeries) return null;
        return [data[0], targetSeries] as uPlot.AlignedData;
    }, [data, activeParam]);

    const liveValue = chartData && chartData[1].length > 0
        ? chartData[1][chartData[1].length - 1]?.toFixed(2) 
        : "—";

    const options = useMemo<uPlot.Options>(() => {
        if (!activeParam) return {} as any;

        return {
            width: 280,
            height: 140,
            series: [
                {}, 
                {
                    stroke: activeParam.color,
                    width: 2, 
                    points: { show: false },
                    fill: (u: uPlot) => {
                        const ctx = u.ctx;
                        if (!u.bbox) return `${activeParam.color}20`;
                        const gradient = ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
                        gradient.addColorStop(0, `${activeParam.color}30`); 
                        gradient.addColorStop(1, `${activeParam.color}05`); 
                        return gradient;
                    },
                }
            ],
            axes: [
                { stroke: axisColor, grid: { stroke: gridColor }, font: "8px monospace", size: 16 },
                { stroke: axisColor, grid: { stroke: gridColor }, font: "8px monospace", size: 36 }
            ],
            scales: { x: { time: false, auto: true }, y: { auto: true } },
            cursor: { show: true },
            legend: { show: false },
            padding: [8, 4, 4, 0]
        };
    }, [activeParam, axisColor, gridColor]);

    return (
        <div 
            className={`fixed right-16 z-30 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
                activeParam ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'
            }`}
            style={{ top: '40%', transform: activeParam ? 'translateY(-50%)' : 'translateX(120%) translateY(-50%)' }}
        >
            {activeParam && (
                <div className="w-[280px] bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl transition-colors">
                    
                    {/* Header bar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeParam.color }} />
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                                {activeParam.label}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-mono font-black" style={{ color: activeParam.color }}>
                                {liveValue}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                                {activeParam.unit}
                            </span>
                        </div>
                    </div>

                    {/* Chart area */}
                    <div className="w-full h-[140px] flex justify-center items-center">
                        {chartData ? (
                            <UPlotChart data={chartData} options={options} />
                        ) : (
                            <span className="text-xs font-mono text-slate-400">Awaiting Telemetry...</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}