export type MotorFSMState = 
  | 'BOOT' 
  | 'SAFE' 
  | 'FILL' 
  | 'VENT' 
  | 'LAUNCH' 
  | 'CONVERT' 
  | 'END' 
  | 'FAILURE' 
  | 'ABORT' 
  | 'UNKNOWN';

export interface ValveStatus {
  fillAngle: number;
  fillOpen: boolean;
  svAngle: number;
  svOpen: boolean;
  ventOpen: boolean;
  oxAngle: number;
  oxOpen: boolean;
  igniterActive: boolean;
}

export interface MotorTelemetry {
  timestamp: number;
  raw: string;
  state: MotorFSMState;
  rpt: number;      // Run Tank Pressure (psi)
  ipt: number;      // Injector Pressure (psi)
  ppt: number;      // Pipe Pressure (psi)
  mass: number;     // Tank Mass (kg)
  thrust?: number;  // Thrust Load Cell (N)
  valves: ValveStatus;
  temperatures?: [number, number, number, number]; // T1-T4 (°C)
  rssi?: number;    // LoRa RSSI (dBm)
  snr?: number;     // LoRa SNR
}

export function parseMotorTelemetry(rawLine: string): MotorTelemetry | null {
  if (!rawLine || typeof rawLine !== 'string') return null;
  const clean = rawLine.trim();
  if (!clean.includes('ST=')) return null;

  // Check for LoRa wrapper
  let rssi: number | undefined;
  let snr: number | undefined;
  const loraMatch = clean.match(/\+RCV=\d+,\d+,(.*?),(-?\d+),(-?\d+)/);
  let payload = clean;
  if (loraMatch) {
    payload = loraMatch[1];
    rssi = parseInt(loraMatch[2], 10);
    snr = parseInt(loraMatch[3], 10);
  }

  const getMatch = (reg: RegExp) => {
    const m = payload.match(reg);
    return m ? m[1] : null;
  };

  const rawState = getMatch(/ST=([A-Za-z0-9_]+)/);
  const state = (rawState ? rawState.toUpperCase() : 'UNKNOWN') as MotorFSMState;

  const rpt = getMatch(/RPT=(-?\d+(?:\.\d+)?)/);
  const ipt = getMatch(/IPT=(-?\d+(?:\.\d+)?)/);
  const ppt = getMatch(/PPT=(-?\d+(?:\.\d+)?)/);
  const mass = getMatch(/MASS=(-?\d+(?:\.\d+)?)/);
  const thrust = getMatch(/THRUST=(-?\d+(?:\.\d+)?)/);

  // Strict validation: Incomplete or cut-off serial lines must be discarded rather than defaulting to 0
  if (rpt === null || mass === null) {
    return null;
  }

  const parsedRpt = parseFloat(rpt);
  const parsedMass = parseFloat(mass);
  if (isNaN(parsedRpt) || isNaN(parsedMass)) {
    return null;
  }

  const fill = getMatch(/FILL=(\d+)/);
  const sv = getMatch(/SV=(\d+)/);
  const vent = getMatch(/VENT=(OPEN|CLOSED)/i);
  const ox = getMatch(/OX=(\d+)/);
  const ign = getMatch(/IGN=(1|0|ON|OFF)/i);

  const fillAngle = fill ? parseInt(fill, 10) : 0;
  const svAngle = sv ? parseInt(sv, 10) : 0;
  const oxAngle = ox ? parseInt(ox, 10) : 0;

  return {
    timestamp: Date.now(),
    raw: clean,
    state,
    rpt: parsedRpt,
    ipt: ipt ? parseFloat(ipt) : 0,
    ppt: ppt ? parseFloat(ppt) : 0,
    mass: parsedMass,
    thrust: thrust ? parseFloat(thrust) : 0,
    valves: {
      fillAngle,
      fillOpen: fillAngle > 0,
      svAngle,
      svOpen: svAngle > 0,
      ventOpen: vent ? vent.toUpperCase() === 'OPEN' : false,
      oxAngle,
      oxOpen: oxAngle > 0,
      igniterActive: ign ? (ign === '1' || ign.toUpperCase() === 'ON') : false,
    },
    rssi,
    snr,
  };
}

export const MOTOR_COMMANDS = {
  SAFE: 'SAFE\n',
  FILL: 'FILL\n',
  LAUNCH: 'LAUNCH\n',
  STOP: 'STOP\n',
  VENT_OVERRIDE: 'VENT_OVERRIDE\n',
  CONVERT: 'CONVERT\n',
  ABORT: 'ABORT\n',
} as const;