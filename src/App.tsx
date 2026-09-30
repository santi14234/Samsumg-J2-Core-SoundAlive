/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SoundAliveState,
  EqualizerPreset,
  SOUNDALIVE_PRESETS,
  ReverbSize,
  SurroundLevel,
  AdaptSoundAge,
} from './audio/types';
import { soundAliveAudioEngine } from './audio/soundAliveEngine';
import { SoundAliveDials } from './components/SoundAliveDials';
import { GraphicEqualizer } from './components/GraphicEqualizer';
import { PresetsSelector } from './components/PresetsSelector';
import { EffectsGrid } from './components/EffectsGrid';
import { AdaptSoundModal } from './components/AdaptSoundModal';
import { J2CoreInfoModal } from './components/J2CoreInfoModal';
import {
  syncNativeMasterEnabled,
  syncNativeBandLevel,
  syncNativeBassBoost,
  syncNativeSurround,
  syncNativeReverb,
  isNativeAndroidApp,
} from './utils/nativeBridge';
import {
  Sliders,
  Headphones,
  Info,
  Radio,
  Power,
  Layers,
  Sparkles,
  CheckCircle2,
  Settings2,
} from 'lucide-react';

const INITIAL_STATE: SoundAliveState = {
  enabled: true,
  mode: 'basic',
  selectedPresetId: 'rock',
  bands: [5, 4, 2, -1, -2, 1, 3, 5, 6], // default to energetic Rock curve
  bassTreble: 30,
  instrumentVocal: -40,
  tubeAmp: true,
  tubeAmpDrive: 0.65,
  surround3D: true,
  surroundLevel: 'medium',
  concertHall: false,
  concertHallSize: 'auditorium',
  bassBoost: true,
  bassBoostLevel: 7,
  clarity: true,
  clarityLevel: 6,
  uhqUpscaler: true,
  adaptSound: 'under30',
  adaptSoundCustomL: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  adaptSoundCustomR: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export default function App() {
  const [state, setState] = useState<SoundAliveState>(INITIAL_STATE);
  const [isAdaptSoundOpen, setIsAdaptSoundOpen] = useState(false);
  const [isJ2CoreModalOpen, setIsJ2CoreModalOpen] = useState(false);

  // Sync to Web Audio engine (for browser preview)
  useEffect(() => {
    soundAliveAudioEngine.applyState(state);
  }, [state]);

  // Sync state to native Android AudioEffects
  useEffect(() => {
    syncNativeMasterEnabled(state.enabled);
  }, [state.enabled]);

  useEffect(() => {
    state.bands.forEach((gain, index) => {
      syncNativeBandLevel(index, gain);
    });
  }, [state.bands]);

  useEffect(() => {
    syncNativeBassBoost(state.bassBoost && state.enabled, state.bassBoostLevel);
  }, [state.bassBoost, state.bassBoostLevel, state.enabled]);

  useEffect(() => {
    syncNativeSurround(state.surround3D && state.enabled, state.surroundLevel);
  }, [state.surround3D, state.surroundLevel, state.enabled]);

  useEffect(() => {
    syncNativeReverb(state.concertHall && state.enabled, state.concertHallSize);
  }, [state.concertHall, state.concertHallSize, state.enabled]);

  // State mutators
  const handleToggleMasterEnabled = () => {
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSelectPreset = (preset: EqualizerPreset) => {
    setState((prev) => ({
      ...prev,
      selectedPresetId: preset.id,
      bands: [...preset.bands],
      bassTreble: preset.bassTreble,
      instrumentVocal: preset.instrumentVocal,
    }));
  };

  const handleChangeBand = (index: number, value: number) => {
    setState((prev) => {
      const newBands = [...prev.bands];
      newBands[index] = value;
      return {
        ...prev,
        bands: newBands,
        selectedPresetId: 'custom',
      };
    });
  };

  const handleResetBands = () => {
    setState((prev) => ({
      ...prev,
      bands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      selectedPresetId: 'normal',
    }));
  };

  const handleChangeBassTreble = (val: number) => {
    setState((prev) => ({
      ...prev,
      bassTreble: val,
      selectedPresetId: 'custom',
    }));
  };

  const handleChangeInstrumentVocal = (val: number) => {
    setState((prev) => ({
      ...prev,
      instrumentVocal: val,
      selectedPresetId: 'custom',
    }));
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Samsung One UI Header */}
      <header className="sticky top-0 z-40 bg-[#0a0e1a] border-b border-slate-800 px-3 py-2.5 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-cyan-500 flex items-center justify-center shrink-0 shadow-md border border-blue-400/30">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                  SoundAlive
                </h1>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  Samsung
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {isNativeAndroidApp() ? 'Ecualizador del Sistema Activo' : 'Ecualizador & Efectos de Audio'}
              </p>
            </div>
          </div>

          {/* Master Power Toggle Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleMasterEnabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer ${
                state.enabled
                  ? 'bg-blue-600 text-white shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${state.enabled ? 'text-white' : 'text-slate-400'}`} />
              <span>{state.enabled ? 'ACTIVADO' : 'APAGADO'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-3 space-y-3.5">
        {/* System Audio Notification / Status Card */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-slate-200">
                Ecualizador del Sistema & Segundo Plano
              </h2>
              <p className="text-[11px] text-slate-400 leading-snug">
                Aplica a reproductores externos (Spotify, YouTube Music, Samsung Music, etc.).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsAdaptSoundOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-800/40 hover:bg-purple-900/40 transition-colors cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              Adapt Sound
            </button>

            <button
              type="button"
              onClick={() => setIsJ2CoreModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Ajustes J2 Core
            </button>
          </div>
        </div>

        {/* Preset Selector */}
        <PresetsSelector
          selectedPresetId={state.selectedPresetId}
          onSelectPreset={handleSelectPreset}
          disabled={!state.enabled}
        />

        {/* Mode Switcher: Basic vs Advanced */}
        <div className="flex items-center justify-between bg-[#111726] border border-slate-800 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, mode: 'basic' }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              state.mode === 'basic'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Modo Básico (Perillas)
          </button>
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, mode: 'advanced' }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              state.mode === 'advanced'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Modo Avanzado (9 Bandas)
          </button>
        </div>

        {/* Dials or 9-Band Graphic Equalizer */}
        {state.mode === 'basic' ? (
          <SoundAliveDials
            bassTreble={state.bassTreble}
            instrumentVocal={state.instrumentVocal}
            onChangeBassTreble={handleChangeBassTreble}
            onChangeInstrumentVocal={handleChangeInstrumentVocal}
            disabled={!state.enabled}
          />
        ) : (
          <GraphicEqualizer
            bands={state.bands}
            onChangeBand={handleChangeBand}
            onReset={handleResetBands}
            disabled={!state.enabled}
          />
        )}

        {/* Samsung SoundAlive Sound Effects Grid */}
        <EffectsGrid
          tubeAmp={state.tubeAmp}
          tubeAmpDrive={state.tubeAmpDrive}
          onToggleTubeAmp={() => setState((p) => ({ ...p, tubeAmp: !p.tubeAmp }))}
          onChangeTubeAmpDrive={(val) => setState((p) => ({ ...p, tubeAmpDrive: val }))}
          surround3D={state.surround3D}
          surroundLevel={state.surroundLevel}
          onToggleSurround={() => setState((p) => ({ ...p, surround3D: !p.surround3D }))}
          onChangeSurroundLevel={(lvl) => setState((p) => ({ ...p, surroundLevel: lvl }))}
          concertHall={state.concertHall}
          concertHallSize={state.concertHallSize}
          onToggleConcertHall={() => setState((p) => ({ ...p, concertHall: !p.concertHall }))}
          onChangeConcertHallSize={(sz) => setState((p) => ({ ...p, concertHallSize: sz }))}
          bassBoost={state.bassBoost}
          bassBoostLevel={state.bassBoostLevel}
          onToggleBassBoost={() => setState((p) => ({ ...p, bassBoost: !p.bassBoost }))}
          onChangeBassBoostLevel={(lvl) => setState((p) => ({ ...p, bassBoostLevel: lvl }))}
          clarity={state.clarity}
          clarityLevel={state.clarityLevel}
          onToggleClarity={() => setState((p) => ({ ...p, clarity: !p.clarity }))}
          onChangeClarityLevel={(lvl) => setState((p) => ({ ...p, clarityLevel: lvl }))}
          uhqUpscaler={state.uhqUpscaler}
          onToggleUhq={() => setState((p) => ({ ...p, uhqUpscaler: !p.uhqUpscaler }))}
          disabled={!state.enabled}
        />
      </main>

      {/* Adapt Sound Hearing Calibration Modal */}
      <AdaptSoundModal
        isOpen={isAdaptSoundOpen}
        onClose={() => setIsAdaptSoundOpen(false)}
        currentProfile={state.adaptSound}
        onSelectProfile={(age: AdaptSoundAge) => setState((prev) => ({ ...prev, adaptSound: age }))}
      />

      {/* Galaxy J2 Core System Settings & Guide Modal */}
      <J2CoreInfoModal
        isOpen={isJ2CoreModalOpen}
        onClose={() => setIsJ2CoreModalOpen(false)}
      />
    </div>
  );
}
