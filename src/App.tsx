import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Power,
  RotateCcw,
  Activity,
  Bookmark,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  Volume2,
  ShieldAlert,
  Layers,
  ChevronRight
} from 'lucide-react';

interface Profile {
  id: number;
  name: string;
  gains: number[];
  qValues: number[];
  masterPower: boolean;
  fxsoundMode: boolean;
  deepBass: number;
  clarity: number;
  surround: number;
  reverbPreset: number;
  reverbMix: number;
  masterVolume: number; // -12 to +12 dB
  limiterThreshold: number; // -20 to 0 dB
}

// Global safe Native Bridge caller (supporting both window.WebAppInterface & window.AndroidAudio)
const callNative = (methodName: string, ...args: any[]) => {
  const win = window as any;
  const bridge = win.WebAppInterface || win.AndroidAudio;
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
  const [activeTab, setActiveTab] = useState<'eq' | 'fxsound' | 'presets' | 'settings'>('eq');
  const [masterPower, setMasterPower] = useState<boolean>(true);
  const [fxsoundMode, setFxsoundMode] = useState<boolean>(true);

  // 10 EQ Bands (Gain in dB: -12 to +12)
  const frequencies = ['41Hz', '63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // 10 Independent Q-Factors / Resonance Sharpness (0.5x to 3.0x)
  const [eqQValues, setEqQValues] = useState<number[]>([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]);

  // FxSound DSP Controls
  const [deepBass, setDeepBass] = useState<number>(65); // 0-100%
  const [clarity, setClarity] = useState<number>(70); // 0-100%
  const [surround, setSurround] = useState<number>(50); // 0-100%
  const [reverbPreset, setReverbPreset] = useState<number>(4); // Default: 4 (Sala 5 Catedral/Arena)
  const [reverbMix, setReverbMix] = useState<number>(5); // 0 to 10 (0 to 100%)
  const [masterVolume, setMasterVolume] = useState<number>(0); // -12 to +12 dB
  const [limiterThreshold, setLimiterThreshold] = useState<number>(-3); // -20 to 0 dB

  // Profiles (P1 to P7)
  const [currentProfileId, setCurrentProfileId] = useState<number>(1);
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: 1, name: 'FxSound Reference', gains: [3, 2, 1, 0, 1, 4, 3, 2, 4, 5], qValues: [1.2, 1.0, 1.0, 1.0, 1.1, 1.5, 1.4, 1.2, 1.5, 1.8], masterPower: true, fxsoundMode: true, deepBass: 70, clarity: 75, surround: 60, reverbPreset: 4, reverbMix: 5, masterVolume: 2, limiterThreshold: -3 },
    { id: 2, name: 'Electronic Boost', gains: [6, 5, 2, -1, -2, 2, 4, 5, 6, 4], qValues: [2.0, 1.8, 1.0, 1.0, 1.0, 1.2, 1.5, 1.8, 2.0, 1.5], masterPower: true, fxsoundMode: true, deepBass: 85, clarity: 80, surround: 70, reverbPreset: 4, reverbMix: 6, masterVolume: 4, limiterThreshold: -2 },
    { id: 3, name: 'Vocal Presence', gains: [-2, -1, 0, 2, 5, 7, 6, 3, 1, 0], qValues: [1.0, 1.0, 1.0, 1.2, 2.0, 2.5, 2.2, 1.5, 1.0, 1.0], masterPower: true, fxsoundMode: true, deepBass: 40, clarity: 90, surround: 45, reverbPreset: 1, reverbMix: 4, masterVolume: 0, limiterThreshold: -4 },
    { id: 4, name: 'Rock Stadium', gains: [4, 3, 1, 0, 2, 5, 4, 3, 5, 6], qValues: [1.5, 1.3, 1.0, 1.0, 1.2, 1.8, 1.6, 1.4, 1.8, 2.2], masterPower: true, fxsoundMode: true, deepBass: 65, clarity: 70, surround: 80, reverbPreset: 3, reverbMix: 7, masterVolume: 3, limiterThreshold: -3 },
    { id: 5, name: 'Deep Bass J2 Core', gains: [8, 7, 4, 1, 0, 1, 2, 1, 2, 3], qValues: [2.5, 2.2, 1.5, 1.0, 1.0, 1.0, 1.1, 1.0, 1.2, 1.3], masterPower: true, fxsoundMode: true, deepBass: 95, clarity: 60, surround: 50, reverbPreset: 4, reverbMix: 5, masterVolume: 5, limiterThreshold: -2 },
    { id: 6, name: 'Acoustic Pure', gains: [1, 2, 3, 2, 1, 3, 4, 3, 2, 2], qValues: [1.0, 1.1, 1.2, 1.1, 1.0, 1.3, 1.5, 1.3, 1.1, 1.1], masterPower: true, fxsoundMode: true, deepBass: 30, clarity: 85, surround: 40, reverbPreset: 0, reverbMix: 3, masterVolume: 0, limiterThreshold: -5 },
    { id: 7, name: 'Catedral / Arena Max', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], qValues: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], masterPower: true, fxsoundMode: true, deepBass: 60, clarity: 70, surround: 65, reverbPreset: 4, reverbMix: 10, masterVolume: 2, limiterThreshold: -3 },
  ]);

  const [deviceModel, setDeviceModel] = useState<string>('Samsung Galaxy J2 Core');
  const [audioSessionId, setAudioSessionId] = useState<number>(121);
  const [rootStatusLog, setRootStatusLog] = useState<string>('Session 121 / 0 Active • Hardware Reverb & SW Double Injection Ready');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Dragging State for Pointer Events
  const draggingRef = useRef<{ index: number; startY: number; startGain: number } | null>(null);

  // Initialize Native state
  useEffect(() => {
    const model = callNative('getDeviceModel');
    if (model) setDeviceModel(model);
    const session = callNative('getActiveAudioSession');
    if (session) setAudioSessionId(session);
  }, []);

  // Sync EQ Band Gain to State and Java Bridge
  const updateGain = useCallback((index: number, val: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(val)));
    setEqGains(prev => {
      const next = [...prev];
      if (next[index] === clamped) return prev;
      next[index] = clamped;
      return next;
    });
    callNative('updateEqualizerBand', index, clamped);
    callNative('updateBandLevel', index, clamped * 100);
  }, []);

  // Update Q Factor (Sharpness)
  const updateQ = useCallback((index: number, val: number) => {
    const rounded = Math.round(val * 10) / 10;
    setEqQValues(prev => {
      const next = [...prev];
      next[index] = rounded;
      return next;
    });
    callNative('updateBandQ', index, rounded);
  }, []);

  // POINTER EVENTS IMPLEMENTATION FOR 100% UNFREEZE & INDEPENDENT VERTICAL DRAG
  const handlePointerDown = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = {
      index,
      startY: e.clientY,
      startGain: eqGains[index]
    };
  };

  const handlePointerMove = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || draggingRef.current.index !== index) return;
    e.preventDefault();
    e.stopPropagation();

    const deltaY = draggingRef.current.startY - e.clientY; // upward drag = positive
    // Sensitivity: 120 pixels covers the full 24 dB range (-12 to +12)
    const deltaGain = (deltaY / 120) * 24;
    const newGain = draggingRef.current.startGain + deltaGain;
    updateGain(index, newGain);
  };

  const handlePointerUp = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current && draggingRef.current.index === index) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (ignored) {}
      draggingRef.current = null;
    }
  };

  // Master Power
  const toggleMasterPower = () => {
    const next = !masterPower;
    setMasterPower(next);
    callNative('setMasterPower', next);
  };

  // FxSound Mode
  const toggleFxsoundMode = () => {
    const next = !fxsoundMode;
    setFxsoundMode(next);
    callNative('setFxsoundMode', next);
  };

  // Sync Reverb Atmosphere & DSP to Java
  useEffect(() => {
    callNative('updateAtmosphere', reverbPreset, reverbMix);
  }, [reverbPreset, reverbMix]);

  useEffect(() => {
    callNative('updateDeepBass', deepBass);
    callNative('updateClarity', clarity);
    callNative('updateSurround', surround);
    callNative('updateMasterVolume', masterVolume);
    callNative('updateLimiter', limiterThreshold);
  }, [deepBass, clarity, surround, masterVolume, limiterThreshold]);

  // Load Profile
  const selectProfile = (p: Profile) => {
    setCurrentProfileId(p.id);
    setEqGains([...p.gains]);
    setEqQValues(p.qValues ? [...p.qValues] : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    setMasterPower(p.masterPower);
    setFxsoundMode(p.fxsoundMode);
    setDeepBass(p.deepBass);
    setClarity(p.clarity);
    setSurround(p.surround);
    setReverbPreset(p.reverbPreset);
    setReverbMix(p.reverbMix);
    setMasterVolume(p.masterVolume);
    setLimiterThreshold(p.limiterThreshold);

    callNative('loadProfile', p.id);
  };

  // Save current state to profile
  const saveCurrentProfile = () => {
    const updated = profiles.map(p => {
      if (p.id === currentProfileId) {
        return {
          ...p,
          gains: [...eqGains],
          qValues: [...eqQValues],
          masterPower,
          fxsoundMode,
          deepBass,
          clarity,
          surround,
          reverbPreset,
          reverbMix,
          masterVolume,
          limiterThreshold
        };
      }
      return p;
    });
    setProfiles(updated);
    setRootStatusLog(`Profile P${currentProfileId} saved to SharedPreferences!`);
    callNative('saveCurrentProfile', currentProfileId);
    setTimeout(() => {
      setRootStatusLog('Session 121 / 0 Active • Hardware Reverb & SW Double Injection Ready');
    }, 3000);
  };

  // FAST SPLINE CANVAS DRAWING ON GAIN CHANGE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Subtle Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    [0.2, 0.5, 0.8].forEach(r => {
      ctx.beginPath();
      ctx.moveTo(0, height * r);
      ctx.lineTo(width, height * r);
      ctx.stroke();
    });

    // Spline curve connecting all 10 gains (-12 to +12 dB)
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#007fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const stepX = width / (eqGains.length - 1);
    const points = eqGains.map((gain, i) => {
      const normalized = (gain + 12) / 24; // 0 to 1
      return {
        x: i * stepX,
        y: height - (normalized * (height - 12) + 6)
      };
    });

    points.forEach((pt, i) => {
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        const prev = points[i - 1];
        const cpX = (prev.x + pt.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, pt.y, pt.x, pt.y);
      }
    });
    ctx.stroke();

    // Render little neon nodes on the points
    points.forEach(pt => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, [eqGains]);

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#0b0d11] text-white select-none overflow-hidden font-sans"
      style={{ touchAction: 'none' }}
      onTouchMove={(e) => { e.preventDefault(); }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#12161f] border-b border-[#1f293d] shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold tracking-wider text-xs bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                SOUNDALIVE PRO <span className="text-[10px] text-cyan-400 font-mono">v1.2.47</span>
              </span>
              <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded border border-emerald-500/30">
                ROOT ACTIVE
              </span>
            </div>
            <div className="text-[9px] text-gray-400 truncate max-w-[190px]">
              {deviceModel} • S{audioSessionId}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Master Power Toggle */}
          <button
            onClick={toggleMasterPower}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              masterPower
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/40'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{masterPower ? 'ON' : 'BYPASS'}</span>
          </button>

          {/* FxSound Engine Mode Toggle */}
          <button
            onClick={toggleFxsoundMode}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              fxsoundMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/40'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{fxsoundMode ? 'FX DSP' : 'BASIC'}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 bg-[#161b26] border-b border-[#212c42] text-[11px] font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('eq')}
            className={`py-2 text-center transition-colors border-b-2 ${
              activeTab === 'eq'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            10-BAND EQ
          </button>
          <button
            onClick={() => setActiveTab('fxsound')}
            className={`py-2 text-center transition-colors border-b-2 ${
              activeTab === 'fxsound'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            FXSOUND DSP
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-2 text-center transition-colors border-b-2 ${
              activeTab === 'presets'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            PROFILES (P1-7)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 text-center transition-colors border-b-2 ${
              activeTab === 'settings'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            ROOT ENGINE
          </button>
        </div>

        {/* TAB 1: 10-BAND EQ WITH POINTER EVENTS, DYNAMIC ROTATING KNOBS & SPLINE CURVE */}
        {activeTab === 'eq' && (
          <div
            className="flex-1 flex flex-col p-2.5 overflow-hidden space-y-2"
            style={{ touchAction: 'none' }}
          >
            {/* Top Spline Curve Canvas */}
            <div className="bg-[#12161f] border border-[#212c42] rounded-lg p-1.5 relative shadow-inner shrink-0">
              <div className="absolute top-1 left-2 text-[9px] font-mono text-cyan-400 flex items-center space-x-1">
                <SlidersHorizontal className="w-2.5 h-2.5" />
                <span>FREQUENCY RESPONSE CURVE (SPLINE)</span>
              </div>
              <canvas ref={canvasRef} width={500} height={52} className="w-full h-12 mt-2 pointer-events-none" />
            </div>

            {/* 10 Vertical Channels Horizontal Row with Pointer Events */}
            <div
              className="flex-1 bg-[#12161f] border border-[#212c42] rounded-xl p-2 flex justify-between items-center space-x-1.5 overflow-hidden select-none"
              style={{ touchAction: 'none' }}
            >
              {frequencies.map((freq, idx) => {
                const gain = eqGains[idx];
                const normalized = (gain + 12) / 24; // 0 to 1
                const angle = (gain / 12) * 135; // -135deg to +135deg rotation

                return (
                  <div
                    key={idx}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    onPointerMove={(e) => handlePointerMove(idx, e)}
                    onPointerUp={(e) => handlePointerUp(idx, e)}
                    className="flex-1 flex flex-col items-center justify-between h-full py-1 bg-[#171d29] rounded-lg border border-[#232e45] cursor-ns-resize hover:border-cyan-500/50 transition-colors select-none"
                    style={{ touchAction: 'none' }}
                  >
                    {/* 1. Top: Decibel Indicator */}
                    <div className="text-[9px] font-mono font-bold text-cyan-300 bg-[#0b0d11] px-1 py-0.5 rounded border border-cyan-500/20">
                      {gain > 0 ? `+${gain}` : gain}dB
                    </div>

                    {/* 2. Center: Linear Fader Channel */}
                    <div className="relative flex-1 w-2 bg-[#0b0d11] rounded-full my-1.5 flex items-end justify-center pointer-events-none">
                      {/* Active Gain Fill Bar */}
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(6, normalized * 100)}%` }}
                      />
                      {/* Fader Handle */}
                      <div
                        className="absolute w-4 h-2 bg-white rounded shadow-md border border-cyan-400"
                        style={{ bottom: `calc(${normalized * 100}% - 4px)` }}
                      />
                    </div>

                    {/* 3. Knob Component: Turns dynamically with vertical drag (-135deg to +135deg) */}
                    <div
                      className="w-6 h-6 rounded-full bg-[#202738] border-2 border-cyan-500/60 relative flex items-center justify-center shadow-md shadow-cyan-900/40 pointer-events-none"
                    >
                      {/* Knob Indicator Dot */}
                      <div
                        className="absolute w-1 h-2 bg-cyan-400 rounded-full top-0.5 origin-bottom transition-transform duration-75"
                        style={{ transform: `rotate(${angle}deg)` }}
                      />
                      <span className="text-[7px] font-mono text-gray-300">
                        {eqQValues[idx]}x
                      </span>
                    </div>

                    {/* 4. Foot: Fixed Frequency Label */}
                    <div className="text-[9px] font-bold text-gray-300 mt-1 font-mono">
                      {freq}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex space-x-2 shrink-0">
              <button
                onClick={() => {
                  setEqGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                  setEqQValues([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
                  callNative('resetEqualizer');
                }}
                className="flex-1 py-1.5 bg-[#1b2230] hover:bg-[#232d42] border border-[#2a3650] rounded-lg text-xs font-semibold text-gray-300 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>Reset EQ Flats (0 dB)</span>
              </button>

              <button
                onClick={saveCurrentProfile}
                className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-500/20 transition-all"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save to P{currentProfileId}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: FXSOUND DSP & EXTREME REVERB ARCHITECTURE */}
        {activeTab === 'fxsound' && (
          <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3" style={{ touchAction: 'pan-y' }}>
            
            {/* 5 Rooms Selector (Acoustic Presets) */}
            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-200">ROOM TYPE SELECTOR (5 ACOUSTIC PRESETS)</span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {reverbPreset === 4 ? 'Catedral (+15dB 1k / +10dB 2k)' : `Sala ${reverbPreset + 1}`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 0, name: 'Estudio', desc: '+3dB 1k' },
                  { id: 1, name: 'Habitación', desc: '+5dB 1k' },
                  { id: 2, name: 'Estadio', desc: '+7dB 1k' },
                  { id: 3, name: 'Auditorio', desc: '+10dB 1k' },
                  { id: 4, name: 'Catedral', desc: '+15dB Extrema' },
                ].map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setReverbPreset(room.id)}
                    className={`py-2 px-1 rounded-lg text-center transition-all border ${
                      reverbPreset === room.id
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                        : 'bg-[#171d29] border-[#232e45] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] font-bold">{room.name}</div>
                    <div className="text-[8px] text-gray-400">{room.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reverb Mix Slider (0 to 10) */}
            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-200">REVERB MIX / ATMOSPHERE GAIN</span>
                <span className="text-xs font-mono font-bold text-cyan-400">{reverbMix} / 10 ({reverbMix * 10}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={reverbMix}
                onChange={(e) => setReverbMix(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-[#0b0d11] rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>0 (Plano / Bypass)</span>
                <span>5 (Auditorio FxSound)</span>
                <span>10 (Saturación Extrema +15dB)</span>
              </div>
            </div>

            {/* 4 Core DSP Sliders */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Deep Bass */}
              <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-gray-200">DEEP BASS</span>
                  <span className="text-[11px] font-mono text-cyan-400">{deepBass}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={deepBass}
                  onChange={(e) => setDeepBass(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[9px] text-gray-500 mt-0.5">Sub-Bass BassBoost HW</span>
              </div>

              {/* 3D Clarity */}
              <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-gray-200">3D CLARITY</span>
                  <span className="text-[11px] font-mono text-cyan-400">{clarity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={clarity}
                  onChange={(e) => setClarity(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[9px] text-gray-500 mt-0.5">16kHz High-Pass Presence</span>
              </div>

              {/* 3D Surround */}
              <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-gray-200">3D SURROUND</span>
                  <span className="text-[11px] font-mono text-cyan-400">{surround}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={surround}
                  onChange={(e) => setSurround(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[9px] text-gray-500 mt-0.5">Stereo Virtualizer Session 0</span>
              </div>

              {/* Normalization Limiter */}
              <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-gray-200">NORMALIZATION</span>
                  <span className="text-[11px] font-mono text-cyan-400">{limiterThreshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="0"
                  value={limiterThreshold}
                  onChange={(e) => setLimiterThreshold(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[9px] text-gray-500 mt-0.5">Peak Limiter Threshold</span>
              </div>
            </div>

            {/* Synchronized Master Volume */}
            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3 flex flex-col space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-gray-200">VOLUMEN MAESTRO (LOUDNESS ENHANCER)</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {masterVolume > 0 ? `+${masterVolume}` : masterVolume} dB
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-[#0b0d11] rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>-12 dB (Atenuación)</span>
                <span>0 dB (Ganancia Unitaria)</span>
                <span>+12 dB (Preamp de Potencia)</span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: PROFILES PERSISTENCE (P1 to P7) */}
        {activeTab === 'presets' && (
          <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-2" style={{ touchAction: 'pan-y' }}>
            <div className="text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
              <span>PERSISTENT PROFILES (SLOTS P1 - P7)</span>
              <span className="text-[10px] text-cyan-400 font-mono">SharedPreferences Memory</span>
            </div>
            {profiles.map((p) => (
              <div
                key={p.id}
                onClick={() => selectProfile(p)}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentProfileId === p.id
                    ? 'bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border-cyan-400 shadow-md shadow-cyan-500/15'
                    : 'bg-[#12161f] border-[#212c42] hover:bg-[#181f2d]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                    currentProfileId === p.id ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/50' : 'bg-[#1c2436] text-gray-400'
                  }`}>
                    P{p.id}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{p.name}</div>
                    <div className="text-[9px] text-gray-400">
                      Bass: {p.deepBass}% • Clarity: {p.clarity}% • Reverb Mix: {p.reverbMix}/10 • Vol: {p.masterVolume}dB
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {currentProfileId === p.id && (
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[9px] font-semibold rounded-full border border-cyan-500/30">
                      ACTIVE
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ROOT ENGINE DIAGNOSTIC */}
        {activeTab === 'settings' && (
          <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3" style={{ touchAction: 'pan-y' }}>
            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                <ShieldAlert className="w-4 h-4" />
                <span>ROOT HARDWARE DIAGNOSTIC (GALAXY J2 CORE)</span>
              </div>
              <div className="text-[11px] text-gray-300 leading-relaxed">
                SoundAlive Pro procesa inyección dual por hardware (NXP/Exynos) y emulación por software sobre la clase Equalizer en Session 0 global y Session 121 (DAC de ZXTune y YouTube Vanced).
              </div>
              <div className="p-2.5 bg-[#0b0d11] rounded-lg border border-cyan-500/20 font-mono text-[9px] text-cyan-300 break-words">
                {rootStatusLog}
              </div>
            </div>

            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold text-gray-200">REINICIAR SERVIDOR DE AUDIO (ROOT)</div>
              <button
                onClick={() => {
                  callNative('restartAudioServer');
                  setRootStatusLog('AudioServer reiniciado y sesiones re-enlazadas exitosamente');
                }}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-2 shadow-md shadow-purple-500/30 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reiniciar AudioServer & Re-enlazar DAC</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
