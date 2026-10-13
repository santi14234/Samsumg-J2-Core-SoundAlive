import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Power,
  RotateCcw,
  Activity,
  Bookmark,
  Sparkles,
  SlidersHorizontal,
  Volume2,
  ShieldAlert,
  Layers,
  ChevronRight,
  Download,
  Terminal,
  RefreshCw,
  Cpu,
  Radio
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
  const [activeTab, setActiveTab] = useState<'knobs' | 'fxsound' | 'presets' | 'root'>('knobs');
  const [masterPower, setMasterPower] = useState<boolean>(true);
  const [fxsoundMode, setFxsoundMode] = useState<boolean>(true);

  // 10 EQ Bands (Gain in dB: -12 to +12)
  const frequencies = ['41Hz', '63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // 10 Independent Q-Factors / Resonance Sharpness (0.5x to 3.0x)
  const [eqQValues, setEqQValues] = useState<number[]>([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]);

  // FxSound DSP Controls (Defaults calibrated for Sala 5 Catedral/Arena +15 dB)
  const [deepBass, setDeepBass] = useState<number>(65);
  const [clarity, setClarity] = useState<number>(70);
  const [surround, setSurround] = useState<number>(50);
  const [reverbPreset, setReverbPreset] = useState<number>(5); // Default: Sala 5
  const [reverbMix, setReverbMix] = useState<number>(10); // Default: 10 (100% Saturation)
  const [masterVolume, setMasterVolume] = useState<number>(100); // 0 to 100%
  const [limiterThreshold, setLimiterThreshold] = useState<number>(-6); // -20 to 0 dB (Default: -6 dB)
  const [balance, setBalance] = useState<number>(0); // -50 to +50

  // Profiles (P1 to P7)
  const [currentProfileId, setCurrentProfileId] = useState<number>(1);
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: 1, name: 'FxSound Reference', gains: [3, 2, 1, 0, 1, 4, 3, 2, 4, 5], qValues: [1.2, 1.0, 1.0, 1.0, 1.1, 1.5, 1.4, 1.2, 1.5, 1.8], masterPower: true, fxsoundMode: true, deepBass: 70, clarity: 75, surround: 60, reverbPreset: 5, reverbMix: 10, masterVolume: 100, limiterThreshold: -6 },
    { id: 2, name: 'Electronic Boost', gains: [6, 5, 2, -1, -2, 2, 4, 5, 6, 4], qValues: [2.0, 1.8, 1.0, 1.0, 1.0, 1.2, 1.5, 1.8, 2.0, 1.5], masterPower: true, fxsoundMode: true, deepBass: 85, clarity: 80, surround: 70, reverbPreset: 5, reverbMix: 10, masterVolume: 100, limiterThreshold: -6 },
    { id: 3, name: 'Vocal Presence', gains: [-2, -1, 0, 2, 5, 7, 6, 3, 1, 0], qValues: [1.0, 1.0, 1.0, 1.2, 2.0, 2.5, 2.2, 1.5, 1.0, 1.0], masterPower: true, fxsoundMode: true, deepBass: 40, clarity: 90, surround: 45, reverbPreset: 1, reverbMix: 4, masterVolume: 90, limiterThreshold: -6 },
    { id: 4, name: 'Rock Stadium', gains: [4, 3, 1, 0, 2, 5, 4, 3, 5, 6], qValues: [1.5, 1.3, 1.0, 1.0, 1.2, 1.8, 1.6, 1.4, 1.8, 2.2], masterPower: true, fxsoundMode: true, deepBass: 65, clarity: 70, surround: 80, reverbPreset: 4, reverbMix: 7, masterVolume: 100, limiterThreshold: -6 },
    { id: 5, name: 'Deep Bass J2 Core', gains: [8, 7, 4, 1, 0, 1, 2, 1, 2, 3], qValues: [2.5, 2.2, 1.5, 1.0, 1.0, 1.0, 1.1, 1.0, 1.2, 1.3], masterPower: true, fxsoundMode: true, deepBass: 95, clarity: 60, surround: 50, reverbPreset: 5, reverbMix: 10, masterVolume: 100, limiterThreshold: -5 },
    { id: 6, name: 'Acoustic Pure', gains: [1, 2, 3, 2, 1, 3, 4, 3, 2, 2], qValues: [1.0, 1.1, 1.2, 1.1, 1.0, 1.3, 1.5, 1.3, 1.1, 1.1], masterPower: true, fxsoundMode: true, deepBass: 30, clarity: 85, surround: 40, reverbPreset: 1, reverbMix: 3, masterVolume: 90, limiterThreshold: -6 },
    { id: 7, name: 'Catedral / Arena Max', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], qValues: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], masterPower: true, fxsoundMode: true, deepBass: 60, clarity: 70, surround: 65, reverbPreset: 5, reverbMix: 10, masterVolume: 100, limiterThreshold: -6 },
  ]);

  const [deviceModel, setDeviceModel] = useState<string>('Samsung Galaxy J2 Core (SM-J260M)');
  const [rootStatusLog, setRootStatusLog] = useState<string>('Universal Session 0 Master Capture Active • Exynos 7570 Ready');
  const [isRooted, setIsRooted] = useState<boolean>(true);

  // References for throttled updates
  const gainRafRef = useRef<number | null>(null);
  const pendingGainSyncRef = useRef<{ index: number; gain: number } | null>(null);

  // Initialize Native state
  useEffect(() => {
    const model = callNative('getDeviceModel');
    if (model) setDeviceModel(model);
    const rootCheck = callNative('isRootDevice');
    if (typeof rootCheck === 'boolean') setIsRooted(rootCheck);

    // Initial sync
    callNative('inicializarMotoresAudio');
    callNative('setMasterPower', true);
    callNative('setFxsoundMode', true);
    callNative('updateAtmosphere', 5, 10);
    callNative('updateLimiter', -6);
  }, []);

  // Sync Gain to Native with RequestAnimationFrame to avoid blocking Exynos UI thread
  const syncGainToNative = useCallback((index: number, val: number) => {
    pendingGainSyncRef.current = { index, gain: val };
    if (gainRafRef.current === null) {
      gainRafRef.current = requestAnimationFrame(() => {
        gainRafRef.current = null;
        if (pendingGainSyncRef.current) {
          const { index: i, gain: g } = pendingGainSyncRef.current;
          callNative('updateBandGain', i, g);
          callNative('updateAudio', frequencies[i], g);
        }
      });
    }
  }, [frequencies]);

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
    callNative('updateBandQ', index, rounded);
  }, []);

  // WINDOW-LEVEL DRAGGING HANDLER FOR KNOBS (100% UNFREEZE & INDEPENDENT)
  const startKnobDrag = (index: number, startY: number, currentGain: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
      // 120px full range for 24 dB (-12 to +12)
      const deltaGain = (deltaY / 120) * 24;
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

  // Dragging Q Knob
  const startQDrag = (index: number, startY: number, currentQ: number) => {
    const onMove = (moveY: number) => {
      const deltaY = startY - moveY;
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
    setRootStatusLog(`Perfil P${currentProfileId} guardado con éxito en SharedPreferences.`);
    callNative('saveCurrentProfile', currentProfileId);
    setTimeout(() => {
      setRootStatusLog('Universal Session 0 Master Capture Active • Exynos 7570 Ready');
    }, 3000);
  };

  // Reconnection and AudioServer restart
  const handleForceReconnect = () => {
    callNative('reconnectSessions');
    callNative('inicializarMotoresAudio');
    setRootStatusLog('⚡ Ciclo ultrarrápido: Motores reinicializados en Session 0 y Session 121 (<1ms).');
  };

  const handleRestartAudioServer = () => {
    callNative('restartAudioServer');
    setRootStatusLog('💀 Root killall audioserver ejecutado. Reenganchando hilos en caliente...');
    setTimeout(() => {
      setRootStatusLog('Universal Session 0 Master Capture Active • Exynos 7570 Ready');
    }, 2500);
  };

  const roomNames = [
    { id: 1, name: '1. Estudio', desc: '1kHz +3dB' },
    { id: 2, name: '2. Habitación', desc: '1kHz +5dB, 2kHz +2dB' },
    { id: 3, name: '3. Estudio Pro', desc: '1kHz +7dB, 2kHz +4dB, 16kHz -2dB' },
    { id: 4, name: '4. Auditorio', desc: '1kHz +10dB, 2kHz +6dB, 500Hz -3dB' },
    { id: 5, name: '5. Catedral/Arena', desc: '1kHz +15dB, 2kHz +10dB, 500Hz -5dB' },
  ];

  // SVG Spline calculation for lightweight GPU curve
  const svgWidth = 600;
  const svgHeight = 44;
  const points = eqGains.map((gain, i) => {
    const x = (i / (eqGains.length - 1)) * (svgWidth - 20) + 10;
    const normalized = (gain + 12) / 24; // 0 to 1
    const y = svgHeight - (normalized * (svgHeight - 12) + 6);
    return { x, y };
  });

  const generateSvgPath = () => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#0b0d11] text-white select-none overflow-hidden font-sans"
      style={{ touchAction: 'none' }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#12161f] border-b border-[#1f293d] shrink-0">
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
              {deviceModel} • Universal Session 0 Master
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Kill AudioServer Button */}
          <button
            onClick={handleRestartAudioServer}
            title="Reiniciar AudioServer por Root"
            className="px-2 py-1 bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 text-red-300 rounded text-[10px] font-bold flex items-center space-x-1 transition-all"
          >
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span>KILL AUDIO</span>
          </button>

          {/* FxSound Mode Toggle */}
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

          {/* Master Power Toggle */}
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
            onClick={() => setActiveTab('knobs')}
            className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'knobs'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>10-PERILLAS EQ</span>
          </button>
          <button
            onClick={() => setActiveTab('fxsound')}
            className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'fxsound'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DINÁMICA FXSOUND</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'presets'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>PERFILES (P1-P7)</span>
          </button>
          <button
            onClick={() => setActiveTab('root')}
            className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'root'
                ? 'border-cyan-400 text-cyan-400 bg-[#1e2637]/50'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>ROOT ENGINE</span>
          </button>
        </div>

        {/* TAB 1: 10-PERILLAS GIRATORIAS (REDUCCIÓN TOTAL DE CPU Y ELIMINACIÓN DE DESLIZADORES VERTICALES) */}
        {activeTab === 'knobs' && (
          <div
            className="flex-1 flex flex-col p-2.5 overflow-hidden space-y-2"
            style={{ touchAction: 'none' }}
          >
            {/* Top Lightweight Hardware-Accelerated Spline Strip */}
            <div className="bg-[#12161f] border border-[#212c42] rounded-lg p-1.5 relative shadow-inner shrink-0">
              <div className="flex items-center justify-between text-[9px] font-mono text-cyan-400 px-1 mb-1">
                <div className="flex items-center space-x-1">
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>CURVA DE RESPUESTA ACÚSTICA • PROCESADOR EXYNOS 7570</span>
                </div>
                <span className="text-gray-400">10 Canales Independientes</span>
              </div>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-9 pointer-events-none"
                style={{ willChange: 'transform' }}
              >
                {/* Horizontal reference grid lines */}
                <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="6" x2={svgWidth} y2="6" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                <line x1="0" y1={svgHeight - 6} x2={svgWidth} y2={svgHeight - 6} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                
                {/* Dynamic neon spline path */}
                <path
                  d={generateSvgPath()}
                  fill="none"
                  stroke="#00f2fe"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0px 0px 4px #007fff)' }}
                />

                {/* Point nodes */}
                {points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="2.5"
                    fill="#ffffff"
                    stroke="#00f2fe"
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>

            {/* SECCIÓN I: 10 PERILLAS GIRATORIAS CIRCULARES METÁLICAS #2a2a2a (INDEPENDIENTES Y SIN SLIDERS) */}
            <div
              className="flex-1 bg-[#12161f] border border-[#212c42] rounded-xl p-2 flex justify-between items-center space-x-1 overflow-x-auto select-none"
              style={{ touchAction: 'none' }}
            >
              {frequencies.map((freq, idx) => {
                const gain = eqGains[idx];
                const qVal = eqQValues[idx];
                // Angle maps from -12dB -> -135deg to +12dB -> +135deg
                const knobAngle = (gain / 12) * 135;

                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-[32px] max-w-[64px] flex flex-col items-center justify-between h-full py-1 bg-[#161c28] rounded-lg border border-[#232e45] hover:border-cyan-500/60 transition-colors select-none relative"
                    style={{ touchAction: 'none' }}
                  >
                    {/* 1. Indicador Superior de Decibelios */}
                    <div
                      className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border ${
                        gain > 0
                          ? 'text-cyan-300 bg-cyan-950/40 border-cyan-500/40'
                          : gain < 0
                          ? 'text-amber-400 bg-amber-950/40 border-amber-500/30'
                          : 'text-gray-300 bg-[#0b0d11] border-gray-700'
                      }`}
                    >
                      {gain > 0 ? `+${gain}` : gain}dB
                    </div>

                    {/* 2. Perilla Giratoria Circular (#2a2a2a Metálica con Aguja Neón y Anillo Angular) */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        startKnobDrag(idx, e.clientY, gain);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches && e.touches.length > 0) {
                          startKnobDrag(idx, e.touches[0].clientY, gain);
                        }
                      }}
                      onDoubleClick={() => updateGain(idx, 0)}
                      className="relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center cursor-ns-resize my-1 select-none"
                      style={{ touchAction: 'none' }}
                      title={`Frecuencia ${freq}: ${gain} dB (Arrastre vertical para rotar, doble toque para 0 dB)`}
                    >
                      {/* Outer Ring Arc Glow */}
                      <div
                        className="absolute inset-0 rounded-full border-2 border-[#1f293d]"
                        style={{
                          background: `conic-gradient(from 225deg, #00f2fe ${Math.max(0, (gain + 12) / 24) * 270}deg, #1a2233 0deg)`
                        }}
                      />

                      {/* Knob Center Disc (Gris Oscuro Metálico #2a2a2a con relieve) */}
                      <div className="absolute inset-1 rounded-full knob-metal flex items-center justify-center pointer-events-none">
                        {/* Rotary Needle Line / Notch Indicator */}
                        <div
                          className="w-full h-full relative flex items-start justify-center transition-transform duration-75"
                          style={{ transform: `rotate(${knobAngle}deg)` }}
                        >
                          <div className="w-1 h-3 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-full mt-0.5 shadow-sm shadow-cyan-400" />
                        </div>

                        {/* Metallic Center Cap */}
                        <div className="absolute w-3.5 h-3.5 rounded-full bg-[#1b202a] border border-[#3b475c] shadow-inner flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-cyan-400" />
                        </div>
                      </div>
                    </div>

                    {/* 3. Factor Q / Resonancia Sub-control (Arrastrable de 0.5x a 3.0x) */}
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
                      className="px-1 py-0.2 bg-[#0d1118] border border-[#2b374c] rounded cursor-ns-resize hover:border-cyan-400 transition-colors"
                      style={{ touchAction: 'none' }}
                      title={`Factor Q: ${qVal}x (Arrastre arriba/abajo)`}
                    >
                      <span className="text-[7.5px] font-mono text-cyan-200">
                        Q:{qVal}x
                      </span>
                    </div>

                    {/* 4. Etiqueta Fija de Frecuencia */}
                    <div className="text-[9px] font-bold text-gray-200 font-mono mt-0.5">
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
                onClick={handleForceReconnect}
                className="py-1.5 px-3 bg-[#192231] hover:bg-[#223048] border border-cyan-500/40 rounded-lg text-xs font-semibold text-cyan-300 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                <span>Reconectar Audio (0 & 121)</span>
              </button>

              <button
                onClick={saveCurrentProfile}
                className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-500/20 transition-all"
              >
                <Bookmark className="w-3 h-3" />
                <span>Guardar en P{currentProfileId}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DINÁMICA FXSOUND PC & SALA 5 (+15 dB) */}
        {activeTab === 'fxsound' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {/* 1. Reverb Architecture: 5 Room Selector & Mix Potentiometer */}
            <div className="bg-[#141720] border border-red-950/60 rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-red-400 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-500" />
                  <span>ATMÓSFERA DE SALA (REVERB PSICOACÚSTICO FXSOUND)</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-300 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/40">
                  Mix: {reverbMix * 10}%
                </span>
              </div>

              {/* 5 Physical Room Buttons (Sala 5 por defecto) */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {roomNames.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setReverbPreset(room.id)}
                    className={`py-2 px-1 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                      reverbPreset === room.id
                        ? 'bg-gradient-to-b from-red-600 to-red-800 text-white border-red-400 shadow-md shadow-red-600/40'
                        : 'bg-[#1a1f2b] text-gray-400 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-[10px] font-bold">{room.name}</span>
                    <span className="text-[7.5px] text-gray-300 font-mono mt-0.5">{room.desc}</span>
                  </button>
                ))}
              </div>

              {/* Reverb Mix Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Dry (0% Reverb)</span>
                  <span className="text-red-400 font-bold">Nivel de Mezcla: {reverbMix}/10</span>
                  <span>Wet (100% Catedral)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={reverbMix}
                  onChange={(e) => setReverbMix(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
            </div>

            {/* 2. DSP Macro Modules: Bass, Clarity, Surround, Limiter */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Deep Bass */}
              <div className="bg-[#141720] border border-[#212c42] rounded-xl p-2.5">
                <div className="flex justify-between text-xs font-bold text-gray-200 mb-1">
                  <span>Deep Bass (Graves Sub)</span>
                  <span className="text-cyan-400 font-mono">{deepBass}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={deepBass}
                  onChange={(e) => setDeepBass(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Dynamic Clarity */}
              <div className="bg-[#141720] border border-[#212c42] rounded-xl p-2.5">
                <div className="flex justify-between text-xs font-bold text-gray-200 mb-1">
                  <span>Dynamic Clarity (Nitidez)</span>
                  <span className="text-cyan-400 font-mono">{clarity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={clarity}
                  onChange={(e) => setClarity(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* 3D Surround */}
              <div className="bg-[#141720] border border-[#212c42] rounded-xl p-2.5">
                <div className="flex justify-between text-xs font-bold text-gray-200 mb-1">
                  <span>Surround 3D (Espacial)</span>
                  <span className="text-cyan-400 font-mono">{surround}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={surround}
                  onChange={(e) => setSurround(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Master Volume Gain */}
              <div className="bg-[#141720] border border-[#212c42] rounded-xl p-2.5">
                <div className="flex justify-between text-xs font-bold text-gray-200 mb-1">
                  <span>Master Output Boost</span>
                  <span className="text-cyan-400 font-mono">{masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Anti-Clipping Limiter (-6 dB Default) */}
              <div className="bg-[#141720] border border-[#212c42] rounded-xl p-2.5 col-span-2">
                <div className="flex justify-between text-xs font-bold text-gray-200 mb-1">
                  <span className="flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Limiter Anti-Clipping DAC Samsung</span>
                  </span>
                  <span className="text-amber-400 font-mono">{limiterThreshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="0"
                  value={limiterThreshold}
                  onChange={(e) => setLimiterThreshold(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="text-[9px] text-gray-400 mt-1">
                  Protege el convertidor DAC contra saturación y distorsión armónica forzando compresión 4:1 en picos de ganancia.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERFILES FXSOUND (P1 - P7) */}
        {activeTab === 'presets' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            <div className="text-xs font-bold text-gray-300 mb-2 flex items-center justify-between">
              <span>PREAJUSTES Y BANCOS DE MEMORIA (P1 - P7)</span>
              <span className="text-[10px] text-cyan-400">Activo: P{currentProfileId}</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {profiles.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectProfile(p)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    currentProfileId === p.id
                      ? 'bg-gradient-to-r from-[#192638] to-[#121c29] border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-[#131722] border-[#222b3d] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        currentProfileId === p.id
                          ? 'bg-cyan-500 text-black font-mono'
                          : 'bg-[#1e2535] text-gray-400 font-mono'
                      }`}
                    >
                      P{p.id}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Bass: {p.deepBass}% • Clarity: {p.clarity}% • Sala: {p.reverbPreset}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {currentProfileId === p.id && (
                      <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1.5 py-0.5 rounded font-mono">
                        EN USO
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ROOT ENGINE & DIAGNÓSTICO EN TIEMPO REAL */}
        {activeTab === 'root' && (
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {/* Master Engine State */}
            <div className="bg-[#121620] border border-[#222c3f] rounded-xl p-3 shadow-lg">
              <div className="text-xs font-bold text-gray-200 mb-2.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>DIAGNÓSTICO DEL KERNEL DE AUDIO EXYNOS</span>
                </span>
                <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-600/40 text-[9px] rounded font-mono text-emerald-300">
                  UNIVERSAL SESSION 0 ACTIVA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-3">
                <div className="bg-[#171d29] p-2 rounded border border-[#232f45]">
                  <span className="text-gray-400 block">Captura Primaria:</span>
                  <span className="text-cyan-300 font-bold">Session 0 (Global System Mix)</span>
                </div>
                <div className="bg-[#171d29] p-2 rounded border border-[#232f45]">
                  <span className="text-gray-400 block">Soporte Secundario:</span>
                  <span className="text-cyan-300 font-bold">Session 121 (ZXTune DAC)</span>
                </div>
                <div className="bg-[#171d29] p-2 rounded border border-[#232f45]">
                  <span className="text-gray-400 block">Permisos Root:</span>
                  <span className={isRooted ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {isRooted ? 'Detectado y Operativo (su)' : 'No detectado'}
                  </span>
                </div>
                <div className="bg-[#171d29] p-2 rounded border border-[#232f45]">
                  <span className="text-gray-400 block">Dispositivo Destino:</span>
                  <span className="text-gray-200">{deviceModel}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleForceReconnect}
                  className="w-full py-2 bg-[#1a2538] hover:bg-[#22334e] border border-cyan-500/50 rounded-lg text-xs font-bold text-cyan-300 flex items-center justify-center space-x-2 transition-all shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>⚡ Forzar Reconexión de Sesiones 0 & 121 (&lt;1 ms)</span>
                </button>

                <button
                  onClick={handleRestartAudioServer}
                  className="w-full py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-700/60 rounded-lg text-xs font-bold text-red-300 flex items-center justify-center space-x-2 transition-all"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>💀 Reiniciar AudioServer por Root (killall audioserver)</span>
                </button>

                <a
                  href="/SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                  download="SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                  className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 rounded-lg text-xs font-bold text-white flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Descargar Proyecto Nativo Completo (ZIP)</span>
                </a>
              </div>
            </div>

            {/* Console Log */}
            <div className="bg-[#0b0e14] border border-[#1e2738] rounded-xl p-3 font-mono text-[10px]">
              <div className="text-gray-400 mb-1 flex items-center space-x-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>LOG DEL SISTEMA:</span>
              </div>
              <div className="text-cyan-300 bg-[#121620] p-2 rounded border border-[#1f283a] break-all">
                {rootStatusLog}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Status Bar */}
      <div className="px-3 py-1.5 bg-[#0f131a] border-t border-[#1f293d] flex items-center justify-between text-[10px] text-gray-400 font-mono shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
          <span className="text-gray-300">Audio Session 0 (Universal)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Sala {reverbPreset} (Mix {reverbMix * 10}%)</span>
          <span className="text-gray-600">•</span>
          <span className="text-cyan-400 font-bold">Limiter {limiterThreshold}dB</span>
        </div>
      </div>
    </div>
  );
}
