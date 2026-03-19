"use client";
import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { PathLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
    lat: number;
    lon: number;
    altitude: number;
    trajectory: [number, number, number][]; 
    rotation?: { x: number, y: number, z: number }; // Made optional
    isDark?: boolean;
}

const getOfflineStyle = (region: string, isDark?: boolean) => {
    const themeFolder = isDark ? 'dark' : 'light';
    return {
        version: 8,
        sources: {
            'offline-raster': {
                type: 'raster',
                tiles: [`/tiles/${region}/${themeFolder}/{z}/{x}/{y}.png`], 
                tileSize: 256,
            }
        },
        layers: [{
            id: 'offline-base',
            type: 'raster',
            source: 'offline-raster',
            minzoom: 0,
            maxzoom: 18
        }]
    };
};

export default function IntegratedMap({ lat, lon, altitude, trajectory, rotation, isDark }: Props) {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const [mapMode, setMapMode] = useState<'online' | 'manipal' | 'spaceport'>('online');
    const [followMode, setFollowMode] = useState(true);

    // --- TELEMETRY TRANSLATION ENGINE ---
    const isSpaceport = mapMode === 'spaceport';
    const latOffset = isSpaceport ? (32.9904 - 13.345103) : 0;
    const lonOffset = isSpaceport ? (-106.9750 - 74.794628) : 0;

    const displayLat = lat !== 0 ? lat + latOffset : 0;
    const displayLon = lon !== 0 ? lon + lonOffset : 0;

    // FIX 1: Corrected the array mapping. useFlightData passes [Lat, Alt, Lon]
    const deckTrajectory = trajectory.map(p => [
        p[2] + lonOffset, // Longitude is index 2
        p[0] + latOffset, // Latitude is index 0
        p[1]              // Altitude is index 1
    ]);

    const [viewState, setViewState] = useState<any>({
        longitude: displayLon || 74.794628,
        latitude: displayLat || 13.345103,
        zoom: 16,
        pitch: 60, 
        bearing: 0
    });

    // Camera Auto-Follow Logic
    useEffect(() => {
        if (followMode && displayLat !== 0 && displayLon !== 0) {
            setViewState((prev: any) => ({ 
                ...prev, 
                longitude: displayLon, 
                latitude: displayLat,
                // Optional: Dynamic zoom based on altitude
                zoom: altitude > 5000 ? 12 : 16 
            }));
        }
    }, [displayLat, displayLon, altitude, followMode]);

    let currentMapStyle = mapMode === 'online' 
        ? (isDark ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
        : getOfflineStyle(mapMode, isDark);

    // Safe fallback for rotation (Selective Rendering)
    const safeRotation = {
        x: rotation?.x || 0,
        y: rotation?.y || 0,
        z: rotation?.z || 0
    };

    const layers = [
        // 1. The 3D Rocket Model
        new ScenegraphLayer({
            id: 'rocket-model',
            data: [{ lon: displayLon, lat: displayLat, altitude, ...safeRotation }],
            scenegraph: '/siklab.glb', // Ensure this file is in your public/ folder
            getPosition: (d: any) => [d.lon, d.lat, d.altitude],
            getOrientation: (d: any) => [d.x, d.y, d.z],
            sizeScale: 10, // Adjust this to make your specific model larger/smaller
            _lighting: 'pbr',
            transitions: {
                getPosition: 200, // Smooth interpolation between data points
                getOrientation: 200
            }
        }),
        
        // 2. The Flight Trajectory Trail
        new PathLayer({
            id: 'flight-trail',
            data: [{ path: deckTrajectory }],
            getPath: (d: any) => d.path,
            getColor: [249, 115, 22, 255], // Orange trail
            widthMinPixels: 4,
            widthMaxPixels: 10,
        })
    ];

    return (
        <div className="w-full h-full relative">
            <div className="absolute top-24 right-4 z-10 pointer-events-auto flex justify-end">
                <button 
                    onClick={() => setFollowMode(!followMode)}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase border transition-colors shadow-lg backdrop-blur-md ${
                        followMode 
                        ? 'bg-blue-600/80 border-blue-400 text-white dark:bg-blue-600/80 dark:border-blue-400' 
                        : 'bg-white/80 border-slate-300 text-slate-700 dark:bg-slate-900/80 dark:border-slate-600 dark:text-slate-300'
                    }`}
                >
                    {followMode ? 'CAM LOCKED' : 'FREE CAM'}
                </button>
            </div>

            {isLocalhost && (
                <div className="absolute top-36 right-4 z-10 pointer-events-auto flex justify-end">
                    <select 
                        value={mapMode} 
                        onChange={(e) => setMapMode(e.target.value as any)}
                        className="px-3 py-1.5 rounded text-[10px] font-bold uppercase border bg-white/80 border-slate-300 text-slate-700 dark:bg-slate-900/80 dark:border-slate-600 dark:text-slate-300 shadow-lg backdrop-blur-md outline-none cursor-pointer text-right w-[110px] truncate transition-colors"
                    >
                        <option value="online">📡 ONLINE MAP</option>
                        <option value="manipal">💾 OFFLINE: MANIPAL</option>
                        <option value="spaceport">💾 OFFLINE: SPACEPORT</option>
                    </select>
                </div>
            )}

            <DeckGL
                initialViewState={viewState}
                onViewStateChange={({ viewState }) => {
                    setViewState(viewState);
                    // Disable follow mode if user manually pans the camera
                    if (followMode) setFollowMode(false);
                }}
                controller={true}
                layers={layers}
            >
                {/* FIX 2: Cast currentMapStyle as any to bypass strict TS typing */}
                <Map key={mapMode + (isDark ? 'dark' : 'light')} mapStyle={currentMapStyle as any} />
            </DeckGL>
        </div>
    );
}