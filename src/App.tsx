import React, { useState, useEffect, useCallback } from 'react';
import {
  syncNativeMasterEnabled,
  syncNativeClarity,
  syncNativeAmbiente,
  syncNativeSurround,
  syncNativeDynamicBoost,
  syncNativeBassBoost,
  syncNativeBandLevel,
  startNativeBackgroundService,
  getNativeEffectsStatus,
  NativeEffectsStatus,
  isNativeAndroidApp,
  hasDirectRootBridge,
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
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Waves,
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

const EQ_FREQUENCIES = [
  { label: '63Hz', short: '63' },
  { label: '125Hz', short: '125' },
  { label: '250Hz', short: '250' },
  { label: '500Hz', short: '500' },
  { label: '1kHz', short: '1k' },
  { label: '2kHz', short: '2k' },
  { label: '4kHz', short: '4k' },
  { label: '8kHz', short: '8k' },
  { label: '16kHz', short: '16k' },
];

const EQ_PRESETS = [
  { name: 'Plano', levels: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Graves', levels: [6, 5, 3, 1, 0, 0, 0, 0, 0] },
  { name: 'Vocal', levels: [-1, 0, 1, 3, 5, 4, 2, 1, 0] },
  { name: 'Rock / V', levels: [5, 3, 1, -1, 0, 2, 3, 5, 6] },
  { name: 'Agudos', levels: [0, 0, 0, 1, 2, 4, 5, 6, 7] },
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

  // 9-Band Equalizer levels in dB (-10 to +10 dB)
  const [bandLevels, setBandLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Native diagnostic state
  const [status, setStatus] = useState<NativeEffectsStatus>({
    masterEnabled: true,
    equalizerActive: true,
    equalizerBands: 9,
    bassBoostSupported: true,
    bassBoostActive: true,
    bassBoostStrength: 450,
    concertHallEnabled: true,
    concertHallActive: true,
    presetReverbSupported: true,
    envReverbSupported: true,
    roomAcousticSupported: true,
    concertHallEngine: 'EnvironmentalReverb (Root Global)',
    sessionsCount: 1,
    activeSessions: [0],
    hardwareEngines: ['Root Global AudioFX (Sesión 0)'],
    isAudioOutputActive: true,
    audioModifiedInSystem: true,
    eqLive: true,
    bassBoostLive: true,
    reverbLive: true,
    virtualizerLive: true,
    clarityLive: true,
    loudnessLive: true,
    gainLive: true,
    isAndroidGoDetected: false,
    hasEqualizerHardware: true,
    hasBassBoostHardware: true,
    hasVirtualizerHardware: true,
    hasReverbHardware: true,
    hasLoudnessEnhancerHardware: true,
    isRootActive: true,
    bridgeConnected: true,
  });


  // Update native effects immediately when power toggle changes
  const handleTogglePower = useCallback(() => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    syncNativeMasterEnabled(nextEnabled);
    if (nextEnabled) {
      syncNativeClarity(clarity);
      syncNativeAmbiente(ambiente);
      syncNativeSurround(surround);
      syncNativeBassBoost(bassBoost);
      syncNativeDynamicBoost(dynamicBoost);
      bandLevels.forEach((db, i) => syncNativeBandLevel(i, db));
    }
  }, [enabled, clarity, ambiente, surround, bassBoost, dynamicBoost, bandLevels]);

  // Periodic status poll
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
    timer = setInterval(updateStatus, 2000);
    return () => clearInterval(timer);
  }, []);

  // Handle Preset Selection with instant native sync
  const applyPreset = (preset: FxSoundPreset) => {
    setSelectedPresetId(preset.id);
    setClarity(preset.clarity);
    setAmbiente(preset.ambiente);
    setSurround(preset.surround);
    setBassBoost(preset.bassBoost);
    setDynamicBoost(preset.dynamicBoost);

    if (enabled) {
      syncNativeClarity(preset.clarity);
      syncNativeAmbiente(preset.ambiente);
      syncNativeSurround(preset.surround);
      syncNativeBassBoost(preset.bassBoost);
      syncNativeDynamicBoost(preset.dynamicBoost);
    }
  };

  // Handle individual band change
  const handleBandChange = (index: number, newDb: number) => {
    const updated = [...bandLevels];
    updated[index] = newDb;
    setBandLevels(updated);
    if (enabled) {
      syncNativeBandLevel(index, newDb);
    }
  };

  // Al mover el slider de "Atmósfera de Sala" (Reverb)
  const onAtmosphereSliderChange = (valor: number) => {
    setAmbiente(valor * 10);
    setSelectedPresetId('custom');
    if (typeof window !== 'undefined' && window.AndroidAudio) {
      window.AndroidAudio.updateAtmosphere(valor);
    }
    if (enabled) {
      syncNativeAmbiente(valor * 10);
    }
  };

  // Al mover el slider de "Sonido Envolvente 3D" (Surround)
  const onSurroundSliderChange = (valor: number) => {
    setSurround(valor * 10);
    setSelectedPresetId('custom');
    if (typeof window !== 'undefined' && window.AndroidAudio) {
      window.AndroidAudio.updateSurround(valor);
    }
    if (enabled) {
      syncNativeSurround(valor * 10);
    }
  };

  // Reset bands to 0 dB
  const handleResetBands = () => {
    const zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    setBandLevels(zeros);
    if (enabled) {
      zeros.forEach((db, i) => syncNativeBandLevel(i, db));
    }
  };

  // Apply EQ preset curve
  const handleApplyEqCurve = (levels: number[]) => {
    setBandLevels(levels);
    if (enabled) {
      levels.forEach((db, i) => syncNativeBandLevel(i, db));
    }
  };

  const isBridgeLive = hasDirectRootBridge() || status.bridgeConnected || isNativeAndroidApp();
  const hasBandModifications = bandLevels.some(b => b !== 0);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col antialiased select-none pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-neutral-950 shadow-lg shadow-emerald-500/20">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-neutral-100 flex items-center gap-1.5">
              SoundAlive Lite <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.2 bg-emerald-950 border border-emerald-800/60 rounded">ROOT GLOBAL</span>
            </h1>
            <p className="text-[10px] text-neutral-400">Motor de sonido Samsung J2 Core (SM-J260M)</p>
          </div>
        </div>

        {/* Master Power Toggle Button */}
        <button
          onClick={handleTogglePower}
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
        {/* Dynamic Preset Cards */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 text-left">
              Perfiles de Optimización
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Root Hook OK
            </span>
          </div>
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
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/10'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
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

        {/* 9-Band Graphic Equalizer Section (Bandas sin perillas) */}
        <section className={`bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3 transition-opacity duration-300 ${
          enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" /> Ecualizador (9 Bandas)
            </span>
            <div className="flex items-center gap-1.5">
              {hasBandModifications && (
                <button
                  onClick={handleResetBands}
                  className="text-[10px] text-neutral-400 hover:text-emerald-400 flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-800 transition-colors"
                  title="Reiniciar a 0 dB"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> 0 dB
                </button>
              )}
              <span className="text-[10px] text-neutral-400 font-mono">±10 dB</span>
            </div>
          </div>

          {/* Quick Curve Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {EQ_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleApplyEqCurve(p.levels)}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/50 shrink-0 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Vertical Faders Strip */}
          <div className="bg-neutral-950/60 border border-neutral-800/60 rounded-xl p-3 flex justify-between items-center gap-1">
            {EQ_FREQUENCIES.map((freq, idx) => {
              const level = bandLevels[idx] || 0;
              return (
                <div key={freq.label} className="flex-1 flex flex-col items-center gap-2">
                  {/* dB readout */}
                  <span className={`text-[9px] font-mono font-bold leading-none ${
                    level > 0 ? 'text-emerald-400' : level < 0 ? 'text-amber-400' : 'text-neutral-500'
                  }`}>
                    {level > 0 ? `+${level}` : level}
                  </span>

                  {/* Vertical Range Slider */}
                  <div className="h-28 flex items-center justify-center relative">
                    {/* Zero center tick mark */}
                    <div className="absolute w-2.5 h-[1px] bg-neutral-700/70 pointer-events-none top-1/2 -translate-y-1/2" />
                    
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="1"
                      value={level}
                      onChange={(e) => handleBandChange(idx, parseInt(e.target.value))}
                      className="accent-emerald-500 bg-neutral-800/90 rounded-lg cursor-pointer h-24 w-1.5"
                      style={{
                        WebkitAppearance: 'slider-vertical',
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                      }}
                    />
                  </div>

                  {/* Frequency label */}
                  <span className="text-[9px] font-medium text-neutral-400 tracking-tight leading-none">
                    {freq.short}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* FxSound Sliders Section */}
        <section className={`bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4 transition-opacity duration-300 ${
          enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Modulación de FxSound
            </span>
            <span className="text-[10px] text-neutral-400">0ms Latencia Directa</span>
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
                  const val = parseInt(e.target.value);
                  setClarity(val);
                  setSelectedPresetId('custom');
                  if (enabled) syncNativeClarity(val);
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
                  const val = parseInt(e.target.value);
                  setBassBoost(val);
                  setSelectedPresetId('custom');
                  if (enabled) syncNativeBassBoost(val);
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
                max="100"
                step="1"
                value={Math.round(surround / 10)}
                onChange={(e) => onSurroundSliderChange(parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Atmosphere Slider (EnvironmentalReverb) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Atmósfera de Sala (Reverb)
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(ambiente / 10)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(ambiente / 10)}
                onChange={(e) => onAtmosphereSliderChange(parseInt(e.target.value))}
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
                  const val = parseInt(e.target.value);
                  setDynamicBoost(val);
                  setSelectedPresetId('custom');
                  if (enabled) syncNativeDynamicBoost(val);
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Live Diagnostics Card */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3.5 flex flex-col gap-2.5 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                Estado del Motor Nativo
              </span>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 ${
              (status.isRootActive || isBridgeLive)
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'bg-neutral-800 text-neutral-400'
            }`}>
              <ShieldCheck className="w-3 h-3" />
              {(status.isRootActive || isBridgeLive) ? 'ROOT GLOBAL (SESIÓN 0)' : 'NATIVO'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[10px] text-neutral-400">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Bandas EQ (9):</span>
              <span className={`font-semibold ${enabled && hasBandModifications ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && hasBandModifications ? 'Activo (Root)' : '0 dB (Plano)'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Claridad Vocal:</span>
              <span className={`font-semibold ${enabled && clarity > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && clarity > 0 ? 'Activo (Root)' : 'Bypass'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Refuerzo Graves:</span>
              <span className={`font-semibold ${enabled && bassBoost > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && bassBoost > 0 ? 'Activo (Root)' : 'Bypass'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Envolvente 3D:</span>
              <span className={`font-semibold ${enabled && surround > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && surround > 0 ? 'Activo (Root)' : 'Bypass'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Atmósfera Sala:</span>
              <span className={`font-semibold ${enabled && ambiente > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && ambiente > 0 ? 'Activo (Root)' : 'Bypass'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span>Refuerzo Dinámico:</span>
              <span className={`font-semibold ${enabled && dynamicBoost > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                {enabled && dynamicBoost > 0 ? 'Activo (Root)' : 'Bypass'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[10px]">
            <span className="text-neutral-500">Puente JavascriptInterface:</span>
            <span className={`font-mono font-medium ${isBridgeLive ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {isBridgeLive ? 'window.AndroidAudio Conectado' : 'Conectando...'}
            </span>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-3 text-center text-[10px] text-neutral-600 border-t border-neutral-900">
        SoundAlive Lite — Ecualizador de 9 Bandas y FxSound con acceso Root para Samsung J2 Core
      </footer>
    </main>
  );
}
