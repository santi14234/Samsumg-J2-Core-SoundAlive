/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SoundAliveState,
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
  isNativeAndroidApp,
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
  }, [bands]);

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
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                SoundAlive
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40">
                  FxSound Pro
                </span>
              </h1>
              <p className="text-[11px] text-neutral-500">
                Audio espacial universal y ecualizador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMaster}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              enabled
                ? 'bg-sky-500 text-black border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                : 'bg-neutral-900 text-neutral-500 border-neutral-800'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {enabled ? 'Activado' : 'Desactivado'}
          </button>
        </header>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-950 border border-neutral-900">
          <button
            type="button"
            onClick={() => setMode('basic')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'basic' ? 'bg-neutral-900 text-sky-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Básico (Perillas)
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'advanced' ? 'bg-neutral-900 text-sky-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Avanzado (Bandas)
          </button>
        </div>

        {/* Presets Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SOUNDALIVE_PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                disabled={!enabled}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  isSelected ? 'bg-neutral-900 border-sky-500/60 text-sky-400 font-semibold' : 'bg-black border-neutral-900 text-neutral-400'
                } disabled:opacity-40`}
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

        {/* FxSound Pro Separate Sliders Panel (Claridad, Ambiente, Sonido Envolvente, Refuerzo dinámico, Refuerzo de graves) */}
        <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider border-b border-neutral-900 pb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FxSound Pro Efectos Avanzados</span>
          </div>

          {/* Ganancia / Preamp */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-sky-400" /> Ganancia / Preamp
              </span>
              <span className="font-mono font-bold text-sky-400">{gainDb > 0 ? `+${gainDb.toFixed(1)} dB` : `${gainDb.toFixed(1)} dB`}</span>
            </div>
            <input
              type="range"
              min="-5"
              max="12"
              step="0.5"
              value={gainDb}
              onChange={(e) => setGainDb(parseFloat(e.target.value))}
              disabled={!enabled}
              className="w-full accent-sky-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Claridad */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Claridad (Agudos definidos)
              </span>
              <span className="font-mono text-neutral-400">{clarity}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={clarity}
              onChange={(e) => setClarity(parseInt(e.target.value))}
              disabled={!enabled}
              className="w-full accent-amber-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Ambiente */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" /> Ambiente (Reverberación espacial)
              </span>
              <span className="font-mono text-neutral-400">{ambiente}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={ambiente}
              onChange={(e) => setAmbiente(parseInt(e.target.value))}
              disabled={!enabled}
              className="w-full accent-sky-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Sonido envolvente */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Sonido envolvente (Virtualizer 3D)
              </span>
              <span className="font-mono text-neutral-400">{surround}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={surround}
              onChange={(e) => setSurround(parseInt(e.target.value))}
              disabled={!enabled}
              className="w-full accent-purple-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Refuerzo dinámico */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> Refuerzo dinámico (Compresión / Punch)
              </span>
              <span className="font-mono text-neutral-400">{dynamicBoost}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={dynamicBoost}
              onChange={(e) => setDynamicBoost(parseInt(e.target.value))}
              disabled={!enabled}
              className="w-full accent-emerald-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Refuerzo de graves */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-rose-400" /> Refuerzo de graves (Bass Boost)
              </span>
              <span className="font-mono text-neutral-400">{bassBoost}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={bassBoost}
              onChange={(e) => setBassBoost(parseInt(e.target.value))}
              disabled={!enabled}
              className="w-full accent-rose-500 bg-neutral-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>
        </section>

        {/* Live Hardware Diagnostic */}
        <HardwareStatusCard
          masterEnabled={enabled}
          concertHallEnabled={ambiente > 0}
          mode={mode}
        />

        {/* Footer */}
        <footer className="flex items-center justify-between text-[11px] text-neutral-500 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>FxSound Pro & SoundAlive Engine</span>
          </div>
          <span className="text-neutral-600 font-mono">v1.2.6</span>
        </footer>
      </div>
    </div>
  );
}
