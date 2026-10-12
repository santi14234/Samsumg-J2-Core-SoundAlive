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
  ChevronRight,
  Download
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
  masterVolume: number;
  limiterThreshold: number;
}

// Global safe Native Bridge caller (supporting window.WebAppInterface & window.AndroidAudio)
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
  const [deepBass, setDeepBass] = useState<number>(65);
  const [clarity, setClarity] = useState<number>(70);
  const [surround, setSurround] = useState<number>(50);
  const [reverbPreset, setReverbPreset] = useState<number>(4); // Default: Sala 5 Catedral/Arena
  const [reverbMix, setReverbMix] = useState<number>(5); // 0 to 10
  const [masterVolume, setMasterVolume] = useState<number>(0); // -12 to +12 dB
  const [limiterThreshold, setLimiterThreshold] = useState<number>(-3); // -20 to 0 dB
  const [balance, setBalance] = useState<number>(0); // -10 to +10

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

  const [deviceModel, setDeviceModel] = useState<string>('Samsung Galaxy J2 Core (SM-J260M)');
  const [audioSessionId, setAudioSessionId] = useState<number>(121);
  const [rootStatusLog, setRootStatusLog] = useState<string>('Session 121 / 0 Active • Hardware Reverb & SW Double Injection Ready');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // References for active drags
  const gainRafRef = useRef<number | null>(null);
  const pendingGainSyncRef = useRef<{ index: number; gain: number } | null>(null);
  const pendingQSyncRef = useRef<{ index: number; q: number } | null>(null);

  // Initialize Native state
  useEffect(() => {
    const model = callNative('getDeviceModel');
    if (model) setDeviceModel(model);
    const session = callNative('getActiveAudioSession');
    if (session) setAudioSessionId(session);
  }, []);

  // Throttled native sync for gain to avoid blocking WebView UI thread
  const syncGainToNative = useCallback((index: number, val: number) => {
    pendingGainSyncRef.current = { index, gain: val };
    if (gainRafRef.current === null) {
      gainRafRef.current = requestAnimationFrame(() => {
        gainRafRef.current = null;
        if (pendingGainSyncRef.current) {
          const { index: i, gain: g } = pendingGainSyncRef.current;
          callNative('updateEqualizerBand', i, g);
          callNative('updateBandLevel', i, g * 100);
        }
      });
    }
  }, []);

  // Update Gain safely
  const updateGain = useCallback((index: number, val: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(val)));
    setEqGains(prev => {
      if (prev[index] === clamped) return prev;
      const next = [...prev];
      next[index] = clamped;
      return next;
    });
    syncGainToNative(index, clamped);
  }, [syncGainToNative]);

  // Update Q Factor safely
  const updateQ = useCallback((index: number, val: number) => {
    const rounded = Math.round(Math.max(0.5, Math.min(3.0, val)) * 10) / 10;
    setEqQValues(prev => {
      if (prev[index] === rounded) return prev;
      const next = [...prev];
      next[index] = rounded;
      return next;
    });
    pendingQSyncRef.current = { index, q: rounded };
    callNative('updateBandQ', index, rounded);
  }, []);

  // WINDOW-LEVEL DRAGGING HANDLERS FOR 100% UNFREEZE & INDEPENDENT CONTROLS
  // 1. Dragging Band Gain (channel fader)
  const startGainDrag = (index: number, startY: number, currentGain: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
      // 140px full range for 24 dB (-12 to +12)
      const deltaGain = (deltaY / 140) * 24;
      updateGain(index, currentGain + deltaGain);
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      onMove(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        onMove(e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  };

  // 2. Dragging Q Knob (circular knob at bottom)
  const startQDrag = (index: number, startY: number, currentQ: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
      // 100px for 2.5x range (0.5 to 3.0)
      const deltaQ = (deltaY / 100) * 2.5;
      updateQ(index, currentQ + deltaQ);
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      onMove(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        onMove(e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  };

  // Master Power Toggle
  const toggleMasterPower = () => {
    const next = !masterPower;
    setMasterPower(next);
    callNative('setMasterPower', next);
  };

  // FxSound Mode Toggle
  const toggleFxsoundMode = () => {
    const next = !fxsoundMode;
    setFxsoundMode(next);
    callNative('setFxsoundMode', next);
  };

  // Reverb sync
  useEffect(() => {
    callNative('updateAtmosphere', reverbPreset, reverbMix);
  }, [reverbPreset, reverbMix]);

  // FxSound DSP controls sync
  useEffect(() => {
    callNative('updateDeepBass', deepBass);
    callNative('updateClarity', clarity);
    callNative('updateSurround', surround);
    callNative('updateMasterVolume', masterVolume);
    callNative('updateLimiter', limiterThreshold);
    callNative('updateBalance', balance);
  }, [deepBass, clarity, surround, masterVolume, limiterThreshold, balance]);

  // Profile actions
  const selectProfile = (p: Profile) => {
    setCurrentProfileId(p.id);
    setEqGains([...p.gains]);
    setEqQValues([...p.qValues]);
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

  // REAL-TIME SPLINE CANVAS UPDATE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    [0.2, 0.5, 0.8].forEach(r => {
      ctx.beginPath();
      ctx.moveTo(0, height * r);
      ctx.lineTo(width, height * r);
      ctx.stroke();
    });

    // Spline curve connecting all 10 gains
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#007fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const stepX = width / (eqGains.length - 1);
    const points = eqGains.map((gain, i) => {
      const normalized = (gain + 12) / 24;
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

    // Little glowing points
    points.forEach(pt => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, [eqGains]);

  const roomNames = [
    { id: 0, name: '1. Estudio', desc: '1kHz +3dB' },
    { id: 1, name: '2. Habitación', desc: '1kHz +5dB, 2kHz +2dB' },
    { id: 2, name: '3. Estudio Pro', desc: '1kHz +7dB, 2kHz +4dB, 16kHz -2dB' },
    { id: 3, name: '4. Auditorio', desc: '1kHz +10dB, 2kHz +6dB, 500Hz -3dB' },
    { id: 4, name: '5. Catedral/Arena', desc: '1kHz +15dB, 2kHz +10dB, 500Hz -5dB' },
  ];

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#0b0d11] text-white select-none overflow-hidden font-sans"
      style={{ touchAction: 'none' }}
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
              <span className="px-1.5 py-0.2 bg-blue-950/80 border border-blue-600/40 text-[9px] rounded font-mono text-cyan-300">
                J260M
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">
              {deviceModel} • DAC 121
            </p>
          </div>
        </div>

        {/* Global Power and Mode Toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFxsoundMode}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all flex items-center space-x-1 ${
              fxsoundMode
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/30'
                : 'bg-[#1a2130] text-gray-400 border-gray-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>FXSOUND PC</span>
          </button>

          <button
            onClick={toggleMasterPower}
            className={`p-1.5 rounded-full border transition-all ${
              masterPower
                ? 'bg-emerald-500 text-white border-emerald-300 shadow-md shadow-emerald-500/40'
                : 'bg-red-950 text-red-400 border-red-800'
            }`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1f293d] bg-[#141a26] text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('eq')}
            className={`flex-1 py-2 text-center border-b-2 transition-all ${
              activeTab === 'eq'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            10-BANDAS EQ
          </button>
          <button
            onClick={() => setActiveTab('fxsound')}
            className={`flex-1 py-2 text-center border-b-2 transition-all ${
              activeTab === 'fxsound'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            DINÁMICA FXSOUND
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 text-center border-b-2 transition-all ${
              activeTab === 'presets'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            PERFILES (P1-P7)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 text-center border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            ROOT ENGINE
          </button>
        </div>

        {/* TAB 1: 10-BAND EQ WITH INDEPENDENT CHANNELS & KNOBS */}
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

            {/* 10 Vertical Channels Horizontal Row */}
            <div
              className="flex-1 bg-[#12161f] border border-[#212c42] rounded-xl p-2 flex justify-between items-center space-x-1.5 overflow-hidden select-none"
              style={{ touchAction: 'none' }}
            >
              {frequencies.map((freq, idx) => {
                const gain = eqGains[idx];
                const qVal = eqQValues[idx];
                const normalizedGain = (gain + 12) / 24; // 0 to 1
                const knobAngle = ((qVal - 0.5) / 2.5) * 270 - 135; // -135deg to +135deg rotation

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-between h-full py-1 bg-[#171d29] rounded-lg border border-[#232e45] hover:border-cyan-500/50 transition-colors select-none relative"
                    style={{ touchAction: 'none' }}
                  >
                    {/* 1. Top: Decibel Indicator */}
                    <div className="text-[9px] font-mono font-bold text-cyan-300 bg-[#0b0d11] px-1 py-0.5 rounded border border-cyan-500/20">
                      {gain > 0 ? `+${gain}` : gain}dB
                    </div>

                    {/* 2. Center: Linear Fader Channel (touch/drag to change Gain) */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        startGainDrag(idx, e.clientY, gain);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches && e.touches.length > 0) {
                          startGainDrag(idx, e.touches[0].clientY, gain);
                        }
                      }}
                      className="relative flex-1 w-full flex items-center justify-center cursor-ns-resize my-1"
                      style={{ touchAction: 'none' }}
                    >
                      <div className="w-2.5 h-full bg-[#0b0d11] rounded-full relative flex items-end justify-center pointer-events-none">
                        {/* Active Gain Fill Bar */}
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-full transition-all duration-75"
                          style={{ height: `${Math.max(6, normalizedGain * 100)}%` }}
                        />
                        {/* Fader Handle */}
                        <div
                          className="absolute w-5 h-2.5 bg-white rounded shadow-md border border-cyan-400"
                          style={{ bottom: `calc(${normalizedGain * 100}% - 5px)` }}
                        />
                      </div>
                    </div>

                    {/* 3. Bottom: Independent Rotary Knob (#2a2a2a circular knob with neon blue #007fff ring) */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        startQDrag(idx, e.clientY, qVal);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches && e.touches.length > 0) {
                          startQDrag(idx, e.touches[0].clientY, qVal);
                        }
                      }}
                      className="w-6 h-6 rounded-full bg-[#2a2a2a] border-2 border-[#007fff] relative flex items-center justify-center shadow-md shadow-blue-900/40 cursor-pointer hover:border-cyan-400 transition-colors"
                      style={{ touchAction: 'none' }}
                      title={`Factor Q / Resonancia: ${qVal}x`}
                    >
                      {/* Knob Indicator Dot */}
                      <div
                        className="absolute w-1 h-2 bg-[#007fff] rounded-full top-0.5 origin-bottom pointer-events-none transition-transform duration-75"
                        style={{ transform: `rotate(${knobAngle}deg)` }}
                      />
                      <span className="text-[7px] font-mono text-gray-200 pointer-events-none">
                        {qVal}x
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

        {/* TAB 2: FXSOUND DYNAMICS & ADVANCED RED CONTROLS */}
        {activeTab === 'fxsound' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {/* 1. Reverb Architecture: 5 Room Selector & Mix Potentiometer */}
            <div className="bg-[#141720] border border-red-950/60 rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-red-400 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-500" />
                  <span>ATMÓSFERA DE SALA (REVERB PSICOACÚSTICO HARDWARE)</span>
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Mix: {reverbMix * 10}%
                </span>
              </div>

              {/* 5 Physical Room Buttons */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {roomNames.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setReverbPreset(room.id)}
                    className={`p-1.5 rounded-lg border text-center transition-all ${
                      reverbPreset === room.id
                        ? 'bg-red-950/70 border-red-500 text-white shadow-md shadow-red-900/30'
                        : 'bg-[#1b202c] border-[#293246] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate">{room.name}</div>
                    <div className="text-[8px] font-mono text-red-300 truncate">{room.desc}</div>
                  </button>
                ))}
              </div>

              {/* Reverb Mix Slider (0 to 10) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-300">Nivel de Eco (Mix Reverb)</span>
                  <span className="text-red-400 font-bold">{reverbMix} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={reverbMix}
                  onChange={(e) => setReverbMix(parseInt(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 2. Advanced Crimson Sliders (dfxpProcessReal.cpp & FiltCalcBiqd.cpp) */}
            <div className="bg-[#141720] border border-red-950/60 rounded-xl p-3 shadow-lg space-y-3">
              <span className="text-xs font-bold text-red-400 flex items-center space-x-1.5">
                <Volume2 className="w-3.5 h-3.5 text-red-500" />
                <span>FILTROS DSP ROJO CARMESÍ (PROCESAMIENTO BIT-PERFECT)</span>
              </span>

              {/* Master Volume (-12 to +12 dB) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-300">Volumen Maestro DAC</span>
                  <span className="text-red-400 font-bold">{masterVolume > 0 ? `+${masterVolume}` : masterVolume} dB</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>

              {/* Dynamic Limiter / Ceiling (-20 to 0 dB) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-300">Normalización Dinámica (Limiter Peak)</span>
                  <span className="text-red-400 font-bold">{limiterThreshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="0"
                  step="1"
                  value={limiterThreshold}
                  onChange={(e) => setLimiterThreshold(parseInt(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>

              {/* Balance L/R (-10 to +10) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-300">Balance Simétrico L / R</span>
                  <span className="text-red-400 font-bold">{balance === 0 ? 'Centro (0)' : balance < 0 ? `L ${Math.abs(balance)}` : `R ${balance}`}</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={balance}
                  onChange={(e) => setBalance(parseInt(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>

              {/* Deep Bass, Clarity & Surround */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-[#1b202c] p-2 rounded-lg border border-[#2a3449]">
                  <div className="text-[10px] text-gray-300 mb-1">Deep Bass</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={deepBass}
                    onChange={(e) => setDeepBass(parseInt(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <div className="text-right text-[10px] text-red-400 font-mono mt-0.5">{deepBass}%</div>
                </div>

                <div className="bg-[#1b202c] p-2 rounded-lg border border-[#2a3449]">
                  <div className="text-[10px] text-gray-300 mb-1">Clarity</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clarity}
                    onChange={(e) => setClarity(parseInt(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <div className="text-right text-[10px] text-red-400 font-mono mt-0.5">{clarity}%</div>
                </div>

                <div className="bg-[#1b202c] p-2 rounded-lg border border-[#2a3449]">
                  <div className="text-[10px] text-gray-300 mb-1">3D Surround</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={surround}
                    onChange={(e) => setSurround(parseInt(e.target.value))}
                    className="w-full accent-red-500"
                  />
                  <div className="text-right text-[10px] text-red-400 font-mono mt-0.5">{surround}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROFILES (P1 TO P7) */}
        {activeTab === 'presets' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            <div className="text-xs font-bold text-gray-400 font-mono mb-1">
              PERFILES PREDEFINIDOS FXSOUND & MEMORIA DE HARDWARE (P1 - P7)
            </div>
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => selectProfile(p)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentProfileId === p.id
                    ? 'bg-[#1b2435] border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                    : 'bg-[#12161f] border-[#222c3f] text-gray-400 hover:text-white'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center space-x-2">
                    <span className="font-mono text-cyan-400">P{p.id}</span>
                    <span>{p.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                    Reverb: {roomNames[p.reverbPreset]?.name} • Mix: {p.reverbMix}/10 • Bass: {p.deepBass}%
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ROOT ENGINE & SYSTEM STATUS */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            <div className="bg-[#12161f] border border-[#212c42] rounded-xl p-3 space-y-2">
              <span className="text-xs font-bold text-cyan-400 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>ESTADO DEL MOTOR DE AUDIO ROOT & HARDWARE</span>
              </span>

              <div className="text-xs space-y-1 font-mono text-gray-300">
                <div className="flex justify-between border-b border-[#212c42] py-1">
                  <span>Dispositivo:</span>
                  <span className="text-cyan-300 font-bold">{deviceModel}</span>
                </div>
                <div className="flex justify-between border-b border-[#212c42] py-1">
                  <span>Sesión Audio DAC (ZXTune):</span>
                  <span className="text-cyan-300 font-bold">Session {audioSessionId}</span>
                </div>
                <div className="flex justify-between border-b border-[#212c42] py-1">
                  <span>Sesión Global del Sistema:</span>
                  <span className="text-cyan-300 font-bold">Session 0 (Global)</span>
                </div>
                <div className="flex justify-between border-b border-[#212c42] py-1">
                  <span>Paquete Base:</span>
                  <span className="text-cyan-300 font-bold">com.sec.android.app.soundalive</span>
                </div>
              </div>

              <div className="p-2 bg-[#0b0d11] rounded border border-cyan-500/20 text-[10px] font-mono text-cyan-300 mt-2">
                {rootStatusLog}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  callNative('inicializarMotoresAudio');
                  setRootStatusLog('Motores de audio reinicializados en sesiones 0 y 121.');
                }}
                className="w-full py-2 bg-[#172030] hover:bg-[#202b40] border border-[#263550] rounded-lg text-xs font-semibold text-cyan-400 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Forzar Reconexión de Sesiones 0 & 121</span>
              </button>

              <a
                href="/SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                download="SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-2 shadow-md shadow-cyan-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Proyecto Completo ZIP (Listo para Compilar)</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Footer */}
      <div className="px-3 py-1.5 bg-[#0f131a] border-t border-[#1c2434] flex items-center justify-between text-[10px] font-mono text-gray-400 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>DSP ACTIVE • 10 BANDAS • 5 SALAS REVERB</span>
        </div>
        <span className="text-cyan-400 font-bold">P{currentProfileId}</span>
      </div>
    </div>
  );
}
