/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  EqualizerPreset,
  SOUNDALIVE_PRESETS,
} from './audio/types';
import { SoundAliveDials } from './components/SoundAliveDials';
import { GraphicEqualizer } from './components/GraphicEqualizer';
import { HardwareStatusCard } from './components/HardwareStatusCard';
import {
  syncNativeMasterEnabled,
  syncNativeBandLevel,
  syncNativeSamsungDials,
  syncNativeGain,
  syncNativeClarity,
  syncNativeAmbiente,
  syncNativeSurround,
  syncNativeDynamicBoost,
  syncNativeBassBoost,
  startNativeBackgroundService,
} from './utils/nativeBridge';
import {
  Sliders,
  Radio,
  Power,
  CheckCircle2,
  Volume2,
  Sparkles,
  Zap,
  Globe,
  Sun,
} from 'lucide-react';

const INITIAL_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export default function App() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('normal');
  const [bands, setBands] = useState<number[]>(INITIAL_BANDS);
  const [bassTreble, setBassTreble] = useState<number>(0);
  const [instrumentVocal, setInstrumentVocal] = useState<number>(0);

  // FxSound Pro individual separate effect sliders (0 - 1000)
  const [clarity, setClarity] = useState<number>(0);
  const [ambiente, setAmbiente] = useState<number>(0);
  const [surround, setSurround] = useState<number>(0);
  const [dynamicBoost, setDynamicBoost] = useState<number>(0);
  const [bassBoost, setBassBoost] = useState<number>(0);
  const [gainDb, setGainDb] = useState<number>(0);

  // Auto start Android foreground audio service on mount
  useEffect(() => {
    startNativeBackgroundService();
  }, []);

  // Sync Master Switch to Android
  useEffect(() => {
    syncNativeMasterEnabled(enabled);
  }, [enabled]);

  // Sync Samsung Dials & FxSound effects
  useEffect(() => {
    if (mode === 'basic') {
      syncNativeSamsungDials(bassTreble, instrumentVocal);
    }
  }, [bassTreble, instrumentVocal]);

  useEffect(() => {
    if (mode === 'advanced') {
      bands.forEach((gain, index) => {
        syncNativeBandLevel(index, gain);
      });
    }
  }, [bands, mode]);

  useEffect(() => { syncNativeGain(gainDb); }, [gainDb]);
  useEffect(() => { syncNativeClarity(clarity); }, [clarity]);
  useEffect(() => { syncNativeAmbiente(ambiente); }, [ambiente]);
  useEffect(() => { syncNativeSurround(surround); }, [surround]);
  useEffect(() => { syncNativeDynamicBoost(dynamicBoost); }, [dynamicBoost]);
  useEffect(() => { syncNativeBassBoost(bassBoost); }, [bassBoost]);

  // Handlers
  const handleToggleMaster = () => { setEnabled((prev) => !prev); };

  const handleSelectPreset = (preset: EqualizerPreset) => {
    setSelectedPresetId(preset.id);
    setBands([...preset.bands]);
    setBassTreble(preset.bassTreble);
    setInstrumentVocal(preset.instrumentVocal);
    syncNativeSamsungDials(preset.bassTreble, preset.instrumentVocal);
    preset.bands.forEach((g, idx) => syncNativeBandLevel(idx, g));
  };

  const handleChangeBand = (index: number, value: number) => {
    setBands((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setSelectedPresetId('custom');
    syncNativeBandLevel(index, value);
  };

  const handleResetBands = () => {
    setBands([...INITIAL_BANDS]);
    setSelectedPresetId('normal');
    INITIAL_BANDS.forEach((_, idx) => syncNativeBandLevel(idx, 0));
  };

  // Helper for rendering sliders with green decibel status bars
  const renderEffectSlider = (
    label: string,
    icon: React.ReactNode,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    isDbAlready = false
  ) => {
    const isEffectActive = enabled && (isDbAlready ? value !== 0 : value > 0);
    // Map slider values to simulated decibel boost for green level bar
    const dbValue = isDbAlready ? value : (value / 1000) * 12.0;
    const dbFormatted = isEffectActive ? `${dbValue > 0 ? '+' : ''}${dbValue.toFixed(1)} dB` : '0.0 dB';

    return (
      <div className="bg-neutral-900/50 border border-neutral-900 rounded-xl p-3 flex flex-col gap-2 hover:border-neutral-800 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
            {icon}
            {label}
          </span>
          <span className="text-xs font-mono font-bold text-sky-400">
            {isDbAlready ? `${value > 0 ? '+' : ''}${value} dB` : value}
          </span>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(isDbAlready ? parseFloat(e.target.value) : parseInt(e.target.value))}
          disabled={!enabled}
          className="w-full accent-sky-500 bg-neutral-950 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
        />

        {/* GREEN LEVEL DECIBS BAR INDICATOR */}
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isEffectActive ? 'bg-emerald-400 animate-ping' : 'bg-neutral-800'}`} />
          <div className="flex-1 h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-900/60 relative">
            {isEffectActive ? (
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 rounded-full transition-all duration-300 relative overflow-hidden"
                style={{
                  width: `${isDbAlready ? ((value + 5) / 17) * 100 : (value / 1000) * 100}%`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
              </div>
            ) : (
              <div className="h-full w-0 bg-neutral-800" />
            )}
          </div>
          <span className={`text-[9px] font-mono font-bold w-14 text-right transition-colors ${isEffectActive ? 'text-emerald-400' : 'text-neutral-600'}`}>
            {isEffectActive ? dbFormatted : 'INACTIVO'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start p-3 sm:p-5 select-none overscroll-none touch-pan-y">
      <div className="w-full max-w-lg flex flex-col gap-3">
        {/* Top Header & Master Switch */}
        <header className="flex items-center justify-between py-2 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                SoundAlive Pro
                <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  LITE & SAVE BATTERY
                </span>
              </h1>
              <p className="text-[10px] text-neutral-500">
                Samsung Galaxy Audio Engine modded
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMaster}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
              enabled
                ? 'bg-sky-500 text-black border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.25)]'
                : 'bg-neutral-900 text-neutral-500 border-neutral-800'
            }`}
          >
            <Power className="w-3 h-3" />
            {enabled ? 'ACTIVADO' : 'APAGADO'}
          </button>
        </header>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-950 border border-neutral-900">
          <button
            type="button"
            onClick={() => setMode('basic')}
            className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'basic' ? 'bg-neutral-900 text-sky-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Básico (Perillas)
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'advanced' ? 'bg-neutral-900 text-sky-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Avanzado (Bandas)
          </button>
        </div>

        {/* Presets Strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {SOUNDALIVE_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                disabled={!enabled}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors border ${
                  isSelected ? 'bg-neutral-900 border-sky-500/50 text-sky-400' : 'bg-black border-neutral-900 text-neutral-500'
                } disabled:opacity-45`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Main Panel */}
        <main className="w-full">
          {mode === 'basic' ? (
            <SoundAliveDials
              bassTreble={bassTreble}
              instrumentVocal={instrumentVocal}
              onChangeBassTreble={(v) => { setBassTreble(v); setSelectedPresetId('custom'); syncNativeSamsungDials(v, instrumentVocal); }}
              onChangeInstrumentVocal={(v) => { setInstrumentVocal(v); setSelectedPresetId('custom'); syncNativeSamsungDials(bassTreble, v); }}
              disabled={!enabled}
            />
          ) : (
            <GraphicEqualizer
              bands={bands}
              onChangeBand={handleChangeBand}
              onReset={handleResetBands}
              disabled={!enabled}
            />
          )}
        </main>

        {/* FxSound Pro Cleaned, Uncluttered Panel with Green Activity Bars */}
        <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-3 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-neutral-900 pb-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>FxSound Pro Efectos Avanzados</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Ganancia */}
            {renderEffectSlider('Ganancia / Preamp', <Volume2 className="w-3.5 h-3.5 text-sky-400" />, gainDb, -5, 12, 0.5, setGainDb, true)}

            {/* Claridad */}
            {renderEffectSlider('Claridad (Agudos definidos)', <Sun className="w-3.5 h-3.5 text-amber-400" />, clarity, 0, 1000, 10, setClarity)}

            {/* Ambiente */}
            {renderEffectSlider('Ambiente (Sala de Conciertos)', <Globe className="w-3.5 h-3.5 text-emerald-400" />, ambiente, 0, 1000, 10, setAmbiente)}

            {/* Sonido envolvente */}
            {renderEffectSlider('Sonido envolvente (Virtualizer)', <Sparkles className="w-3.5 h-3.5 text-purple-400" />, surround, 0, 1000, 10, setSurround)}

            {/* Refuerzo dinámico */}
            {renderEffectSlider('Refuerzo dinámico (Compresor)', <Zap className="w-3.5 h-3.5 text-orange-400" />, dynamicBoost, 0, 1000, 10, setDynamicBoost)}

            {/* Refuerzo de graves */}
            {renderEffectSlider('Refuerzo de graves (Bass)', <Sliders className="w-3.5 h-3.5 text-rose-400" />, bassBoost, 0, 1000, 10, setBassBoost)}
          </div>
        </section>

        {/* Live Hardware Diagnostic */}
        <HardwareStatusCard
          masterEnabled={enabled}
          concertHallEnabled={ambiente > 0}
          mode={mode}
        />

        {/* Footer */}
        <footer className="flex items-center justify-between text-[10px] text-neutral-600 px-1">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Frecuencia y Amplitud Nativas OK</span>
          </div>
          <span className="font-mono">v1.2.11</span>
        </footer>
      </div>
    </div>
  );
}
