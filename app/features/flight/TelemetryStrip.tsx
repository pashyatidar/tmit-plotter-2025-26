"use client";
import { useState, useEffect, useMemo } from 'react';
import { 
    Navigation, Wind, Zap, Gauge, Thermometer, 
    Disc, Compass, Satellite, Mountain,
    Activity, Box, LucideIcon
} from 'lucide-react';
import { FlightDataPoint } from '../../hooks/useFlightData';

// ─── PARAMETER REGISTRY (kept for PeekGraph compatibility) ───────
export const TELEMETRY_PARAMS = [
    { key: 'altitude',  paramType: 'ALTITUDE',    label: 'ALTITUDE',  unit: 'm',     color: '#3b82f6', plotIdx: 1,  icon: Navigation,  group: 'flight' },
    { key: 'velocity',  paramType: 'VELOCITY',    label: 'VELOCITY',  unit: 'm/s',   color: '#10b981', plotIdx: 2,  icon: Wind,        group: 'flight' },
    { key: 'accel_z',   paramType: 'ACCEL_Z',     label: 'ACCEL Z',   unit: 'm/s²',  color: '#ef4444', plotIdx: 3,  icon: Zap,         group: 'accel' },
    { key: 'ax',        paramType: 'ACCEL_X',     label: 'ACCEL X',   unit: 'm/s²',  color: '#f87171', plotIdx: 22, icon: Zap,         group: 'accel' },
    { key: 'ay',        paramType: 'ACCEL_Y',     label: 'ACCEL Y',   unit: 'm/s²',  color: '#fb923c', plotIdx: 23, icon: Zap,         group: 'accel' },
    { key: 'pressure',  paramType: 'PRESSURE',    label: 'PRESSURE',  unit: 'kPa',   color: '#f59e0b', plotIdx: 14, icon: Gauge,       group: 'env' },
    { key: 'temp',      paramType: 'TEMPERATURE', label: 'TEMP',      unit: '°C',    color: '#a855f7', plotIdx: 15, icon: Thermometer, group: 'env' },
    { key: 'airbrake_extension', paramType: 'AIRBRAKE', label: 'BRAKE', unit: '%',   color: '#06b6d4', plotIdx: 4,  icon: Activity,    group: 'aero' },
    { key: 'gx',        paramType: 'GYRO_X',      label: 'GYRO X',    unit: '°/s',   color: '#8b5cf6', plotIdx: 8,  icon: Disc,        group: 'gyro' },
    { key: 'gy',        paramType: 'GYRO_Y',      label: 'GYRO Y',    unit: '°/s',   color: '#7c3aed', plotIdx: 9,  icon: Disc,        group: 'gyro' },
    { key: 'gz',        paramType: 'GYRO_Z',      label: 'GYRO Z',    unit: '°/s',   color: '#6d28d9', plotIdx: 10, icon: Disc,        group: 'gyro' },
    { key: 'mx',        paramType: 'MAG_X',       label: 'MAG X',     unit: 'µT',    color: '#d97706', plotIdx: 11, icon: Compass,     group: 'mag' },
    { key: 'my',        paramType: 'MAG_Y',       label: 'MAG Y',     unit: 'µT',    color: '#b45309', plotIdx: 12, icon: Compass,     group: 'mag' },
    { key: 'mz',        paramType: 'MAG_Z',       label: 'MAG Z',     unit: 'µT',    color: '#92400e', plotIdx: 13, icon: Compass,     group: 'mag' },
    { key: 'gps_alt',   paramType: 'GPS_ALT',     label: 'GPS ALT',   unit: 'm',     color: '#14b8a6', plotIdx: 19, icon: Mountain,    group: 'gps' },
    { key: 'sats',      paramType: 'SATS',        label: 'SATS',      unit: '',      color: '#0d9488', plotIdx: 20, icon: Satellite,   group: 'gps' },
    { key: 'pos_x',     paramType: 'POS_X',       label: 'POS X',     unit: 'm',     color: '#ec4899', plotIdx: 24, icon: Box,         group: 'pos' },
    { key: 'pos_y',     paramType: 'POS_Y',       label: 'POS Y',     unit: 'm',     color: '#f472b6', plotIdx: 25, icon: Box,         group: 'pos' },
    { key: 'pos_z',     paramType: 'POS_Z',       label: 'POS Z',     unit: 'm',     color: '#db2777', plotIdx: 26, icon: Box,         group: 'pos' },
];

export type TelemetryParam = typeof TELEMETRY_PARAMS[number];

// ─── CARD DEFINITIONS ────────────────────────────────────────────
// Each card can be a "solo" card (one big value) or a "multi" card 
// (multiple sub-values in one compact card). Grouped by similarity.
interface SubValue {
    dataKey: string;   // FlightDataPoint field
    label: string;     // short axis label: "X", "Y", "Z"
    color: string;
    format?: (v: number) => string;
}
interface CardDef {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;        // accent color
    unit: string;
    requires: string[];   // ParameterType keys — card shows if ANY of these are active
    // Solo card: one big value
    soloKey?: string;     // FlightDataPoint field for solo display
    soloFormat?: (v: number) => string;
    // Multi card: compact X/Y/Z display
    subs?: SubValue[];
    // For PeekGraph hover
    hoverParam?: TelemetryParam;
}

const fmt1 = (v: number) => v.toFixed(1);
const fmt2 = (v: number) => v.toFixed(2);
const fmtKpa = (v: number) => (v / 1000).toFixed(1);
const fmtInt = (v: number) => v.toFixed(0);

const CARD_DEFS: CardDef[] = [
    // ── SOLO CARDS ─────────────────────────────────────
    {
        id: 'altitude', label: 'ALTITUDE', icon: Navigation, color: '#3b82f6', unit: 'm',
        requires: ['ALTITUDE'],
        soloKey: 'altitude', soloFormat: fmt1,
        hoverParam: TELEMETRY_PARAMS[0],
    },
    {
        id: 'velocity', label: 'VELOCITY', icon: Wind, color: '#10b981', unit: 'm/s',
        requires: ['VELOCITY'],
        soloKey: 'velocity', soloFormat: fmt1,
        hoverParam: TELEMETRY_PARAMS[1],
    },
    {
        id: 'pressure', label: 'PRESSURE', icon: Gauge, color: '#f59e0b', unit: 'kPa',
        requires: ['PRESSURE'],
        soloKey: 'pressure', soloFormat: fmtKpa,
        hoverParam: TELEMETRY_PARAMS[5],
    },
    {
        id: 'temp', label: 'TEMP', icon: Thermometer, color: '#a855f7', unit: '°C',
        requires: ['TEMPERATURE'],
        soloKey: 'temp', soloFormat: fmt1,
        hoverParam: TELEMETRY_PARAMS[6],
    },
    // ── GROUPED CARDS ──────────────────────────────────
    {
        id: 'accel', label: 'ACCELERATION', icon: Zap, color: '#ef4444', unit: 'm/s²',
        requires: ['ACCEL_X', 'ACCEL_Y', 'ACCEL_Z'],
        subs: [
            { dataKey: 'ax',      label: 'X', color: '#f87171', format: fmt2 },
            { dataKey: 'ay',      label: 'Y', color: '#fb923c', format: fmt2 },
            { dataKey: 'accel_z', label: 'Z', color: '#ef4444', format: fmt2 },
        ],
        hoverParam: TELEMETRY_PARAMS[2], // ACCEL_Z for PeekGraph
    },
    {
        id: 'gyro', label: 'GYROSCOPE', icon: Disc, color: '#8b5cf6', unit: '°/s',
        requires: ['GYRO_X', 'GYRO_Y', 'GYRO_Z'],
        subs: [
            { dataKey: 'gx', label: 'X', color: '#8b5cf6', format: fmt1 },
            { dataKey: 'gy', label: 'Y', color: '#7c3aed', format: fmt1 },
            { dataKey: 'gz', label: 'Z', color: '#6d28d9', format: fmt1 },
        ],
        hoverParam: TELEMETRY_PARAMS[8],
    },
    {
        id: 'mag', label: 'MAGNETOMETER', icon: Compass, color: '#d97706', unit: 'µT',
        requires: ['MAG_X', 'MAG_Y', 'MAG_Z'],
        subs: [
            { dataKey: 'mx', label: 'X', color: '#d97706', format: fmt1 },
            { dataKey: 'my', label: 'Y', color: '#b45309', format: fmt1 },
            { dataKey: 'mz', label: 'Z', color: '#92400e', format: fmt1 },
        ],
        hoverParam: TELEMETRY_PARAMS[11],
    },
    {
        id: 'gps', label: 'GPS', icon: Satellite, color: '#14b8a6', unit: '',
        requires: ['GPS_ALT', 'GPS_LAT', 'GPS_LON'],
        subs: [
            { dataKey: 'gps_alt', label: 'ALT', color: '#14b8a6', format: fmt1 },
            { dataKey: 'sats',    label: 'SAT', color: '#0d9488', format: fmtInt },
        ],
        hoverParam: TELEMETRY_PARAMS[14],
    },
    {
        id: 'position', label: 'POSITION', icon: Box, color: '#ec4899', unit: 'm',
        requires: ['POS_X', 'POS_Y', 'POS_Z'],
        subs: [
            { dataKey: 'pos_x', label: 'X', color: '#ec4899', format: fmt1 },
            { dataKey: 'pos_y', label: 'Y', color: '#f472b6', format: fmt1 },
            { dataKey: 'pos_z', label: 'Z', color: '#db2777', format: fmt1 },
        ],
        hoverParam: TELEMETRY_PARAMS[17],
    },
    {
        id: 'airbrake', label: 'AIRBRAKE', icon: Activity, color: '#06b6d4', unit: '%',
        requires: ['AIRBRAKE'],
        soloKey: 'airbrake_extension', soloFormat: fmt1,
        hoverParam: TELEMETRY_PARAMS[7],
    },
];

// ─── Shared card shell ───────────────────────────────────────────
const cardStyle = (color: string, index: number, visible: boolean): React.CSSProperties => ({
    width: '230px',
    transitionDelay: `${index * 50}ms`,
    transform: visible ? 'translateX(0)' : 'translateX(-120%)',
    opacity: visible ? 1 : 0,
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
});

const labelColor = 'rgba(148, 163, 184, 0.8)';
const unitColor  = 'rgba(148, 163, 184, 0.6)';
const valFont = "'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif";

// ─── Solo Card (one big number) ──────────────────────────────────
const SoloCard = ({ card, data, index, visible, onHover }: {
    card: CardDef; data: FlightDataPoint | null; index: number;
    visible: boolean; onHover: (p: TelemetryParam | null) => void;
}) => {
    const Icon = card.icon;
    const raw = data ? (data as any)[card.soloKey!] : undefined;
    const num = (raw !== undefined && raw !== null && !isNaN(Number(raw))) ? Number(raw) : 0;
    const formatted = card.soloFormat ? card.soloFormat(num) : num.toFixed(2);
    const parts = formatted.split('.');

    return (
        <div
            className="relative rounded-xl overflow-hidden cursor-crosshair transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] hover:shadow-2xl"
            style={cardStyle(card.color, index, visible)}
            onMouseEnter={() => card.hoverParam && onHover(card.hoverParam)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="absolute top-0 left-0 right-0 h-[2px]"
                 style={{ background: `linear-gradient(90deg, ${card.color}60, transparent)` }} />
            <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={13} style={{ color: card.color }} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: labelColor }}>
                        {card.label}
                    </span>
                </div>
                <div className="flex items-baseline gap-0.5">
                    <span className="text-[32px] font-black tabular-nums tracking-tight leading-none"
                          style={{ color: '#fff', fontFamily: valFont, fontFeatureSettings: '"tnum"' }}>
                        {parts[0]}{parts.length > 1 ? '.' + parts[1] : ''}
                    </span>
                    <span className="text-xs font-bold ml-0.5 self-end mb-0.5" style={{ color: unitColor }}>
                        {card.unit}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── Multi-axis Card (X/Y/Z in one compact card) ────────────────
const MultiCard = ({ card, data, index, visible, onHover }: {
    card: CardDef; data: FlightDataPoint | null; index: number;
    visible: boolean; onHover: (p: TelemetryParam | null) => void;
}) => {
    const Icon = card.icon;
    const subs = card.subs!;

    // Filter subs to only show ones that have data
    const activeSubs = subs.filter(s => {
        if (!data) return true; // show placeholders
        const val = (data as any)[s.dataKey];
        return val !== undefined && val !== null;
    });

    return (
        <div
            className="relative rounded-xl overflow-hidden cursor-crosshair transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] hover:shadow-2xl"
            style={cardStyle(card.color, index, visible)}
            onMouseEnter={() => card.hoverParam && onHover(card.hoverParam)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="absolute top-0 left-0 right-0 h-[2px]"
                 style={{ background: `linear-gradient(90deg, ${card.color}60, transparent)` }} />
            <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        <Icon size={13} style={{ color: card.color }} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: labelColor }}>
                            {card.label}
                        </span>
                    </div>
                    {card.unit && (
                        <span className="text-[9px] font-bold" style={{ color: unitColor }}>{card.unit}</span>
                    )}
                </div>
                {/* Sub-values row */}
                <div className="flex gap-3">
                    {activeSubs.map(sub => {
                        const raw = data ? (data as any)[sub.dataKey] : undefined;
                        const num = (raw !== undefined && raw !== null && !isNaN(Number(raw))) ? Number(raw) : 0;
                        const formatted = sub.format ? sub.format(num) : num.toFixed(2);
                        return (
                            <div key={sub.dataKey} className="flex flex-col items-start">
                                <span className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: sub.color }}>
                                    {sub.label}
                                </span>
                                <span className="text-[18px] font-black tabular-nums tracking-tight leading-none"
                                      style={{ color: '#fff', fontFamily: valFont, fontFeatureSettings: '"tnum"' }}>
                                    {formatted}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────
interface Props {
    data: FlightDataPoint | null;
    onHoverMetric: (param: TelemetryParam | null) => void;
    isActive: boolean;
    activeParamTypes?: string[];
}

export default function TelemetryStrip({ data, onHoverMetric, isActive, activeParamTypes }: Props) {
    const [isMouseInZone, setIsMouseInZone] = useState(false);

    useEffect(() => {
        if (!isActive) { setIsMouseInZone(false); return; }
        const handleMouseMove = (e: MouseEvent) => {
            setIsMouseInZone(e.clientX <= window.innerWidth * 0.20);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isActive]);

    // Only show cards for parameters explicitly selected in the stream config
    const activeSet = useMemo(() => {
        return new Set<string>(activeParamTypes || []);
    }, [activeParamTypes]);

    // Filter cards: show if ANY of their `requires` types are active
    const visibleCards = useMemo(() => {
        if (activeSet.size === 0) return [];
        return CARD_DEFS.filter(card =>
            card.requires.some(r => activeSet.has(r))
        );
    }, [activeSet]);

    const showPanel = isActive && isMouseInZone;

    return (
        <div className="fixed left-0 top-0 bottom-0 z-30 flex items-center pointer-events-none"
             style={{ width: '260px' }}>
            <div className="flex flex-col gap-2 pl-2 pointer-events-auto overflow-y-auto max-h-[calc(100vh-100px)]"
                 style={{ paddingTop: '72px', paddingBottom: '16px', scrollbarWidth: 'none' }}>
                {visibleCards.map((card, idx) =>
                    card.subs ? (
                        <MultiCard key={card.id} card={card} data={data} index={idx}
                                   visible={showPanel} onHover={onHoverMetric} />
                    ) : (
                        <SoloCard key={card.id} card={card} data={data} index={idx}
                                  visible={showPanel} onHover={onHoverMetric} />
                    )
                )}
            </div>
        </div>
    );
}
