import React, { useState, useEffect } from 'react';
import {
  syncNativeMasterEnabled,
  syncNativeClarity,
  syncNativeAmbiente,
  syncNativeSurround,
  syncNativeDynamicBoost,
  syncNativeBassBoost,
  startNativeBackgroundService,
  getNativeEffectsStatus,
  NativeEffectsStatus,
  isNativeAndroidApp,
} from './utils/nativeBridge';
import {
  Power,
  Sparkles,
  Zap,
  Globe,
  Sun,
  Activity,
  Sliders,
  Volume2,
  Headphones,
  Compass,
  AlertTriangle,
} from 'lucide-react';

interface FxSoundPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  clarity: number;       // 0 - 1000
  ambiente: number;      // 0 - 1000
  surround: number;      // 0 - 1000
  bassBoost: number;     // 0 - 1000
  dynamicBoost: number;  // 0 - 1000
}

const FXSOUND_PRESETS: FxSoundPreset[] = [
  {
    id: 'normal',
    name: 'Normal (Plano)',
    icon: 'Compass',
    description: 'Sonido sin procesar, firma acústica plana original',
    clarity: 0,
    ambiente: 0,
    surround: 0,
    bassBoost: 0,
    dynamicBoost: 0,
  },
  {
    id: 'music',
    name: 'Música Hifi',
    icon: 'Headphones',
    description: 'Ajuste balanceado con claridad vocal y graves cálidos',
    clarity: 500,
    ambiente: 300,
    surround: 350,
    bassBoost: 450,
    dynamicBoost: 200,
  },
  {
    id: 'movie',
    name: 'Cine 3D',
    icon: 'Sparkles',
    description: 'Efecto de sala cinematográfica con atmósfera expandida',
    clarity: 600,
    ambiente: 650,
    surround: 750,
    bassBoost: 500,
    dynamicBoost: 400,
  },
  {
    id: 'gaming',
    name: 'Videojuegos',
    icon: 'Zap',
    description: 'Envolvente tridimensional para pasos claros y explosiones',
    clarity: 400,
    ambiente: 500,
    surround: 800,
    bassBoost: 600,
    dynamicBoost: 500,
  },
  {
    id: 'voice',
    name: 'Voz / Podcast',
    icon: 'Sun',
    description: 'Enfoque absoluto en diálogos reduciendo ruidos pesados',
    clarity: 800,
    ambiente: 100,
    surround: 100,
    bassBoost: 100,
    dynamicBoost: 300,
  },
  {
    id: 'bass_booster',
    name: 'Super Graves',
    icon: 'Volume2',
    description: 'Máxima profundidad en bajas frecuencias para música urbana',
    clarity: 200,
    ambiente: 200,
    surround: 300,
    bassBoost: 900,
    dynamicBoost: 300,
  },
];

export default function App() {
  const [enabled, setEnabled] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('music');

  // Core FxSound effects values (0 - 1000)
  const [clarity, setClarity] = useState<number>(500);
  const [ambiente, setAmbiente] = useState<number>(300);
  const [surround, setSurround] = useState<number>(350);
  const [bassBoost, setBassBoost] = useState<number>(450);
  const [dynamicBoost, setDynamicBoost] = useState<number>(200);

  // Native diagnostic state
  const [status, setStatus] = useState<NativeEffectsStatus>({
    masterEnabled: true,
    equalizerActive: false,
    equalizerBands: 0,
    bassBoostSupported: true,
    bassBoostActive: false,
    bassBoostStrength: 0,
    concertHallEnabled: false,
    concertHallActive: false,
    presetReverbSupported: false,
    envReverbSupported: false,
    roomAcousticSupported: false,
    concertHallEngine: 'Nativo',
    sessionsCount: 0,
    activeSessions: [],
    hardwareEngines: [],
    isAudioOutputActive: false,
    isAndroidGoDetected: true,
  });

  // Start background service on mount
  useEffect(() => {
    if (isNativeAndroidApp()) {
      startNativeBackgroundService();
    }
  }, []);

  // Sync state with native background service
  useEffect(() => {
    syncNativeMasterEnabled(enabled);
    if (enabled) {
      syncNativeClarity(clarity);
      syncNativeAmbiente(ambiente);
      syncNativeSurround(surround);
      syncNativeBassBoost(bassBoost);
      syncNativeDynamicBoost(dynamicBoost);
    }
  }, [enabled, clarity, ambiente, surround, bassBoost, dynamicBoost]);

  // Periodic status poll (every 2.5s)
  useEffect(() => {
    let timer: any;
    async function updateStatus() {
      if (isNativeAndroidApp()) {
        const res = await getNativeEffectsStatus();
        if (res) {
          setStatus(res);
        }
      }
    }
    updateStatus();
    timer = setInterval(updateStatus, 2500);
    return () => clearInterval(timer);
  }, []);

  // Handle Preset Selection
  const applyPreset = (preset: FxSoundPreset) => {
    setSelectedPresetId(preset.id);
    setClarity(preset.clarity);
    setAmbiente(preset.ambiente);
    setSurround(preset.surround);
    setBassBoost(preset.bassBoost);
    setDynamicBoost(preset.dynamicBoost);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col antialiased">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-20 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-neutral-100 flex items-center gap-1.5">
              SoundAlive Lite <span className="text-[10px] text-emerald-400 font-normal px-1.5 py-0.5 bg-emerald-950/80 rounded">FxSound Pro</span>
            </h1>
            <p className="text-[10px] text-neutral-500">Optimizador dinámico ultraligero</p>
          </div>
        </div>

        {/* Master Power Toggle Button */}
        <button
          onClick={() => setEnabled(!enabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
            enabled
              ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30 font-bold active:scale-95'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 active:scale-95'
          }`}
        >
          <Power className={`w-3.5 h-3.5 ${enabled ? 'stroke-[2.5px]' : ''}`} />
          <span>{enabled ? 'ACTIVO' : 'BYPASS'}</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-4">
        
        {/* Android Go Warning / Status */}
        {status.isAndroidGoDetected && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-left">
              <h2 className="text-xs font-bold text-amber-400 leading-none mb-1">
                Optimizado para Android Go (J2 Core)
              </h2>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Sin perillas ni bandas para maximizar el rendimiento de la RAM. El ecualizador del sistema procesará de forma transparente en segundo plano.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Preset Cards */}
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 text-left">
            Perfiles de Optimización
          </span>
          <div className="grid grid-cols-3 gap-2">
            {FXSOUND_PRESETS.map((preset) => {
              const isActive = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  disabled={!enabled}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all duration-200 ${
                    !enabled
                      ? 'bg-neutral-900/40 border-neutral-900/60 opacity-40 cursor-not-allowed'
                      : isActive
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-neutral-900 border-neutral-900 hover:border-neutral-800 text-neutral-300'
                  }`}
                >
                  <span className="text-[11px] font-bold tracking-tight line-clamp-1">
                    {preset.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] opacity-70 line-clamp-1 font-mono">
                    {preset.id === 'normal' ? '0%' : `${Math.round((preset.clarity + preset.bassBoost) / 20)}%`}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 text-left italic px-1">
            "{FXSOUND_PRESETS.find(p => p.id === selectedPresetId)?.description}"
          </p>
        </section>

        {/* FxSound Sliders Section */}
        <section className={`bg-neutral-900/50 border border-neutral-900 rounded-2xl p-4 flex flex-col gap-4 transition-opacity duration-300 ${
          enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Modulación de FxSound
            </span>
            <span className="text-[10px] text-neutral-500">Rango: 0 - 100%</span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Clarity Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Claridad Vocal
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(clarity / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={clarity}
                onChange={(e) => {
                  setClarity(parseInt(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Bass Boost Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Refuerzo de Graves
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(bassBoost / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={bassBoost}
                onChange={(e) => {
                  setBassBoost(parseInt(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Surround Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-400" /> Sonido Envolvente 3D
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(surround / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={surround}
                onChange={(e) => {
                  setSurround(parseInt(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Atmosphere Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Atmósfera de Sala
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(ambiente / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={ambiente}
                onChange={(e) => {
                  setAmbiente(parseInt(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Dynamic Boost Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" /> Refuerzo Dinámico (Loudness)
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(dynamicBoost / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={dynamicBoost}
                onChange={(e) => {
                  setDynamicBoost(parseInt(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Live Diagnostics Card */}
        <section className="bg-neutral-900/30 border border-neutral-900/60 rounded-xl p-3 flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Estado del Motor Nativo
              </span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
              PID {status.sessionsCount > 1 ? `x${status.sessionsCount}` : 'Global'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
            <div className="flex items-center justify-between border-b border-neutral-900/80 pb-1">
              <span>Claridad:</span>
              <span className="font-semibold text-neutral-200">{status.clarityLive ? 'Activo' : 'Bypass'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-900/80 pb-1">
              <span>Graves:</span>
              <span className="font-semibold text-neutral-200">{status.bassBoostLive ? 'Activo' : 'Bypass'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-900/80 pb-1">
              <span>Envolvente:</span>
              <span className="font-semibold text-neutral-200">{status.virtualizerLive ? 'Activo' : 'Bypass'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-900/80 pb-1">
              <span>Sala/Atmósfera:</span>
              <span className="font-semibold text-neutral-200">{status.reverbLive ? 'Activo' : 'Bypass'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-3 text-center text-[10px] text-neutral-600 border-t border-neutral-900">
        SoundAlive Lite — Hecho con precisión para Samsung J2 Core
      </footer>
    </main>
  );
}
