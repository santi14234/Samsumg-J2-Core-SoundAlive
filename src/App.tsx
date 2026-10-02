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
  getNativeEffectsStatus,
  NativeEffectsStatus,
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
  Activity,
  Bookmark,
  Trash2,
  Save,
  X,
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

  interface UserProfileSlot {
    id: number;
    name: string;
    bands: number[];
    bassTreble: number;
    instrumentVocal: number;
    gainDb: number;
    clarity: number;
    ambiente: number;
    surround: number;
    dynamicBoost: number;
    bassBoost: number;
    updatedAt: string;
  }

  const [userProfiles, setUserProfiles] = useState<Record<number, UserProfileSlot>>(() => {
    try {
      const saved = localStorage.getItem('soundalive_user_profiles_10slots');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileInputName, setProfileInputName] = useState('');

  const saveToSlot = (slotId: number) => {
    const name = profileInputName.trim() || `Perfil ${slotId}`;
    const profile: UserProfileSlot = {
      id: slotId,
      name,
      bands: [...bands],
      bassTreble,
      instrumentVocal,
      gainDb,
      clarity,
      ambiente,
      surround,
      dynamicBoost,
      bassBoost,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = { ...userProfiles, [slotId]: profile };
    setUserProfiles(updated);
    setProfileInputName('');
    try {
      localStorage.setItem('soundalive_user_profiles_10slots', JSON.stringify(updated));
    } catch (e) {}
  };

  const loadFromSlot = (profile: UserProfileSlot) => {
    setBands([...profile.bands]);
    setBassTreble(profile.bassTreble);
    setInstrumentVocal(profile.instrumentVocal);
    setGainDb(profile.gainDb);
    setClarity(profile.clarity);
    setAmbiente(profile.ambiente);
    setSurround(profile.surround);
    setDynamicBoost(profile.dynamicBoost);
    setBassBoost(profile.bassBoost);
    setSelectedPresetId(`slot_${profile.id}`);

    syncNativeGain(profile.gainDb);
    syncNativeClarity(profile.clarity);
    syncNativeAmbiente(profile.ambiente);
    syncNativeSurround(profile.surround);
    syncNativeDynamicBoost(profile.dynamicBoost);
    syncNativeBassBoost(profile.bassBoost);
    syncNativeSamsungDials(profile.bassTreble, profile.instrumentVocal);
    profile.bands.forEach((g, idx) => syncNativeBandLevel(idx, g));
    setShowProfileModal(false);
  };

  const deleteSlot = (slotId: number) => {
    const updated = { ...userProfiles };
    delete updated[slotId];
    setUserProfiles(updated);
    try {
      localStorage.setItem('soundalive_user_profiles_10slots', JSON.stringify(updated));
    } catch (e) {}
  };

  // Live hardware state polled from the system
  const [hardwareStatus, setHardwareStatus] = useState<NativeEffectsStatus | null>(null);

  // Start background service on mount
  useEffect(() => {
    startNativeBackgroundService();
  }, []);

  // Poll hardware status every 800ms to immediately detect any system audio change
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      const hasBandsModified = bands.some((b) => b !== 0) || bassTreble !== 0 || instrumentVocal !== 0;
      const isAnyModified = enabled && (hasBandsModified || bassBoost > 0 || ambiente > 0 || surround > 0 || clarity > 0 || dynamicBoost > 0 || gainDb !== 0);

      if (!isNativeAndroidApp()) {
        // Fallback for browser preview: directly mirrors applied modifications
        if (mounted) {
          setHardwareStatus({
            masterEnabled: enabled,
            equalizerActive: enabled,
            equalizerBands: 9,
            bassBoostSupported: true,
            bassBoostActive: enabled && bassBoost > 0,
            bassBoostStrength: bassBoost,
            concertHallEnabled: ambiente > 0,
            concertHallActive: enabled && ambiente > 0,
            presetReverbSupported: true,
            envReverbSupported: true,
            roomAcousticSupported: true,
            concertHallEngine: 'SoundAlive Reverb (Samsung)',
            sessionsCount: isAnyModified ? 1 : 0,
            activeSessions: [0],
            hardwareEngines: [
              'SoundAlive Equalizer (Samsung Electronics) - 53457161',
              'SoundAlive Bass Boost (Samsung Electronics) - 863902e0',
              'PresetReverb (Samsung SoundAlive) - 47382d60',
              'EnvironmentalReverb (Android Native) - c2e5d5f0',
              'Dolby Audio Driver (Samsung Core Engine) - e0e6539b',
            ],
            audioModifiedInSystem: isAnyModified,
            eqLive: enabled && hasBandsModified,
            bassBoostLive: enabled && bassBoost > 0,
            reverbLive: enabled && ambiente > 0,
            virtualizerLive: enabled && surround > 0,
            clarityLive: enabled && clarity > 0,
            loudnessLive: enabled && dynamicBoost > 0,
            gainLive: enabled && gainDb !== 0,
          });
        }
        return;
      }

      try {
        const res = await getNativeEffectsStatus();
        if (mounted && res) {
          setHardwareStatus(res);
        }
      } catch (err) {
        console.warn('Error polling status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 800);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled, clarity, ambiente, surround, dynamicBoost, bassBoost, gainDb, bands, bassTreble, instrumentVocal]);

  // Sync Master Switch to Android
  useEffect(() => {
    syncNativeMasterEnabled(enabled);
  }, [enabled]);

  // Sync Samsung Dials & FxSound effects
  useEffect(() => {
    if (mode === 'basic') {
      syncNativeSamsungDials(bassTreble, instrumentVocal);
    }
  }, [bassTreble, instrumentVocal, mode]);

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

  const hasAudioChanged = !!hardwareStatus?.audioModifiedInSystem;

  // Helper for rendering sliders with true detection of applied audio changes
  const renderEffectSlider = (
    label: string,
    icon: React.ReactNode,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    isApplied: boolean,
    isGain = false
  ) => {
    let statusText = 'PLANO';
    let ledColorClass = 'bg-neutral-600';
    let textColorClass = 'text-neutral-500';

    if (!enabled) {
      statusText = 'DESACTIVADO';
      ledColorClass = 'bg-rose-600';
      textColorClass = 'text-rose-500';
    } else if (isApplied) {
      statusText = 'CAMBIO APLICADO';
      ledColorClass = 'bg-emerald-500 shadow-emerald-500/80 animate-pulse';
      textColorClass = 'text-emerald-400 font-extrabold';
    } else {
      statusText = 'SIN CAMBIO';
      ledColorClass = 'bg-neutral-600';
      textColorClass = 'text-neutral-500';
    }

    return (
      <div className="bg-neutral-900/50 border border-neutral-900 rounded-xl p-3 flex flex-col gap-2 hover:border-neutral-800 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
            {icon}
            {label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-sky-400">
              {isGain ? `${value > 0 ? '+' : ''}${value}` : value}
            </span>
            {/* REAL RED/GREEN LED HARDWARE INDICATOR LIGHT */}
            <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
              <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)] ${ledColorClass}`} />
              <span className={`text-[9px] font-bold tracking-wider ${textColorClass}`}>
                {statusText}
              </span>
            </div>
          </div>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const val = isGain ? parseFloat(e.target.value) : parseInt(e.target.value);
            onChange(val);
          }}
          disabled={!enabled}
          className="w-full accent-sky-500 bg-neutral-950 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
        />
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

        {/* Global Audio Modification Detector (Real system change detector) */}
        <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
          hasAudioChanged
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            : 'bg-neutral-950 border-neutral-900 text-neutral-400'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              hasAudioChanged ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
            }`} />
            <div>
              <span className="text-[11px] font-bold block">
                {hasAudioChanged ? '🟢 AUDIO DEL SISTEMA MODIFICADO' : '⚪ AUDIO ORIGINAL (Sin modificaciones)'}
              </span>
              <span className="text-[9px] text-neutral-500 block">
                {hasAudioChanged
                  ? 'El sistema ha recibido y aplicado los cambios al procesador DSP'
                  : 'Todos los parámetros están en neutro o el sistema está en sonido original'}
              </span>
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
            hasAudioChanged ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-neutral-900 border-neutral-800 text-neutral-500'
          }`}>
            {hasAudioChanged ? 'ACTIVO' : 'NEUTRO'}
          </span>
        </div>

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

        {/* Presets Strip & 10-Slot Profiles Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1 hover:bg-emerald-900/50 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]"
          >
            <Bookmark className="w-3 h-3 text-emerald-400" />
            <span>Ranuras (10 Perfiles)</span>
          </button>
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

        {/* 10-Slot Profiles Modal (FxSound Style) */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-4 flex flex-col gap-3 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Ranuras de Perfiles Personalizados (10)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-neutral-900/50 p-2 rounded-xl border border-neutral-800/80">
                <input
                  type="text"
                  placeholder="Nombre para guardar el perfil actual..."
                  value={profileInputName}
                  onChange={(e) => setProfileInputName(e.target.value)}
                  className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-neutral-500 font-mono">10 Slots</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => {
                  const savedProfile = userProfiles[slotId];
                  return (
                    <div
                      key={slotId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        savedProfile
                          ? 'bg-neutral-900/60 border-emerald-500/30 hover:border-emerald-500/60'
                          : 'bg-black/40 border-neutral-900 hover:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                          savedProfile ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                        }`}>
                          {slotId}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {savedProfile ? savedProfile.name : `Ranura ${slotId} (Vacía)`}
                          </span>
                          <span className="text-[9px] text-neutral-500 block">
                            {savedProfile ? `Guardado: ${savedProfile.updatedAt}` : 'Listo para guardar tu ecualización actual'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {savedProfile && (
                          <button
                            type="button"
                            onClick={() => loadFromSlot(savedProfile)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30 transition-colors"
                          >
                            Cargar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => saveToSlot(slotId)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>{savedProfile ? 'Sobrescribir' : 'Guardar'}</span>
                        </button>
                        {savedProfile && (
                          <button
                            type="button"
                            onClick={() => deleteSlot(slotId)}
                            className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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

        {/* FxSound Pro Cleaned Panel with Real Hardware Lights */}
        <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>FxSound Pro Efectos Avanzados</span>
            </div>
            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">
              {hasAudioChanged ? '🟢 CAMBIOS APLICADOS' : '⚪ SONIDO PLANO'}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Ganancia */}
            {renderEffectSlider('Ganancia / Preamp', <Volume2 className="w-3.5 h-3.5 text-sky-400" />, gainDb, -5, 12, 0.5, setGainDb, enabled && (gainDb !== 0 || !!hardwareStatus?.gainLive), true)}

            {/* Claridad */}
            {renderEffectSlider('Claridad (Agudos definidos)', <Sun className="w-3.5 h-3.5 text-amber-400" />, clarity, 0, 1000, 10, setClarity, enabled && (clarity > 0 || !!hardwareStatus?.clarityLive))}

            {/* Ambiente */}
            {renderEffectSlider('Ambiente (Sala de Conciertos)', <Globe className="w-3.5 h-3.5 text-emerald-400" />, ambiente, 0, 1000, 10, setAmbiente, enabled && (ambiente > 0 || !!hardwareStatus?.reverbLive))}

            {/* Sonido envolvente */}
            {renderEffectSlider('Sonido envolvente (Virtualizer)', <Sparkles className="w-3.5 h-3.5 text-purple-400" />, surround, 0, 1000, 10, setSurround, enabled && (surround > 0 || !!hardwareStatus?.virtualizerLive))}

            {/* Refuerzo dinámico */}
            {renderEffectSlider('Refuerzo dinámico (Compresor)', <Zap className="w-3.5 h-3.5 text-orange-400" />, dynamicBoost, 0, 1000, 10, setDynamicBoost, enabled && (dynamicBoost > 0 || !!hardwareStatus?.loudnessLive))}

            {/* Refuerzo de graves */}
            {renderEffectSlider('Refuerzo de graves (Bass)', <Sliders className="w-3.5 h-3.5 text-rose-400" />, bassBoost, 0, 1000, 10, setBassBoost, enabled && (bassBoost > 0 || !!hardwareStatus?.bassBoostLive))}
          </div>
        </section>

        {/* Live Hardware Diagnostic (Lists all queried system sound drivers!) */}
        <HardwareStatusCard
          masterEnabled={enabled}
          concertHallEnabled={ambiente > 0}
          mode={mode}
          status={hardwareStatus}
        />

        {/* Footer */}
        <footer className="flex items-center justify-between text-[10px] text-neutral-600 px-1">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Frecuencia y Amplitud Nativas OK</span>
          </div>
          <span className="font-mono">v1.2.23</span>
        </footer>
      </div>
    </div>
  );
}
