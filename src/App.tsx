import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  syncNativeMasterEnabled,
  syncNativeClarity,
  syncNativeAmbiente,
  syncNativeSurround,
  syncNativeBassBoost,
  syncNativeBandLevel,
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
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  MoreVertical,
  Bookmark,
  RefreshCw,
} from 'lucide-react';

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

// ---------------------------------------------------------------------------------------------
// Configuracion completa (efectos + 9 bandas + nivel de cada sala). Se guarda en el telefono
// (localStorage) en dos lugares: la configuracion "en vivo" (lo ultimo que dejaste) y las 7 ranuras.
// ---------------------------------------------------------------------------------------------
type Cfg = {
  clarity: number; bassBoost: number; surround: number; atmosphere: number; mix: number;
  volume: number; normalization: number; bandLevels: number[]; roomDb: number[];
};
const DEFAULT_ROOM_DB = [0, -3, 2, 1, 4];   // dB extra de cada sala (Estudio ... Catedral)
const LS_LIVE = 'soundalive.live.v2';
const LS_ACTIVE = 'soundalive.activeSlot.v2';
const LS_SLOT = (n: number) => `soundalive.slot.v2.${n}`;

const clampNum = (x: any, lo: number, hi: number, d: number) =>
  (typeof x === 'number' && isFinite(x)) ? Math.max(lo, Math.min(hi, Math.round(x))) : d;

function readCfg(key: string): Cfg | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return {
      clarity: clampNum(o.clarity, 0, 10, 5),
      bassBoost: clampNum(o.bassBoost, 0, 10, 4),
      surround: clampNum(o.surround, 0, 10, 3),
      atmosphere: clampNum(o.atmosphere, 1, 5, 3),
      mix: clampNum(o.mix, 0, 20, 10),
      volume: clampNum(o.volume, 0, 10, 2),
      normalization: clampNum(o.normalization, 0, 10, 3),
      bandLevels: Array.from({ length: 9 }, (_, i) => clampNum(Array.isArray(o.bandLevels) ? o.bandLevels[i] : 0, -10, 10, 0)),
      roomDb: Array.from({ length: 5 }, (_, i) => clampNum(Array.isArray(o.roomDb) ? o.roomDb[i] : DEFAULT_ROOM_DB[i], -12, 12, DEFAULT_ROOM_DB[i])),
    };
  } catch (e) {
    return null;
  }
}

function writeCfg(key: string, cfg: Cfg) {
  try { localStorage.setItem(key, JSON.stringify(cfg)); } catch (e) { /* sin espacio o bloqueado */ }
}

export default function App() {
  const [enabled, setEnabled] = useState(true);

  // Core FxSound effects values (0 - 10 scale)
  // Lo ultimo que dejaste (se recupera aunque cierres la app o el reproductor la abra de nuevo)
  const [initCfg] = useState<Cfg | null>(() => readCfg(LS_LIVE));
  const [clarity, setClarity] = useState<number>(initCfg?.clarity ?? 5);
  const [bassBoost, setBassBoost] = useState<number>(initCfg?.bassBoost ?? 4);
  const [surround, setSurround] = useState<number>(initCfg?.surround ?? 3);
  const [atmosphere, setAtmosphere] = useState<number>(initCfg?.atmosphere ?? 3);
  const [volume, setVolume] = useState<number>(initCfg?.volume ?? 2);
  const [mix, setMix] = useState<number>(initCfg?.mix ?? 10); // Mix del reverb (0-20), separado del volumen maestro
  const [normalization, setNormalization] = useState<number>(initCfg?.normalization ?? 3);
  const [roomDb, setRoomDb] = useState<number[]>(initCfg?.roomDb ?? DEFAULT_ROOM_DB);

  // 7 Slots Profile Management
  const [activeSlot, setActiveSlot] = useState<number>(() => {
    try { return clampNum(parseInt(localStorage.getItem(LS_ACTIVE) || '1'), 1, 7, 1); } catch (e) { return 1; }
  });
  const [savedSlots, setSavedSlots] = useState<boolean[]>(() =>
    [1, 2, 3, 4, 5, 6, 7].map((n) => { try { return !!localStorage.getItem(LS_SLOT(n)); } catch (e) { return false; } }));
  const [flash, setFlash] = useState<string>('');
  const [showSlotsMenu, setShowSlotsMenu] = useState<boolean>(false);
  const [showThreeDotMenu, setShowThreeDotMenu] = useState<boolean>(false);

  // 9-Band Equalizer levels in dB (-10 to +10 dB)
  const [bandLevels, setBandLevels] = useState<number[]>(initCfg?.bandLevels ?? [0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Native diagnostic state
  const [status, setStatus] = useState<NativeEffectsStatus>({
    masterEnabled: true,
    equalizerActive: true,
    equalizerBands: 9,
    bassBoostSupported: true,
    bassBoostActive: true,
    bassBoostStrength: 400,
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

  // Restart audio server via Root
  const handleRestartAudioServer = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidAudio) {
      try {
        (window as any).AndroidAudio.restartAudioServer();
        alert('Comando killall audioserver ejecutado con éxito por Root.');
      } catch (e) {
        console.warn('Restart audioserver error:', e);
      }
    }
    setShowThreeDotMenu(false);
  };

  const currentCfg = (): Cfg => ({ clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb });

  // Envia toda la configuracion al motor nativo (efectos, nivel de cada sala y las 9 bandas)
  const pushAll = (c: Cfg) => {
    if (typeof window === 'undefined' || !(window as any).AndroidAudio) return;
    const bridge = (window as any).AndroidAudio;
    try {
      bridge.updateClarity(c.clarity);
      bridge.updateBassBoost(c.bassBoost);
      bridge.updateSurround(c.surround);
      if (typeof bridge.updateRoomLevel === 'function') {
        c.roomDb.forEach((db, i) => bridge.updateRoomLevel(i + 1, db));
      }
      bridge.updateAtmosphere(c.atmosphere, c.mix);
      bridge.updateMasterVolume(c.volume);
      bridge.updateNormalization(c.normalization);
      c.bandLevels.forEach((db, i) => syncNativeBandLevel(i, db));
    } catch (e) {
      console.warn('pushAll error:', e);
    }
  };

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2200);
  };

  // Aplica una configuracion completa (la pantalla y el motor)
  const applyCfg = (c: Cfg) => {
    setClarity(c.clarity); setBassBoost(c.bassBoost); setSurround(c.surround);
    setAtmosphere(c.atmosphere); setMix(c.mix); setVolume(c.volume);
    setNormalization(c.normalization); setBandLevels(c.bandLevels); setRoomDb(c.roomDb);
    if (enabled) pushAll(c);
  };

  // Tocar una ranura: si tiene datos los carga; si esta vacia NO toca tu configuracion actual
  const handleSelectSlot = (slot: number) => {
    setActiveSlot(slot);
    try { localStorage.setItem(LS_ACTIVE, String(slot)); } catch (e) { /* nada */ }
    const saved = readCfg(LS_SLOT(slot));
    if (saved) {
      applyCfg(saved);
      showFlash(`Ranura #${slot} cargada`);
    } else {
      showFlash(`Ranura #${slot} vacia: pulsa Guardar para dejar aqui tu configuracion`);
    }
  };

  // Guardar TODA la configuracion actual en una ranura
  const handleSaveSlot = (slot: number) => {
    setActiveSlot(slot);
    try { localStorage.setItem(LS_ACTIVE, String(slot)); } catch (e) { /* nada */ }
    writeCfg(LS_SLOT(slot), currentCfg());
    setSavedSlots((prev) => prev.map((v, i) => (i === slot - 1 ? true : v)));
    setShowSlotsMenu(false);
    showFlash(`Guardado en la ranura #${slot} (efectos, 9 bandas y salas)`);
  };

  const handleClearSlot = (slot: number) => {
    try { localStorage.removeItem(LS_SLOT(slot)); } catch (e) { /* nada */ }
    setSavedSlots((prev) => prev.map((v, i) => (i === slot - 1 ? false : v)));
    showFlash(`Ranura #${slot} borrada`);
  };

  // Guarda lo ultimo que dejaste (para que no se restablezca al volver a abrir la app)
  useEffect(() => {
    const t = setTimeout(() => writeCfg(LS_LIVE, { clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb }), 300);
    return () => clearTimeout(t);
  }, [clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb]);

  // Update native effects immediately when power toggle changes
  const handleTogglePower = useCallback(() => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    syncNativeMasterEnabled(nextEnabled);
    if (nextEnabled) pushAll(currentCfg());
  }, [enabled, clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb]);

  // Al abrir la app, reenviar todos los valores al motor nativo. Antes solo se enviaban al mover
  // un slider o al encender, asi que tras reiniciar el motor podia quedar con graves/envolvente en 0.
  const latestValues = useRef({ enabled, clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb });
  latestValues.current = { enabled, clarity, bassBoost, surround, atmosphere, mix, volume, normalization, bandLevels, roomDb };
  useEffect(() => {
    const timer = setTimeout(() => {
      const v = latestValues.current;
      if (!v.enabled || typeof window === 'undefined' || !(window as any).AndroidAudio) return;
      try {
        syncNativeMasterEnabled(true);
        pushAll({ clarity: v.clarity, bassBoost: v.bassBoost, surround: v.surround, atmosphere: v.atmosphere,
                  mix: v.mix, volume: v.volume, normalization: v.normalization, bandLevels: v.bandLevels, roomDb: v.roomDb });
      } catch (e) {
        console.warn('Startup sync error:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

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

  // Handle individual band change
  const handleBandChange = (index: number, newDb: number) => {
    const updated = [...bandLevels];
    updated[index] = newDb;
    setBandLevels(updated);
    if (enabled) {
      syncNativeBandLevel(index, newDb);
    }
  };

  const handleResetBands = () => {
    const zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    setBandLevels(zeros);
    if (enabled) {
      zeros.forEach((db, i) => syncNativeBandLevel(i, db));
    }
  };

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
              SoundAlive Pro <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.2 bg-emerald-950 border border-emerald-800/60 rounded">FXSOUND</span>
            </h1>
            <p className="text-[10px] text-neutral-400">Motor Samsung J2 Core (Root Global)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Master Power Toggle Button */}
          <button
            onClick={handleTogglePower}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
              enabled
                ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30 font-bold active:scale-95'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 active:scale-95'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${enabled ? 'stroke-[2.5px]' : ''}`} />
            <span>{enabled ? 'ACTIVO' : 'BYPASS'}</span>
          </button>

          {/* Hidden 3-Dot Menu */}
          <div className="relative">
            <button
              onClick={() => setShowThreeDotMenu(!showThreeDotMenu)}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showThreeDotMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1">
                <button
                  onClick={handleRestartAudioServer}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 rounded-lg text-left transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reinicio Forzado AudioServer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-md landscape:max-w-none mx-auto px-4 landscape:px-5 py-4 flex flex-col gap-4 landscape:grid landscape:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] landscape:items-start landscape:gap-5">
        {/* Columna izquierda: perfiles + ecualizador */}
        <div className="flex flex-col gap-4 min-w-0">
        {/* 7 Slots Profile Selector */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-emerald-400" /> Ranuras de Perfiles (1 - 7)
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold px-2 py-0.5 bg-emerald-950/80 rounded border border-emerald-800/50">
              Slot Activo: #{activeSlot}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((slot) => {
              const isSelected = activeSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => handleSelectSlot(slot)}
                  onDoubleClick={() => handleSaveSlot(slot)}
                  className={`py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                  title={`Ranura ${slot} (Doble clic para guardar)`}
                >
                  #{slot}{savedSlots[slot - 1] ? <span className="ml-0.5 text-[8px] align-top">●</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-neutral-500 italic">● = ranura con datos. Toca una ranura para cargarla; Guardar la actualiza con todo (efectos, bandas y salas).</span>
            <button
              onClick={() => handleSaveSlot(activeSlot)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors shadow-sm"
            >
              Guardar Slot #{activeSlot}
            </button>
            <button
              onClick={() => handleClearSlot(activeSlot)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              Borrar
            </button>
          </div>
          {flash ? (
            <div className="text-[11px] text-emerald-300 bg-emerald-950/70 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">{flash}</div>
          ) : null}
        </section>

        {/* 9-Band Graphic Equalizer Section */}
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

          <div className="bg-neutral-950/60 border border-neutral-800/60 rounded-xl p-3 flex justify-between items-center gap-1">
            {EQ_FREQUENCIES.map((freq, idx) => {
              const level = bandLevels[idx] || 0;
              return (
                <div key={freq.label} className="flex-1 flex flex-col items-center gap-2">
                  <span className={`text-[9px] landscape:text-[11px] font-mono font-bold leading-none ${
                    level > 0 ? 'text-emerald-400' : level < 0 ? 'text-amber-400' : 'text-neutral-500'
                  }`}>
                    {level > 0 ? `+${level}` : level}
                  </span>

                  <div className="h-28 landscape:h-44 flex items-center justify-center relative">
                    <div className="absolute w-2.5 h-[1px] bg-neutral-700/70 pointer-events-none top-1/2 -translate-y-1/2" />
                    
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="1"
                      value={level}
                      onChange={(e) => handleBandChange(idx, parseInt(e.target.value))}
                      className="accent-emerald-500 bg-neutral-800/90 rounded-lg cursor-pointer h-24 landscape:h-40 w-1.5 landscape:w-2"
                      style={{
                        WebkitAppearance: 'slider-vertical',
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                      }}
                    />
                  </div>

                  <span className="text-[9px] landscape:text-[11px] font-medium text-neutral-400 tracking-tight leading-none">
                    {freq.short}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        </div>

        {/* Columna derecha: procesamiento FxSound + estado */}
        <div className="flex flex-col gap-4 min-w-0">
        {/* FxSound Sliders Section (0 - 10 Scale) */}
        <section className={`bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4 transition-opacity duration-300 ${
          enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Procesamiento FxSound Pro
            </span>
            <span className="text-[10px] text-neutral-400">Escala Real 0 - 10</span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Clarity Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Claridad Vocal (Clarity)
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {clarity}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={clarity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setClarity(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateClarity(val);
                  }
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Bass Boost Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Refuerzo de Graves (Bass Boost)
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {bassBoost}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={bassBoost}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBassBoost(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateBassBoost(val);
                  }
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Surround Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-400" /> Sonido Envolvente 3D (Surround)
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {surround}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={surround}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSurround(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateSurround(val);
                  }
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Atmosphere Selector (Room Type & Mix Level) */}
            <div className="flex flex-col gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Atmósfera de Sala
                </span>
              </div>
              
              <select
                className="bg-neutral-800 text-neutral-100 text-xs p-2 rounded-lg border border-neutral-700"
                value={atmosphere}
                onChange={(e) => {
                  const roomType = parseInt(e.target.value);
                  setAtmosphere(roomType);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateAtmosphere(roomType, mix);
                  }
                }}
              >
                <option value="1">Sala 1: Estudio</option>
                <option value="2">Sala 2: Habitación</option>
                <option value="3">Sala 3: Estadio</option>
                <option value="4">Sala 4: Auditorio</option>
                <option value="5">Sala 5: Catedral</option>
              </select>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-neutral-300 font-medium text-[10px]">Nivel de esta sala (dB)</span>
                <span className="text-indigo-300 font-bold font-mono text-sm">{roomDb[atmosphere - 1] > 0 ? '+' : ''}{roomDb[atmosphere - 1]} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={roomDb[atmosphere - 1]}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const next = roomDb.map((d, i) => (i === atmosphere - 1 ? val : d));
                  setRoomDb(next);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio
                      && typeof (window as any).AndroidAudio.updateRoomLevel === 'function') {
                    (window as any).AndroidAudio.updateRoomLevel(atmosphere, val);
                  }
                }}
                className="w-full accent-indigo-400 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-neutral-300 font-medium text-[10px]">Nivel de Ganancia (Mix)</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">{mix}</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={mix}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMix(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateAtmosphere(atmosphere, val);
                  }
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Master Volume Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Volumen Maestro (Master Volume)
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {volume}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={volume}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVolume(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateMasterVolume(val);
                  }
                }}
                className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Normalization Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" /> Normalización Dinámica (Limiter)
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {normalization}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={normalization}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setNormalization(val);
                  if (enabled && typeof window !== 'undefined' && (window as any).AndroidAudio) {
                    (window as any).AndroidAudio.updateNormalization(val);
                  }
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
            <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck className="w-3 h-3" /> ROOT GLOBAL
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[10px]">
            <span className="text-neutral-500">Puente JavascriptInterface:</span>
            <span className="font-mono font-medium text-emerald-400">
              window.AndroidAudio Conectado
            </span>
          </div>
        </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-3 text-center text-[10px] text-neutral-600 border-t border-neutral-900">
        SoundAlive Pro — FxSound Architecture with Root Access for Samsung J2 Core
      </footer>
    </main>
  );
}
