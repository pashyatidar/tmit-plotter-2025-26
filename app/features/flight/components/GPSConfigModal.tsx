import React, { useState } from 'react';
import { Usb } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (unit: 'ms' | 'us' | 's') => void;
}

export default function GPSConfigModal({ isOpen, onClose, onConnect }: Props) {
    const [timeUnit, setTimeUnit] = useState<'ms' | 'us' | 's'>('ms');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Port Configuration</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Select stream timestamp unit before connecting your serial port.</p>

                <div className="space-y-3 mb-6">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Timestamp Unit</label>
                    <div className="flex gap-2">
                        <button onClick={() => setTimeUnit('us')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${timeUnit === 'us' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>µs</button>
                        <button onClick={() => setTimeUnit('ms')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${timeUnit === 'ms' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>ms</button>
                        <button onClick={() => setTimeUnit('s')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${timeUnit === 's' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>s</button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Cancel</button>
                    <button onClick={() => onConnect(timeUnit)} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all">
                        <Usb size={14} /> CONNECT PORT
                    </button>
                </div>
            </div>
        </div>
    );
}
