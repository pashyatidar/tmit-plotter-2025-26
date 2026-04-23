import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ParameterType, PARAM_DEFINITIONS } from '../../../utils/parameters';
import { AVAILABLE_PARAMETERS, PACKET_PRESETS } from '../flightConstants';

export interface SequenceItem {
    type: ParameterType | '';
    unit: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onExecute: (sequence: SequenceItem[], unit: 'ms' | 's', isPreset: boolean) => void;
}

export default function FlightConfigModal({ isOpen, onClose, onExecute }: Props) {
    const [configMode, setConfigMode] = useState<'preset' | 'custom'>('preset'); 
    const [timestampUnit, setTimestampUnit] = useState<'ms' | 's'>('ms'); 
    const [dataSequence, setDataSequence] = useState<SequenceItem[]>([{ type: '', unit: '' }]);

    if (!isOpen) return null;

    const handleTypeChange = (index: number, newType: string) => { 
        const newSeq = [...dataSequence];
        newSeq[index].type = newType as ParameterType | '';
        if (newType === 'POS_X' || newType === 'POS_Y' || newType === 'POS_Z') newSeq[index].unit = 'm'; 
        else if (newType && newType !== 'IGNORE' && PARAM_DEFINITIONS[newType as ParameterType]?.units) {
            newSeq[index].unit = Object.keys(PARAM_DEFINITIONS[newType as ParameterType].units)[0] || '';
        } else newSeq[index].unit = '';
        if (newType !== 'IGNORE' && newType !== '' && index === newSeq.length - 1) newSeq.push({ type: '', unit: '' });
        setDataSequence(newSeq);
    };

    const handleUnitChange = (index: number, newUnit: string) => { 
        const newSeq = [...dataSequence];
        newSeq[index].unit = newUnit;
        setDataSequence(newSeq);
    };

    const isSequenceComplete = dataSequence.length > 0 && dataSequence[dataSequence.length - 1].type === 'IGNORE';

    const handleConnection = () => {
        let finalSequence: SequenceItem[];
        let finalUnit: 'ms' | 's';

        if (configMode === 'preset') {
            const preset = PACKET_PRESETS.find(p => p.id === 'standard_flight');
            finalSequence = (preset?.sequence.filter(s => s.type !== 'IGNORE' && s.type !== '') || []) as SequenceItem[];
            finalUnit = (preset?.unit as 'ms' | 's') || 'ms';
        } else {
            finalSequence = dataSequence.filter(s => s.type !== 'IGNORE' && s.type !== '');
            finalUnit = timestampUnit;
        }

        onExecute(finalSequence, finalUnit, configMode === 'preset');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
                
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Configure Data Packet</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select a preset or build a custom sequence.</p>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    
                    <button 
                        onClick={() => setConfigMode('preset')}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${configMode === 'preset' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300'}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-800 dark:text-white">🚀 Standard Flight Telemetry</span>
                            {configMode === 'preset' && <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-relaxed">
                            TIMESTAMP, {PACKET_PRESETS.find(p => p.id === 'standard_flight')?.sequence.map(s => s.type).join(', ')}
                        </div>
                    </button>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">OR BUILD CUSTOM</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    {configMode === 'preset' ? (
                        <button 
                            onClick={() => setConfigMode('custom')}
                            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 transition-all flex justify-between items-center"
                        >
                            <span className="font-bold text-slate-800 dark:text-white">🛠️ Build Custom Configuration</span>
                        </button>
                    ) : (
                        <div className="rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-md p-4 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-800 dark:text-white">🛠️ Custom Configuration</span>
                                <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            
                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl">
                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">INCOMING TIME UNIT</span>
                                <select 
                                    value={timestampUnit}
                                    onChange={(e) => setTimestampUnit(e.target.value as 'ms' | 's')}
                                    className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-400 focus:outline-none"
                                >
                                    <option value="ms">Milliseconds (ms)</option>
                                    <option value="s">Seconds (s)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                {/* Fixed TIMESTAMP row — always the first CSV value */}
                                <div className="flex items-center gap-2 p-3 rounded-xl border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50">
                                    <span className="text-[10px] font-mono font-bold text-blue-400 w-10 shrink-0">VAL 0</span>
                                    <div className="flex-1 min-w-0 bg-blue-100/70 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm text-blue-600 dark:text-blue-400 font-bold">⏱ TIMESTAMP (always first value)</div>
                                </div>
                                {dataSequence.map((item, idx) => {
                                    const isPos = item.type?.startsWith('POS_');
                                    const paramDef = item.type !== 'IGNORE' && item.type !== '' ? PARAM_DEFINITIONS[item.type as ParameterType] : undefined;
                                    const hasUnits = isPos || (paramDef && paramDef.units && Object.keys(paramDef.units).length > 0);

                                    return (
                                        <div key={idx} className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${item.type === 'IGNORE' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'}`}>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 w-10 shrink-0">VAL {idx + 1}</span>
                                            
                                            <select 
                                                value={item.type}
                                                onChange={(e) => handleTypeChange(idx, e.target.value)}
                                                disabled={isSequenceComplete && idx !== dataSequence.length - 1} 
                                                className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                            >
                                                {AVAILABLE_PARAMETERS.map((param: any) => (
                                                    <option key={param.id} value={param.id}>{param.label}</option>
                                                ))}
                                            </select>

                                            {item.type && item.type !== 'IGNORE' && hasUnits && (
                                                <select
                                                    value={item.unit}
                                                    onChange={(e) => handleUnitChange(idx, e.target.value)}
                                                    disabled={isSequenceComplete && idx !== dataSequence.length - 1} 
                                                    className="w-[120px] shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                                >
                                                    {isPos ? <option value="m">Meters (m)</option> : paramDef?.units && Object.keys(paramDef.units).map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 flex justify-between items-center gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        CANCEL
                    </button>
                    
                    {(configMode === 'preset' || (configMode === 'custom' && isSequenceComplete)) ? (
                        <button 
                            onClick={handleConnection}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
                        >
                            <CheckCircle2 size={16} /> START CONNECTION
                        </button>
                    ) : (
                        <span className="text-[10px] text-slate-400 italic">Select 'IGNORE' to proceed...</span>
                    )}
                </div>
            </div>
        </div>
    );
}
