import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Power, Sparkles, Activity } from 'lucide-react';

interface ProfileData {
  id: number;
  name: string;
  gains: number[];
  compression: number; // 0 to 10
  limiter: number;     // 0 to -20 dB
  reverbMix: number;   // 0 to 10
  reverbGain: number;  // 0 to 15 dB
  dacVol1: number;     // -20 to +12 dB
  dacVol2: number;     // -20 to +12 dB
  spatialGain: number; // 0 to 15 dB
  surround3D: number;  // 0 to 15 dB
}

// Global safe Native Bridge caller
const callNative = (methodName: string, ...args: any[]) => {
  const win = window as any;
  const bridge = win.Android || win.WebAppInterface || win.AndroidAudio;
  if (bridge && typeof bridge[methodName] === 'function') {
    try {
      return bridge[methodName](...args);
    } catch (e) {
      console.warn(`Native bridge ${methodName} error:`, e);
    }
  }
  return null;
};

export default function App() {
  const [masterPower, setMasterPower] = useState<boolean>(true);
  const [fxsoundMode, setFxsoundMode] = useState<boolean>(true);

  // 1. 10 EQ Bands (Gain in dB: -12 to +12)
  const frequencies = ['41Hz', '63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
  const [eqGains, setEqGains] = useState<number[]>([2, 3, 1, 0, -1, 3, 4, 3, 2, 4]);

  // 2. Panel Izquierdo de Dinámica (Faders Verticales)
  // Compresión Dinámica (0 a 10, donde 0 es OFF)
  const [compression, setCompression] = useState<number>(6);
  // Limitador de Picos (0 dB a -20 dB, default -6 dB)
  const [limiterDb, setLimiterDb] = useState<number>(-6);

  // 3. Panel Central de Atmósfera (Reverb Psicoacústico)
  const [reverbMiniFader, setReverbMiniFader] = useState<number>(0); // 0dB
  const [reverbGain, setReverbGain] = useState<number>(15.0); // 0 to +15 dB
  const [reverbDensity, setReverbDensity] = useState<number>(10); // 0 to 10 (10 = Sala 5 Catedral/Arena)

  // 4. Panel Derecho de Volumen Maestro DAC (GoMix)
  const [dacVol1, setDacVol1] = useState<number>(8); // +8 dB
  const [dacVol2, setDacVol2] = useState<number>(8); // +8 dB

  // 5. Panel Inferior Derecho de Espacialidad
  const [spatialGain, setSpatialGain] = useState<number>(12); // +12 dB
  const [surround3D, setSurround3D] = useState<number>(12);   // +12 dB
  const [preAmpGain, setPreAmpGain] = useState<number>(12);   // 0 to +20 dB Pre-Amp Global

  // 6. Perfiles P1 a P7 y Modal Oreo
  const [activeProfileId, setActiveProfileId] = useState<number>(2);
  const [dialogTargetProfile, setDialogTargetProfile] = useState<number | null>(null);
  const [profileInputName, setProfileInputName] = useState<string>('');

  const [profiles, setProfiles] = useState<Record<number, ProfileData>>({
    1: { id: 1, name: 'FxSound Ref', gains: [3, 2, 1, 0, 1, 4, 3, 2, 4, 5], compression: 5, limiter: -6, reverbMix: 10, reverbGain: 15, dacVol1: 8, dacVol2: 8, spatialGain: 12, surround3D: 12 },
    2: { id: 2, name: 'Default P2', gains: [2, 3, 1, 0, -1, 3, 4, 3, 2, 4], compression: 6, limiter: -6, reverbMix: 10, reverbGain: 15, dacVol1: 8, dacVol2: 8, spatialGain: 12, surround3D: 12 },
    3: { id: 3, name: 'Vocal Studio', gains: [-2, -1, 0, 2, 5, 7, 6, 3, 1, 0], compression: 4, limiter: -8, reverbMix: 4, reverbGain: 5, dacVol1: 6, dacVol2: 6, spatialGain: 8, surround3D: 6 },
    4: { id: 4, name: 'Stadium Pro', gains: [4, 3, 1, 0, 2, 5, 4, 3, 5, 6], compression: 7, limiter: -4, reverbMix: 8, reverbGain: 12, dacVol1: 8, dacVol2: 8, spatialGain: 10, surround3D: 14 },
    5: { id: 5, name: 'Bass J260M', gains: [8, 7, 4, 1, 0, 1, 2, 1, 2, 3], compression: 8, limiter: -4, reverbMix: 10, reverbGain: 15, dacVol1: 10, dacVol2: 10, spatialGain: 12, surround3D: 10 },
    6: { id: 6, name: 'Pure Acoustic', gains: [1, 2, 3, 2, 1, 3, 4, 3, 2, 2], compression: 2, limiter: -10, reverbMix: 3, reverbGain: 3, dacVol1: 4, dacVol2: 4, spatialGain: 6, surround3D: 6 },
    7: { id: 7, name: 'Arena Max', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], compression: 9, limiter: -6, reverbMix: 10, reverbGain: 15, dacVol1: 8, dacVol2: 8, spatialGain: 12, surround3D: 15 },
  });

  // Native initialization
  useEffect(() => {
    callNative('inicializarMotoresAudio');
    callNative('setMasterPower', true);
    callNative('setFxsoundMode', true);
    callNative('updateAtmosphere', 5, 10);
    callNative('updateLimiter', -6);
    callNative('updateAudio', 'vol', 100);
  }, []);

  // Update Gain safely
  const updateEqGain = useCallback((index: number, val: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(val)));
    setEqGains(prev => {
      if (prev[index] === clamped) return prev;
      const next = [...prev];
      next[index] = clamped;
      return next;
    });
    callNative('updateBandGain', index, clamped);
    callNative('updateAudio', frequencies[index], clamped);
  }, [frequencies]);

  // KNOB DRAG HANDLERS (VERTICAL ARRASTRE ESTRICTO CON TOUCH-ACTION: NONE)
  const startEqKnobDrag = (index: number, startY: number, currentVal: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
      const deltaGain = (deltaY / 100) * 24;
      updateEqGain(index, currentVal + deltaGain);
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      onMove(e.clientY);
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  // REVERB BIG KNOB DRAG (0 to 15 dB)
  const startReverbKnobDrag = (startY: number, currentVal: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
      const delta = (deltaY / 120) * 15;
      const nextVal = Math.max(0, Math.min(15, Math.round((currentVal + delta) * 10) / 10));
      setReverbGain(nextVal);
      const density = Math.min(10, Math.max(0, Math.round((nextVal / 15) * 10)));
      setReverbDensity(density);
      callNative('updateAtmosphere', 5, density);
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      onMove(e.clientY);
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  // VERTICAL SLIDER DRAG HELPER
  const startVerticalSliderDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    min: number,
    max: number,
    step: number,
    setter: (val: number) => void,
    nativeSync?: (val: number) => void
  ) => {
    e.preventDefault();
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();

    const updateFromY = (clientY: number) => {
      // Top is max, bottom is min
      let pct = (clientY - rect.top) / rect.height;
      pct = Math.max(0, Math.min(1, pct));
      const rawVal = max - pct * (max - min);
      const rounded = Math.round(rawVal / step) * step;
      setter(rounded);
      if (nativeSync) nativeSync(rounded);
    };

    updateFromY(e.clientY);

    const onMove = (moveE: PointerEvent) => {
      moveE.preventDefault();
      updateFromY(moveE.clientY);
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  // HORIZONTAL SLIDER DRAG HELPER
  const startHorizontalSliderDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    min: number,
    max: number,
    step: number,
    setter: (val: number) => void,
    nativeSync?: (val: number) => void
  ) => {
    e.preventDefault();
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();

    const updateFromX = (clientX: number) => {
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const rawVal = min + pct * (max - min);
      const rounded = Math.round(rawVal / step) * step;
      setter(rounded);
      if (nativeSync) nativeSync(rounded);
    };

    updateFromX(e.clientX);

    const onMove = (moveE: PointerEvent) => {
      moveE.preventDefault();
      updateFromX(moveE.clientX);
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const [savedSlots, setSavedSlots] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));

  // Profile Slot Click (Disparador del Modal Oreo)
  const handleProfileSlotClick = (slotId: number) => {
    setDialogTargetProfile(slotId);
    setProfileInputName(profiles[slotId]?.name || `Perfil P${slotId}`);
  };

  // Confirm Overwrite Profile in SharedPreferences (Llamada única consolidada)
  const handleConfirmOverwrite = () => {
    if (dialogTargetProfile === null) return;
    const slotId = dialogTargetProfile;
    const cleanName = profileInputName.trim() || `Perfil P${slotId}`;
    const updated: ProfileData = {
      id: slotId,
      name: cleanName,
      gains: [...eqGains],
      compression,
      limiter: limiterDb,
      reverbMix: reverbDensity,
      reverbGain,
      dacVol1,
      dacVol2,
      spatialGain,
      surround3D,
    };

    setProfiles(prev => ({ ...prev, [slotId]: updated }));
    setSavedSlots(prev => new Set(prev).add(slotId));
    setActiveProfileId(slotId);
    setDialogTargetProfile(null);

    // LLAMADA ÚNICA CONSOLIDADA HACIA WebAppInterface.java
    const gainsJson = JSON.stringify(eqGains);
    callNative(
      'saveProfileComplete',
      slotId,
      cleanName,
      gainsJson,
      compression,
      limiterDb,
      reverbDensity,
      reverbGain,
      dacVol1,
      dacVol2,
      spatialGain,
      surround3D
    );
    callNative('saveProfileJson', slotId, JSON.stringify(updated));
    callNative('saveProfile', slotId);
    callNative('saveCurrentProfile', slotId);
  };

  // Reverb knob angle calculation (0 dB -> -120deg, +15 dB -> +120deg)
  const reverbAngle = (reverbGain / 15) * 240 - 120;

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#080b10] text-white select-none overflow-hidden font-sans p-2 justify-between"
      style={{ touchAction: 'none' }}
    >
      {/* 1. HEADER BAR: SA PRO LITE v1.2.47 */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0">
        <div className="flex items-center space-x-2">
          {/* Cyan Wave Box */}
          <div className="w-7 h-7 rounded bg-[#00e5ff] flex items-center justify-center shadow-md shadow-cyan-500/30">
            <Activity className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-wide text-[#00e5ff]">
              SA PRO LITE <span className="text-xs font-mono font-normal">v1.2.47</span>
            </div>
            <div className="text-[10px] text-gray-400 font-mono tracking-tight flex items-center space-x-1">
              <span>J260M - GO EDITION</span>
              <span className="text-gray-500">🎚️</span>
            </div>
          </div>
        </div>

        {/* Right Header Buttons: FXSOUND PC pill & Power Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              const next = !fxsoundMode;
              setFxsoundMode(next);
              callNative('setFxsoundMode', next);
            }}
            className={`px-3 py-1 rounded-md text-[11px] font-bold border flex items-center space-x-1 transition-all ${
              fxsoundMode
                ? 'bg-[#00e5ff] text-black border-[#00e5ff] shadow-sm shadow-cyan-400/50'
                : 'bg-[#151c27] text-gray-400 border-[#2a364a]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>FXSOUND PC</span>
          </button>

          <button
            onClick={() => {
              const next = !masterPower;
              setMasterPower(next);
              callNative('setMasterPower', next);
            }}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
              masterPower
                ? 'border-[#00e5ff] text-[#00e5ff] bg-[#122334] shadow-sm shadow-cyan-400/40'
                : 'border-red-600 text-red-500 bg-red-950/40'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. DSP HARDWARE BANNER */}
      <div className="mx-2 py-0.5 px-3 bg-[#0d131c] border border-[#1f2c3d] rounded flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-neon-green text-[10px] font-mono font-bold tracking-wider">
            DSP ULTRA-ACTIVE (KNL-LINK)
          </span>
        </div>
        <div className="flex items-center text-neon-green">
          <svg width="28" height="12" viewBox="0 0 28 12" className="stroke-current">
            <path d="M0 6 L8 6 L11 1 L15 11 L18 4 L21 7 L28 6" fill="none" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 3. SECCIÓN ECUALIZADOR: 10 PERILLAS GIRATORIAS COMPACTAS (41Hz a 16kHz) */}
      <div className="mx-2 px-2 py-1 bg-[#10151f] border border-[#1e2738] rounded-md flex justify-between items-center space-x-1 shrink-0">
        {frequencies.map((freq, idx) => {
          const gain = eqGains[idx];
          // Angle rotates from -135deg to +135deg
          const angle = (gain / 12) * 135;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-center py-0.5"
              style={{ touchAction: 'none' }}
            >
              {/* dB text */}
              <div
                className={`text-[8.5px] font-mono font-bold leading-none mb-1 ${
                  gain > 0 ? 'text-[#00e5ff]' : gain < 0 ? 'text-amber-400' : 'text-gray-400'
                }`}
              >
                {gain > 0 ? `+${gain}` : gain}
              </div>

              {/* Rotary Knob: Gray #2a2a2a with #007fff Ring */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startEqKnobDrag(idx, e.clientY, gain);
                }}
                className="w-7 h-7 rounded-full knob-disk relative flex items-center justify-center cursor-ns-resize border border-[#007fff]/60 hover:border-[#00e5ff] shadow-sm shadow-blue-500/20"
                style={{ touchAction: 'none' }}
                title={`${freq}: ${gain} dB`}
              >
                {/* Needle pointer */}
                <div
                  className="w-full h-full relative flex items-start justify-center transition-transform duration-75 pointer-events-none"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div className="w-0.5 h-2 bg-[#007fff] rounded-full mt-0.5 shadow-sm shadow-cyan-300" />
                </div>
                {/* Center pip */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-[#161a22] pointer-events-none" />
              </div>

              {/* Frequency text */}
              <div className="text-[8px] font-mono text-gray-300 font-bold mt-1">
                {freq}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. MAIN CENTRAL INTERFACE GRID (MATCHING THE ATTACHED SCREENSHOT EXACTLY) */}
      <div className="flex-1 mx-2 flex space-x-2 my-1 overflow-x-auto overflow-y-hidden min-h-0 select-none scrollbar-none pb-0.5">
        {/* PANEL IZQUIERDO: DINÁMICA (2 BLOQUES VERTICALES ALTOS) */}
        <div className="flex space-x-2 shrink-0">
          {/* Bloque 1: COMPRESIÓN DINÁMICA */}
          <div className="w-[105px] panel-block p-2 flex flex-col items-center justify-between">
            <div className="text-[9.5px] font-bold text-center text-gray-200 tracking-tight leading-tight">
              COMPRESIÓN<br />DINÁMICA
            </div>

            {/* Top Gray Knob */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                const startY = e.clientY;
                const startVal = compression;
                const onMove = (moveE: PointerEvent) => {
                  const dY = startY - moveE.clientY;
                  const newVal = Math.max(0, Math.min(10, Math.round(startVal + (dY / 80) * 10)));
                  setCompression(newVal);
                };
                const onEnd = () => {
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onEnd);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onEnd);
              }}
              className="w-8 h-8 rounded-full knob-disk relative flex items-center justify-center cursor-ns-resize my-1"
            >
              <div
                className="w-full h-full relative flex items-start justify-center pointer-events-none"
                style={{ transform: `rotate(${(compression / 10) * 240 - 120}deg)` }}
              >
                <div className="w-0.5 h-2.5 bg-gray-200 rounded-full mt-0.5" />
              </div>
            </div>

            {/* Label OFF - 10 */}
            <div className="text-[8px] font-mono text-gray-400">OFF - 10</div>

            {/* Fader Track Vertical with Ticks and Textured Thumb */}
            <div
              onPointerDown={(e) => startVerticalSliderDrag(e, 0, 10, 1, setCompression)}
              className="flex-1 w-7 relative flex items-center justify-center cursor-pointer my-1 fader-ticks"
            >
              {/* Groove */}
              <div className="w-1.5 h-full bg-[#0a0e14] rounded-full border border-[#1b2433] relative flex items-end justify-center">
                {/* Thumb */}
                <div
                  className="absolute w-5 h-3.5 fader-thumb-textured rounded-[2px] cursor-ns-resize"
                  style={{
                    bottom: `calc(${(compression / 10) * 100}% - 7px)`,
                  }}
                >
                  <div className="w-full h-full flex flex-col justify-center items-center space-y-0.5 pointer-events-none">
                    <div className="w-2.5 h-[1px] bg-white/40" />
                    <div className="w-2.5 h-[1px] bg-white/40" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[8px] font-mono text-gray-400">OFF - 10</div>
          </div>

          {/* Bloque 2: LIMITADOR DE PICOS */}
          <div className="w-[105px] panel-block p-2 flex flex-col items-center justify-between">
            <div className="text-[9.5px] font-bold text-center text-gray-200 tracking-tight leading-tight">
              LIMITADOR<br />DE PICOS
            </div>

            {/* Top Gray Knob */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                const startY = e.clientY;
                const startVal = limiterDb;
                const onMove = (moveE: PointerEvent) => {
                  const dY = startY - moveE.clientY;
                  const newVal = Math.max(-20, Math.min(0, Math.round(startVal + (dY / 80) * 20)));
                  setLimiterDb(newVal);
                  callNative('updateLimiter', newVal);
                };
                const onEnd = () => {
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onEnd);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onEnd);
              }}
              className="w-8 h-8 rounded-full knob-disk relative flex items-center justify-center cursor-ns-resize my-1"
            >
              <div
                className="w-full h-full relative flex items-start justify-center pointer-events-none"
                style={{ transform: `rotate(${((limiterDb + 20) / 20) * 240 - 120}deg)` }}
              >
                <div className="w-0.5 h-2.5 bg-gray-200 rounded-full mt-0.5" />
              </div>
            </div>

            {/* Label 0dB - -20dB */}
            <div className="text-[8px] font-mono text-gray-400">0dB - -20dB</div>

            {/* Fader Track Vertical */}
            <div
              onPointerDown={(e) => startVerticalSliderDrag(e, -20, 0, 1, setLimiterDb, (val) => callNative('updateLimiter', val))}
              className="flex-1 w-7 relative flex items-center justify-center cursor-pointer my-1 fader-ticks"
            >
              <div className="w-1.5 h-full bg-[#0a0e14] rounded-full border border-[#1b2433] relative flex items-end justify-center">
                <div
                  className="absolute w-5 h-3.5 fader-thumb-textured rounded-[2px] cursor-ns-resize"
                  style={{
                    bottom: `calc(${((limiterDb + 20) / 20) * 100}% - 7px)`,
                  }}
                >
                  <div className="w-full h-full flex flex-col justify-center items-center space-y-0.5 pointer-events-none">
                    <div className="w-2.5 h-[1px] bg-white/40" />
                    <div className="w-2.5 h-[1px] bg-white/40" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[8px] font-mono text-gray-400">0dB - -20dB</div>
          </div>
        </div>

        {/* PANEL CENTRAL: REVERB DENSITY & ATMÓSFERA DE SALA */}
        <div className="flex-1 panel-block p-3 flex flex-col justify-between relative">
          <div className="flex justify-between items-start">
            {/* Left mini fader with 0dB label */}
            <div className="flex flex-col items-center h-full mr-2">
              <span className="text-[9px] font-mono text-gray-300">0dB</span>
              <div
                onPointerDown={(e) => startVerticalSliderDrag(e, -15, 0, 1, setReverbMiniFader)}
                className="w-5 h-24 relative flex items-center justify-center cursor-pointer my-1"
              >
                <div className="w-1 h-full bg-[#00e5ff] rounded-full relative">
                  <div
                    className="absolute w-4 h-2.5 fader-thumb-textured rounded-[2px] -left-1.5"
                    style={{
                      bottom: `calc(${((reverbMiniFader + 15) / 15) * 100}% - 5px)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Central Reverb Content */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-xs font-bold tracking-wider text-gray-200 mb-1">
                REVERB DENSITY
              </div>

              {/* SALA 5 Badge */}
              <div className="px-3 py-0.5 rounded bg-[#0b2538] border border-[#00e5ff]/50 text-[#00e5ff] text-[10px] font-bold tracking-tight mb-2">
                SALA 5 (Catedral/Arena)
              </div>

              {/* Big Metallic Reverb Rotary Knob */}
              <div className="relative flex flex-col items-center my-1">
                {/* Labels around knob: +15 dB at top, 0 at bottom left, peak bottom center, +15 bottom right */}
                <span className="text-[9.5px] font-mono text-gray-300 font-bold mb-1">+15 dB</span>

                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startReverbKnobDrag(e.clientY, reverbGain);
                  }}
                  className="w-20 h-20 rounded-full knob-big-reverb relative flex items-center justify-center cursor-ns-resize shadow-lg shadow-black/80"
                >
                  {/* Needle indicator */}
                  <div
                    className="w-full h-full relative flex items-start justify-center transition-transform duration-75 pointer-events-none"
                    style={{ transform: `rotate(${reverbAngle}deg)` }}
                  >
                    <div className="w-1 h-6 bg-gradient-to-b from-[#00e5ff] to-gray-200 rounded-full mt-1" />
                  </div>
                  {/* Center Hub */}
                  <div className="absolute w-5 h-5 rounded-full bg-[#191f2b] border border-[#3b4759]" />
                </div>

                {/* Bottom knob labels */}
                <div className="flex justify-between w-24 text-[9px] font-mono text-gray-400 mt-1 px-1">
                  <span>0</span>
                  <span className="text-gray-500">peak</span>
                  <span>+15</span>
                </div>
              </div>

              {/* Digital readout: 15.0 dB @ 10 */}
              <div className="mt-2 px-4 py-1 rounded bg-[#080d12] border border-[#162534] shadow-inner">
                <span className="text-neon-cyan font-mono text-sm font-bold tracking-widest">
                  {reverbGain.toFixed(1)} dB @ {reverbDensity}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: VOLUMEN MAESTRO DAC + ESPACIALIDAD (FADERS DSP) */}
        <div className="w-[195px] flex flex-col space-y-2 shrink-0">
          {/* Superior: VOLUMEN MAESTRO DAC (GoMix) */}
          <div className="panel-block p-2 flex flex-col justify-between">
            <div className="text-[9.5px] font-bold text-center text-gray-200 mb-2">
              VOLUMEN MAESTRO<br />DAC (GoMix)
            </div>

            {/* Fader 1 Horizontal */}
            <div className="flex items-center space-x-2 my-1">
              <div
                onPointerDown={(e) => startHorizontalSliderDrag(e, -20, 12, 1, setDacVol1, (val) => callNative('updateMasterVolume', Math.round(((val + 20) / 32) * 100)))}
                className="flex-1 h-4 relative flex items-center cursor-pointer"
              >
                <div className="w-full h-1 bg-[#00e5ff] rounded-full relative">
                  <div
                    className="absolute w-2.5 h-4 fader-thumb-textured rounded-[2px] top-1/2 -translate-y-1/2 cursor-ew-resize"
                    style={{
                      left: `calc(${((dacVol1 + 20) / 32) * 100}% - 5px)`,
                    }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono text-gray-300 font-bold w-10 text-right">
                {dacVol1 > 0 ? `+${dacVol1}` : dacVol1} dB
              </span>
            </div>

            {/* Fader 2 Horizontal */}
            <div className="flex items-center space-x-2 my-1">
              <div
                onPointerDown={(e) => startHorizontalSliderDrag(e, -20, 12, 1, setDacVol2)}
                className="flex-1 h-4 relative flex items-center cursor-pointer"
              >
                <div className="w-full h-1 bg-[#00e5ff] rounded-full relative">
                  <div
                    className="absolute w-2.5 h-4 fader-thumb-textured rounded-[2px] top-1/2 -translate-y-1/2 cursor-ew-resize"
                    style={{
                      left: `calc(${((dacVol2 + 20) / 32) * 100}% - 5px)`,
                    }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono text-gray-300 font-bold w-10 text-right">
                {dacVol2 > 0 ? `+${dacVol2}` : dacVol2} dB
              </span>
            </div>
          </div>

          {/* Inferior: 3 Faders Verticales DSP (SPATIAL GAIN, GANANCIA ESPACIAL 3D & PRE-AMP GLOBAL) */}
          <div className="flex-1 flex space-x-1.5">
            {/* SPATIAL GAIN */}
            <div className="flex-1 panel-block p-1.5 flex flex-col items-center justify-between">
              <div className="text-[7.5px] font-bold text-center text-gray-200 leading-tight">
                SPATIAL<br />GAIN
              </div>
              <span className="text-[8.5px] font-mono text-gray-300 font-bold">
                +{spatialGain}
              </span>

              {/* Vertical Fader */}
              <div
                onPointerDown={(e) => startVerticalSliderDrag(e, 0, 15, 1, setSpatialGain, (val) => callNative('updateSurround', Math.round((val / 15) * 100)))}
                className="flex-1 w-4 relative flex items-center justify-center cursor-pointer my-1"
              >
                <div className="w-1 h-full bg-[#00e5ff] rounded-full relative">
                  <div
                    className="absolute w-3 h-2 fader-thumb-textured rounded-[1px] -left-1"
                    style={{
                      bottom: `calc(${(spatialGain / 15) * 100}% - 4px)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* GANANCIA ESPACIAL (3D) */}
            <div className="flex-1 panel-block p-1.5 flex flex-col items-center justify-between">
              <div className="text-[7.5px] font-bold text-center text-gray-200 leading-tight">
                GANANCIA<br />ESPACIAL
              </div>
              <span className="text-[8.5px] font-mono text-gray-300 font-bold">
                +{surround3D}
              </span>

              {/* Vertical Fader */}
              <div
                onPointerDown={(e) => startVerticalSliderDrag(e, 0, 15, 1, setSurround3D, (val) => callNative('updateClarity', Math.round((val / 15) * 100)))}
                className="flex-1 w-4 relative flex items-center justify-center cursor-pointer my-1"
              >
                <div className="w-1 h-full bg-[#00e5ff] rounded-full relative">
                  <div
                    className="absolute w-3 h-2 fader-thumb-textured rounded-[1px] -left-1"
                    style={{
                      bottom: `calc(${(surround3D / 15) * 100}% - 4px)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* GANANCIA PRE-AMP GLOBAL (0 a +20 dB - Fader Rojo Carmesí) */}
            <div className="flex-1 panel-block p-1.5 flex flex-col items-center justify-between border-red-900/60 bg-[#150e12]">
              <div className="text-[7px] font-bold text-center text-red-400 leading-tight">
                PRE-AMP<br />GLOBAL
              </div>
              <span className="text-[8.5px] font-mono text-red-400 font-bold">
                +{preAmpGain}dB
              </span>

              {/* Vertical Fader con acento rojo carmesí */}
              <div
                onPointerDown={(e) => startVerticalSliderDrag(e, 0, 20, 1, setPreAmpGain, (val) => callNative('updatePreAmp', val))}
                className="flex-1 w-4 relative flex items-center justify-center cursor-pointer my-1"
                style={{ touchAction: 'none' }}
              >
                <div className="w-1 h-full bg-red-600 rounded-full relative">
                  <div
                    className="absolute w-3 h-2 bg-red-500 border border-red-300 rounded-[1px] -left-1 shadow-sm shadow-red-500/80"
                    style={{
                      bottom: `calc(${(preAmpGain / 20) * 100}% - 4px)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SLOTS P1 AL P7 (BARRA INFERIOR DE PERFILES ESTABLES) */}
      <div className="mx-2 flex space-x-2 shrink-0">
        {[1, 2, 3, 4, 5, 6, 7].map(slotNum => (
          <button
            key={slotNum}
            onClick={() => handleProfileSlotClick(slotNum)}
            className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-sm border transition-all ${
              activeProfileId === slotNum
                ? 'bg-[#3b4759] text-white border-cyan-400 shadow-sm shadow-cyan-400/30'
                : 'bg-[#222b3b] text-gray-300 border-[#2f3b4f] hover:bg-[#2c374b]'
            }`}
          >
            P{slotNum}
          </button>
        ))}
      </div>

      {/* 6. PIE DE PÁGINA PERMANENTE */}
      <div className="mx-2 py-0.5 flex justify-between items-center text-[9.5px] font-mono shrink-0">
        <span className="text-neon-green tracking-wider font-bold">
          ULTRA-LINK • MULTI-SESSION 0/121 • NO-LAG
        </span>
        <span className="text-gray-500 text-[8.5px]">
          Exynos 7570 • Android Go Edition
        </span>
      </div>

      {/* 7. NATIVE ANDROID OREO WARNING MODAL (P1 al P7) */}
      {dialogTargetProfile !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={() => setDialogTargetProfile(null)}
        >
          <div
            className="oreo-dialog-card w-[310px] p-5 rounded-none flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title */}
            <div className="text-base font-bold text-gray-900 leading-tight">
              Guardar Perfil (Todo+Efectos)
            </div>

            {/* Warning Text: ¿Deseas sobreescribir el perfil P2 existente? */}
            <div className="text-sm text-[#0288d1] font-medium leading-snug">
              ¿Deseas sobreescribir el perfil P{dialogTargetProfile} existente?
            </div>

            {/* Input with blue underline */}
            <div className="pt-1">
              <input
                type="text"
                value={profileInputName}
                onChange={(e) => setProfileInputName(e.target.value)}
                placeholder="Añadir nombre..."
                className="w-full bg-transparent border-b-2 border-[#1976d2] pb-1 text-sm text-gray-900 outline-none placeholder-gray-400 font-sans"
                autoFocus
              />
            </div>

            {/* Action Buttons: CANCELAR & SOBREESCRIBIR */}
            <div className="flex justify-end items-center space-x-4 pt-3">
              <button
                onClick={() => setDialogTargetProfile(null)}
                className="text-xs font-bold text-[#1976d2] hover:bg-blue-50 px-2 py-1 rounded-sm uppercase tracking-wider transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={handleConfirmOverwrite}
                className="text-xs font-bold text-[#1976d2] hover:bg-blue-50 px-2 py-1 rounded-sm uppercase tracking-wider transition-colors"
              >
                SOBREESCRIBIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
