import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface SoundAliveDialsProps {
  bassTreble: number; // -100 (Bass) to 100 (Treble)
  instrumentVocal: number; // -100 (Inst) to 100 (Voc)
  onChangeBassTreble: (val: number) => void;
  onChangeInstrumentVocal: (val: number) => void;
  disabled?: boolean;
}

export const SoundAliveDials: React.FC<SoundAliveDialsProps> = ({
  bassTreble,
  instrumentVocal,
  onChangeBassTreble,
  onChangeInstrumentVocal,
  disabled = false,
}) => {
  return (
    <div className="bg-[#121826]/90 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Control de Perillas Duales
          </h3>
          <p className="text-xs text-slate-400">
            Ajuste acústico rápido característico de Samsung SoundAlive
          </p>
        </div>
        <button
          onClick={() => {
            onChangeBassTreble(0);
            onChangeInstrumentVocal(0);
          }}
          disabled={disabled || (bassTreble === 0 && instrumentVocal === 0)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:hover:text-blue-400 transition-colors px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-900/40"
        >
          <RotateCcw className="w-3 h-3" />
          Centrar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
        {/* Dial 1: Bass <-> Treble */}
        <CircularDial
          labelLeft="Graves"
          labelRight="Agudos"
          title="Tono Principal"
          value={bassTreble}
          onChange={onChangeBassTreble}
          disabled={disabled}
          color="blue"
        />

        {/* Dial 2: Instrument <-> Vocal */}
        <CircularDial
          labelLeft="Instrumento"
          labelRight="Vocal"
          title="Presencia Escénica"
          value={instrumentVocal}
          onChange={onChangeInstrumentVocal}
          disabled={disabled}
          color="cyan"
        />
      </div>
    </div>
  );
};

interface CircularDialProps {
  labelLeft: string;
  labelRight: string;
  title: string;
  value: number; // -100 to 100
  onChange: (val: number) => void;
  disabled?: boolean;
  color?: 'blue' | 'cyan';
}

const CircularDial: React.FC<CircularDialProps> = ({
  labelLeft,
  labelRight,
  title,
  value,
  onChange,
  disabled = false,
  color = 'blue',
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map value (-100 to 100) to angle (-135deg to +135deg)
  const angle = (value / 100) * 135;

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Angle in radians from 12 o'clock
      let deg = Math.atan2(dx, -dy) * (180 / Math.PI);

      // Clamp angle within -135 to 135
      if (deg > 135 && deg < 180) deg = 135;
      if (deg < -135 && deg > -180) deg = -135;
      if (deg >= 180 || deg <= -180) {
        deg = dx > 0 ? 135 : -135;
      }

      // Map back to -100 to 100
      const newVal = Math.round((deg / 135) * 100);
      onChange(Math.max(-100, Math.min(100, newVal)));
    },
    [disabled, onChange]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handlePointer(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handlePointer(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handlePointer(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      handlePointer(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, handlePointer]);

  // Tick marks around dial
  const ticks = [-135, -90, -45, 0, 45, 90, 135];

  const glowColor = color === 'cyan' ? 'rgba(6,182,212,0.3)' : 'rgba(59,130,246,0.3)';
  const activeAccent = color === 'cyan' ? '#06b6d4' : '#3b82f6';

  return (
    <div className={`flex flex-col items-center select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <span className="text-xs font-medium text-slate-400 mb-3">{title}</span>

      {/* Dial Container */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Outer Arc Scale */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 176 176">
          {/* Background Arc */}
          <circle
            cx="88"
            cy="88"
            r="70"
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
            strokeDasharray="330 110"
            strokeDashoffset="-55"
            strokeLinecap="round"
          />
          {/* Active Colored Arc */}
          <circle
            cx="88"
            cy="88"
            r="70"
            fill="none"
            stroke={activeAccent}
            strokeWidth="6"
            strokeDasharray="330 110"
            strokeDashoffset={-55 + (135 - angle) * 1.22}
            strokeLinecap="round"
            className="transition-all duration-75"
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>

        {/* Ticks */}
        {ticks.map((tAngle) => {
          const rad = ((tAngle - 90) * Math.PI) / 180;
          const x1 = 88 + Math.cos(rad) * 60;
          const y1 = 88 + Math.sin(rad) * 60;
          const x2 = 88 + Math.cos(rad) * 54;
          const y2 = 88 + Math.sin(rad) * 54;
          return (
            <svg key={tAngle} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 176 176">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tAngle === 0 ? '#94a3b8' : '#334155'}
                strokeWidth={tAngle === 0 ? 2 : 1.5}
                strokeLinecap="round"
              />
            </svg>
          );
        })}

        {/* Interactive Knob */}
        <div
          ref={dialRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="relative w-28 h-28 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center transition-shadow shadow-2xl"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #2a3447 0%, #151b27 70%, #0d121c 100%)',
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.1), 0 0 16px ${glowColor}`,
          }}
        >
          {/* Inner metallic ring */}
          <div className="absolute inset-2 rounded-full border border-slate-700/60 pointer-events-none" />

          {/* Rotating Indicator */}
          <div
            className="absolute inset-0 flex items-start justify-center pt-2 transition-transform duration-75"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            {/* Knob Notch / LED Dot */}
            <div
              className="w-2.5 h-2.5 rounded-full shadow-md transition-colors"
              style={{
                backgroundColor: activeAccent,
                boxShadow: `0 0 8px ${activeAccent}`,
              }}
            />
          </div>

          {/* Center Display */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-lg font-bold font-mono text-slate-100">
              {value > 0 ? `+${value}` : value}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {value === 0 ? 'Plano' : value < 0 ? labelLeft : labelRight}
            </span>
          </div>
        </div>
      </div>

      {/* Labels below dial */}
      <div className="w-full flex justify-between items-center px-4 mt-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => onChange(-100)}
          className={`hover:text-blue-400 transition-colors ${value < -20 ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          ◀ {labelLeft}
        </button>
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-slate-500 hover:text-slate-300 text-[10px]"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(100)}
          className={`hover:text-blue-400 transition-colors ${value > 20 ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          {labelRight} ▶
        </button>
      </div>
    </div>
  );
};
