"use client";
import { ReactNode } from 'react';
import Image from 'next/image';

interface Props {
    actions?: ReactNode; 
    isDark?: boolean;
    toggleTheme?: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function Header({ actions, isDark, toggleTheme, activeTab, onTabChange }: Props) {
    const getTabClass = (tabName: string) => {
        const isActive = activeTab === tabName;
        return `px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
            isActive 
            ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm dark:shadow-none" 
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`;
    };

    return (
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 grid grid-cols-[1.5fr_auto_1.5fr] items-center px-6 shrink-0 transition-colors duration-300">
            
            {/* LEFT: Logo & Brand */}
            <div className="flex items-center gap-3 overflow-hidden">
                
                {/* 1. SYMBOL LOGO */}
                <div className="relative w-10 h-10 shrink-0">
                    <Image 
                        src={isDark ? "/logo-symbol-white.png" : "/logo-symbol-black.png"} 
                        alt="Arjuna Symbol"
                        fill
                        className="object-contain" 
                        priority 
                    />
                </div>
                
                {/* 2. TEXT LOGO */}
                <div className="hidden lg:flex flex-col justify-center shrink-0">
                    {/* Removed the bottom margin so it centers perfectly */}
                    <div className="relative w-32 h-6">
                        <Image 
                            src={isDark ? "/logo-text-white.png" : "/logo-text-black.png"} 
                            alt="Arjuna Text Logo"
                            fill
                            className="object-contain object-left" 
                            priority 
                        />
                    </div>
                </div>
                
            </div>

            {/* CENTER: Navigation (Pinned) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg justify-self-center transition-colors">
                <button onClick={() => onTabChange('FLIGHT')} className={getTabClass('FLIGHT')}>FLIGHT</button>
                <button onClick={() => onTabChange('MOTOR')} className={getTabClass('MOTOR')}>MOTOR</button>
                <button onClick={() => onTabChange('ANALYZE')} className={getTabClass('ANALYZE')}>ANALYZE</button>
            </div>

            {/* RIGHT: Dynamic Actions (Aligned Right) */}
            <div className="flex items-center gap-4 justify-self-end">
                <div className="flex items-center gap-2">{actions}</div>
                {toggleTheme && (
                    <>
                        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 transition-colors"></div>
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all">
                            {isDark ? "☀️" : "🌙"}
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}