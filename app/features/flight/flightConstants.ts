import { GraphConfig } from '../../components/GraphGrid';
import { ParameterType } from '../../utils/parameters';

export const AVAILABLE_PARAMETERS = [
    { id: '', label: '-- Select Parameter --' },
    { id: 'ALTITUDE', label: 'Altitude' },
    { id: 'COMPUTED_ALT', label: 'Computed Altitude' },
    { id: 'VELOCITY', label: 'Velocity' },
    { id: 'ACCEL_X', label: 'Accel X' },
    { id: 'ACCEL_Y', label: 'Accel Y' },
    { id: 'ACCEL_Z', label: 'Accel Z' },
    { id: 'GYRO_X', label: 'Gyro X' },
    { id: 'GYRO_Y', label: 'Gyro Y' },
    { id: 'GYRO_Z', label: 'Gyro Z' },
    { id: 'MAG_X', label: 'Mag X' },
    { id: 'MAG_Y', label: 'Mag Y' },
    { id: 'MAG_Z', label: 'Mag Z' },
    { id: 'GPS_LAT', label: 'GPS Latitude' },
    { id: 'GPS_LON', label: 'GPS Longitude' },
    { id: 'GPS_ALT', label: 'GPS Altitude' },
    { id: 'GPS_FIX', label: 'GPS Fix' },
    { id: 'POS_X', label: 'Position X' },
    { id: 'POS_Y', label: 'Position Y' },
    { id: 'POS_Z', label: 'Position Z' },
    { id: 'TEMPERATURE', label: 'Temperature' },
    { id: 'PRESSURE', label: 'Pressure' },
    { id: 'STATE', label: 'Flight State' },
    { id: 'BITMASK', label: 'Sensor Health Bitmask' },
    { id: 'IGNORE', label: '🔚 END OF PACKET (IGNORE REST)' },
];

export const PACKET_PRESETS = [ 
    { id: 'custom', name: '🛠️ Custom Configuration', unit: 'ms', sequence: [{ type: '', unit: '' }] },
    {
        id: 'standard_flight',
        name: '🚀 Standard Flight Telemetry',
        unit: 'ms',
        sequence: [
            { type: 'BITMASK', unit: '' },
            { type: 'PRESSURE', unit: 'Pa' }, { type: 'TEMPERATURE', unit: '°C' },
            { type: 'IMU_ACCEL_X', unit: 'm/s²' }, { type: 'IMU_ACCEL_Y', unit: 'm/s²' }, { type: 'IMU_ACCEL_Z', unit: 'm/s²' },
            { type: 'GYRO_X', unit: 'deg/s' }, { type: 'GYRO_Y', unit: 'deg/s' }, { type: 'GYRO_Z', unit: 'deg/s' },
            { type: 'ACCEL_X', unit: 'm/s²' }, { type: 'ACCEL_Y', unit: 'm/s²' }, { type: 'ACCEL_Z', unit: 'm/s²' },
            { type: 'COMPUTED_ALT', unit: 'm' },
            { type: 'GPS_LAT', unit: 'deg' }, { type: 'GPS_LON', unit: 'deg' }, { type: 'GPS_ALT', unit: 'm' },
            { type: 'GPS_FIX', unit: '' }
        ]
    }
];

export const GRAPH_REGISTRY: Record<string, {
    group: string; title: string; label: string; unit: string; color: string; plotIdx: number;
}> = {
    ALTITUDE:    { group: 'Altitude',       title: 'ALTITUDE',        label: 'RAW',   unit: 'm',    color: '#3b82f6', plotIdx: 1  },
    COMPUTED_ALT:{ group: 'Computed Altitude',title: 'COMPUT. ALTITUDE',label: 'CALC',  unit: 'm',    color: '#60a5fa', plotIdx: 32 },
    GPS_ALT:     { group: 'Altitude',       title: 'ALTITUDE',        label: 'G.ALT', unit: 'm',    color: '#14b8a6', plotIdx: 19 },
    VELOCITY:    { group: 'Velocity',       title: 'VELOCITY',        label: 'VEL',   unit: 'm/s',  color: '#10b981', plotIdx: 2  },
    ACCEL_X:     { group: 'Acceleration',   title: 'ACCELERATION',    label: 'AX',    unit: 'm/s²', color: '#f87171', plotIdx: 22 },
    ACCEL_Y:     { group: 'Acceleration',   title: 'ACCELERATION',    label: 'AY',    unit: 'm/s²', color: '#fb923c', plotIdx: 23 },
    ACCEL_Z:     { group: 'Acceleration',   title: 'ACCELERATION',    label: 'AZ',    unit: 'm/s²', color: '#ef4444', plotIdx: 3  },
    IMU_ACCEL_X: { group: 'IMU Acceleration', title: 'IMU ACCELERATION', label: 'IMU X', unit: 'm/s²', color: '#fca5a5', plotIdx: 29 },
    IMU_ACCEL_Y: { group: 'IMU Acceleration', title: 'IMU ACCELERATION', label: 'IMU Y', unit: 'm/s²', color: '#fdba74', plotIdx: 30 },
    IMU_ACCEL_Z: { group: 'IMU Acceleration', title: 'IMU ACCELERATION', label: 'IMU Z', unit: 'm/s²', color: '#f87171', plotIdx: 31 },
    GYRO_X:      { group: 'Gyroscope',      title: 'GYROSCOPE',       label: 'GX',    unit: '°/s',  color: '#8b5cf6', plotIdx: 8  },
    GYRO_Y:      { group: 'Gyroscope',      title: 'GYROSCOPE',       label: 'GY',    unit: '°/s',  color: '#7c3aed', plotIdx: 9  },
    GYRO_Z:      { group: 'Gyroscope',      title: 'GYROSCOPE',       label: 'GZ',    unit: '°/s',  color: '#6d28d9', plotIdx: 10 },
    MAG_X:       { group: 'Magnetometer',   title: 'MAGNETOMETER',    label: 'MX',    unit: 'µT',   color: '#d97706', plotIdx: 11 },
    MAG_Y:       { group: 'Magnetometer',   title: 'MAGNETOMETER',    label: 'MY',    unit: 'µT',   color: '#b45309', plotIdx: 12 },
    MAG_Z:       { group: 'Magnetometer',   title: 'MAGNETOMETER',    label: 'MZ',    unit: 'µT',   color: '#92400e', plotIdx: 13 },
    PRESSURE:    { group: 'Environment',    title: 'ENVIRONMENT',     label: 'PRESS', unit: 'Pa',   color: '#f59e0b', plotIdx: 14 },
    TEMPERATURE: { group: 'Environment',    title: 'ENVIRONMENT',     label: 'TEMP',  unit: '°C',   color: '#a855f7', plotIdx: 15 },
    POS_X:       { group: 'Position',       title: 'POSITION',        label: 'X',     unit: 'm',    color: '#ec4899', plotIdx: 24 },
    POS_Y:       { group: 'Position',       title: 'POSITION',        label: 'Y',     unit: 'm',    color: '#f472b6', plotIdx: 25 },
    POS_Z:       { group: 'Position',       title: 'POSITION',        label: 'Z',     unit: 'm',    color: '#db2777', plotIdx: 26 },
};

export const SIM_EXTRA_PARAMS: string[] = [
    'ALTITUDE', 'COMPUTED_ALT', 'VELOCITY',
    'ACCEL_X', 'ACCEL_Y', 'ACCEL_Z',
    'IMU_ACCEL_X', 'IMU_ACCEL_Y', 'IMU_ACCEL_Z',
    'GYRO_X', 'GYRO_Y', 'GYRO_Z',
    'MAG_X', 'MAG_Y', 'MAG_Z',
    'PRESSURE', 'TEMPERATURE',
    'GPS_ALT',
];

export function buildConsoleGraphs(activeTypes: string[]): GraphConfig[] {
    const excluded = new Set(['TIMESTAMP', 'IGNORE', 'STATE']);
    const plottable = activeTypes.filter(t => !excluded.has(t) && GRAPH_REGISTRY[t]);

    const groups = new Map<string, { title: string; series: GraphConfig['series'] }>();
    for (const t of plottable) {
        const reg = GRAPH_REGISTRY[t];
        if (!groups.has(reg.group)) {
            groups.set(reg.group, { title: reg.title, series: [] });
        }
        groups.get(reg.group)!.series.push({
            label: reg.label,
            idx: reg.plotIdx,
            color: reg.color,
            unit: reg.unit,
        });
    }

    const configs: GraphConfig[] = [];
    for (const [groupName, { title, series }] of groups) {
        configs.push({
            id: groupName.toLowerCase().replace(/\s+/g, '_'),
            title,
            type: 'chart',
            series,
        });
    }

    return configs;
}
