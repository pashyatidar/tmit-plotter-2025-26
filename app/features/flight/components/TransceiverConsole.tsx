"use client";
import { useState, useEffect, useRef } from 'react';
import { X, Send, Terminal, MessageSquare } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    sendCommand: (cmd: string) => void;
    logs: string[];
}

export default function TransceiverConsole({ isOpen, onClose, sendCommand, logs }: Props) {
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isOpen]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendCommand(input);
        setInput("");
    };

    return (
        <>
            {/* OVERLAY BACKDROP */}
            {isOpen && <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/50 backdrop-blur-sm z-[200] transition-opacity" onClick={onClose} />}

            {/* SLIDE-IN PANEL */}
            <div className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[210] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                        <MessageSquare size={18} className="text-blue-600 dark:text-blue-400" /> TRANSCEIVER CHAT
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* LOG OUTPUT AREA */}
                <div className="flex-1 p-4 overflow-y-auto font-mono text-xs bg-slate-100 dark:bg-black text-green-700 dark:text-green-400 space-y-1 shadow-inner" ref={scrollRef}>
                    {logs.length === 0 && <span className="text-slate-400 dark:text-slate-600 italic">No communication logged...</span>}
                    {logs.map((log, i) => {
                        // Attempt to colorize sent vs received
                        const isSent = log.startsWith('>');
                        const isRecv = log.startsWith('<');
                        return (
                            <div key={i} className={`break-all border-b border-slate-200 dark:border-slate-900 pb-0.5 ${isSent ? 'text-blue-600 dark:text-blue-400' : isRecv ? 'text-green-600 dark:text-green-400' : ''}`}>
                                {log}
                            </div>
                        );
                    })}
                </div>

                {/* RAW INPUT AREA */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold">Raw Command (RYLR / AT)</div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type AT command..."
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono transition-colors"
                        />
                        <button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors shadow-sm">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
