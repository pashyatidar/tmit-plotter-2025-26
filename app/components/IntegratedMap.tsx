"use client";
import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
    lat: number;
    lon: number;
    altitude: number;
    trajectory: [number, number, number][]; 
    // NEW: Added Secondary GPS Props
    lat2?: number;
    lon2?: number;
    trajectory2?: [number, number, number][];
    
    rotation?: { x: number, y: number, z: number };
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

export default function IntegratedMap({ lat, lon, altitude, trajectory, lat2, lon2, trajectory2, rotation, isDark }: Props) {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const [mapMode, setMapMode] = useState<'online' | 'manipal' | 'spaceport'>('online');
    const [followMode, setFollowMode] = useState(true);

    const isSpaceport = mapMode === 'spaceport';
    const latOffset = isSpaceport ? (32.9904 - 13.345103) : 0;
    const lonOffset = isSpaceport ? (-106.9750 - 74.794628) : 0;

    // Safety checks against NaN injections AND out-of-range coordinates
    const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
    const clampLon = (v: number) => Math.max(-180, Math.min(180, v));
    const isValidLat = (v: number) => !isNaN(v) && v >= -90 && v <= 90;
    const isValidLon = (v: number) => !isNaN(v) && v >= -180 && v <= 180;

    const safeLat = isValidLat(lat) ? lat : 0;
    const safeLon = isValidLon(lon) ? lon : 0;
    const safeLat2 = lat2 !== undefined && isValidLat(lat2) ? lat2 : 0;
    const safeLon2 = lon2 !== undefined && isValidLon(lon2) ? lon2 : 0;

    const displayLat = safeLat !== 0 ? safeLat + latOffset : 0;
    const displayLon = safeLon !== 0 ? safeLon + lonOffset : 0;

    // Trajectory 1: Main GNSS — clamp every point to valid ranges
    const deckTrajectory = (trajectory || [])
        .filter(p => isValidLat(p[0]) && isValidLon(p[1]))
        .map(p => [
            clampLon((p[1] || 0) + lonOffset), 
            clampLat((p[0] || 0) + latOffset), 
            (p[2] || 0)              
        ]);

    // Trajectory 2: NEO-6M GNSS
    const deckTrajectory2 = (trajectory2 || [])
        .filter(p => isValidLat(p[0]) && isValidLon(p[1]))
        .map(p => [
            clampLon((p[1] || 0) + lonOffset), 
            clampLat((p[0] || 0) + latOffset), 
            (p[2] || 0)              
        ]);

    // Camera targets Main GNSS if available, otherwise falls back to Neo-6M
    const cameraLat = displayLat !== 0 ? displayLat : (safeLat2 !== 0 ? safeLat2 + latOffset : 13.345103);
    const cameraLon = displayLon !== 0 ? displayLon : (safeLon2 !== 0 ? safeLon2 + lonOffset : 74.794628);

    const [viewState, setViewState] = useState<any>({
        longitude: cameraLon,
        latitude: cameraLat,
        zoom: 18, // Zoomed in tighter for GPS drift comparison
        pitch: 60, 
        bearing: 0
    });

    useEffect(() => {
        if (followMode && cameraLat !== 13.345103 && cameraLon !== 74.794628) {
            // Clamp before passing to maplibre to prevent runtime crash
            const clampedLat = clampLat(cameraLat);
            const clampedLon = clampLon(cameraLon);
            setViewState((prev: any) => ({ 
                ...prev, 
                longitude: clampedLon, 
                latitude: clampedLat,
                zoom: altitude > 5000 ? 12 : 18 
            }));
        }
    }, [cameraLat, cameraLon, altitude, followMode]);

    let currentMapStyle = mapMode === 'online' 
        ? (isDark ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
        : getOfflineStyle(mapMode, isDark);

    const layers = [
        new ScenegraphLayer({
            id: 'rocket-model',
            data: [{ lon: displayLon, lat: displayLat, altitude: (isNaN(altitude) ? 0 : altitude), x: rotation?.x||0, y: rotation?.y||0, z: rotation?.z||0 }],
            scenegraph: '/siklab.glb', 
            getPosition: (d: any) => [d.lon, d.lat, d.altitude],
            getOrientation: (d: any) => [d.x, d.y, d.z],
            sizeScale: 10, 
            _lighting: 'pbr',
            transitions: { getPosition: 200, getOrientation: 200 }
        }),
        
        // --- 🟠 MAIN GNSS (ORANGE) ---
        new PathLayer({
            id: 'flight-trail-main',
            data: [{ path: deckTrajectory }],
            getPath: (d: any) => d.path,
            getColor: [249, 115, 22, 200], // Orange
            widthMinPixels: 4,
            widthMaxPixels: 8,
        }),
        new ScatterplotLayer({
            id: 'flight-points-main',
            data: deckTrajectory,
            getPosition: (d: any) => d,
            getFillColor: [255, 255, 255, 255], 
            getLineColor: [249, 115, 22, 255], // Orange 
            lineWidthMinPixels: 2,
            stroked: true,
            radiusUnits: 'pixels', 
            getRadius: 5, 
        }),

        // --- 🩵 NEO-6M GNSS (CYAN) ---
        new PathLayer({
            id: 'flight-trail-neo',
            data: [{ path: deckTrajectory2 }],
            getPath: (d: any) => d.path,
            getColor: [6, 182, 212, 180], // Cyan (slightly more transparent)
            widthMinPixels: 3,
            widthMaxPixels: 6,
        }),
        new ScatterplotLayer({
            id: 'flight-points-neo',
            data: deckTrajectory2,
            getPosition: (d: any) => d,
            getFillColor: [255, 255, 255, 255], 
            getLineColor: [6, 182, 212, 255], // Cyan
            lineWidthMinPixels: 2,
            stroked: true,
            radiusUnits: 'pixels', 
            getRadius: 4, 
        })
    ];

    return (
        <div className="w-full h-full relative">
            <div className="absolute top-24 right-4 z-10 pointer-events-auto flex justify-end">
                <button 
                    onClick={() => setFollowMode(!followMode)}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase border transition-colors shadow-lg backdrop-blur-md ${
                        followMode 
                        ? 'bg-blue-600/80 border-blue-400 text-white' 
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
                    if (followMode) setFollowMode(false);
                }}
                controller={true}
                layers={layers}
            >
                <Map key={mapMode + (isDark ? 'dark' : 'light')} mapStyle={currentMapStyle as any} />
            </DeckGL>
        </div>
    );
}