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
  syncNativeConcertHall,
  startNativeBackgroundService,
  isNativeAndroidApp,
} from './utils/nativeBridge';
import {
  Sliders,
  Radio,
  Power,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const INITIAL_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export default function App() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('normal');
  const [bands, setBands] = useState<number[]>(INITIAL_BANDS);
  const [bassTreble, setBassTreble] = useState<number>(0);
  const [instrumentVocal, setInstrumentVocal] = useState<number>(0);
  const [concertHall, setConcertHall] = useState<boolean>(false);

  // Auto start Android foreground audio service on mount
  useEffect(() => {
    startNativeBackgroundService();
  }, []);

  // Sync Master Switch to Android
  useEffect(() => {
    syncNativeMasterEnabled(enabled);
  }, [enabled]);

  // Sync Samsung Dual Dials to Android
  useEffect(() => {
    if (mode === 'basic') {
      syncNativeSamsungDials(bassTreble, instrumentVocal);
    }
  }, [bassTreble, instrumentVocal, mode]);

  // Sync Equalizer Bands to Android
  useEffect(() => {
    if (mode === 'advanced') {
      bands.forEach((gain, index) => {
        syncNativeBandLevel(index, gain);
      });
    }
  }, [bands, mode]);

  // Sync Concert Hall (Pure Reverb) to Android
  useEffect(() => {
    syncNativeConcertHall(concertHall && enabled);
  }, [concertHall, enabled]);

  // Handlers
  const handleToggleMaster = () => {
    setEnabled((prev) => !prev);
  };

  const handleSelectPreset = (preset: EqualizerPreset) => {
    setSelectedPresetId(preset.id);
    setBands([...preset.bands]);
    setBassTreble(preset.bassTreble);
    setInstrumentVocal(preset.instrumentVocal);

    if (mode === 'basic') {
      syncNativeSamsungDials(preset.bassTreble, preset.instrumentVocal);
    } else {
      preset.bands.forEach((g, idx) => syncNativeBandLevel(idx, g));
    }
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

  const handleChangeBassTreble = (val: number) => {
    setBassTreble(val);
    setSelectedPresetId('custom');
    syncNativeSamsungDials(val, instrumentVocal);
  };

  const handleChangeInstrumentVocal = (val: number) => {
    setInstrumentVocal(val);
    setSelectedPresetId('custom');
    syncNativeSamsungDials(bassTreble, val);
  };

  const handleToggleConcertHall = () => {
    setConcertHall((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start p-3 sm:p-5 select-none overscroll-none touch-pan-y">
      <div className="w-full max-w-lg flex flex-col gap-3">
        {/* Top Header & Samsung Master Switch */}
        <header className="flex items-center justify-between py-2 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                SoundAlive
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40">
                  Samsung
                </span>
              </h1>
              <p className="text-[11px] text-neutral-500">
                Efectos y calidad de sonido del sistema
              </p>
            </div>
          </div>

          {/* Master Switch */}
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

        {/* Mode Switch Tabs: Básico (2 Perillas) vs Avanzado (Bandas) */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-950 border border-neutral-900">
          <button
            type="button"
            onClick={() => setMode('basic')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'basic'
                ? 'bg-neutral-900 text-sky-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Básico (Perillas)
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'advanced'
                ? 'bg-neutral-900 text-sky-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Avanzado (Bandas)
          </button>
        </div>

        {/* Quick Presets Horizontal Strip */}
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
                  isSelected
                    ? 'bg-neutral-900 border-sky-500/60 text-sky-400 font-semibold'
                    : 'bg-black border-neutral-900 text-neutral-400 hover:border-neutral-800'
                } disabled:opacity-40`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Main Control Panel (Basic: 2 Dials | Advanced: 9 Sliders) */}
        <main className="w-full">
          {mode === 'basic' ? (
            <SoundAliveDials
              bassTreble={bassTreble}
              instrumentVocal={instrumentVocal}
              onChangeBassTreble={handleChangeBassTreble}
              onChangeInstrumentVocal={handleChangeInstrumentVocal}
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

        {/* Sala de Conciertos (Pure Reverb Toggle) */}
        <section className="bg-black border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                concertHall && enabled
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-600'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-neutral-200 block">
                Sala de conciertos
              </span>
              <span className="text-xs text-neutral-500 block">
                Simula la acústica y reverberación de un auditorio
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleConcertHall}
            disabled={!enabled}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 border ${
              concertHall && enabled
                ? 'bg-sky-500 border-sky-400'
                : 'bg-neutral-900 border-neutral-800 opacity-60'
            } disabled:opacity-30`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-black shadow transition-transform ${
                concertHall && enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </section>

        {/* Live Hardware Effects Diagnostic requested by user */}
        <HardwareStatusCard
          masterEnabled={enabled}
          concertHallEnabled={concertHall}
          mode={mode}
        />

        {/* System Active Status Footer */}
        <footer className="flex items-center justify-between text-[11px] text-neutral-500 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Servicio de audio activo en todo el sistema</span>
          </div>
          <span className="text-neutral-600 font-mono">Samsung J2 Core</span>
        </footer>
      </div>
    </div>
  );
}
