import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface SoundAliveDialsProps {
  bassTreble: number; // -100 (Graves) to 100 (Agudos)
  instrumentVocal: number; // -100 (Instrumental) to 100 (Vocal)
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
    <div className="bg-black border border-neutral-800 rounded-2xl p-4 select-none touch-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-neutral-200">
            Ajuste Rápido (Perillas)
          </h3>
          <p className="text-xs text-neutral-500">
            Gira para balancear Graves/Agudos y Vocal/Instrumental
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChangeBassTreble(0);
            onChangeInstrumentVocal(0);
          }}
          disabled={disabled || (bassTreble === 0 && instrumentVocal === 0)}
          className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 disabled:opacity-30 transition-colors px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 active:bg-neutral-800"
        >
          <RotateCcw className="w-3 h-3" />
          Centrar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        {/* Dial 1: Graves <-> Agudos */}
        <SamsungCircularDial
          labelMin="Graves"
          labelMax="Agudos"
          title="Tono"
          value={bassTreble}
          onChange={onChangeBassTreble}
          disabled={disabled}
          accentColor="#0ea5e9"
        />

        {/* Dial 2: Instrumental <-> Vocal */}
        <SamsungCircularDial
          labelMin="Instrumental"
          labelMax="Vocal"
          title="Voz / Música"
          value={instrumentVocal}
          onChange={onChangeInstrumentVocal}
          disabled={disabled}
          accentColor="#38bdf8"
        />
      </div>
    </div>
  );
};

interface SamsungCircularDialProps {
  labelMin: string;
  labelMax: string;
  title: string;
  value: number; // -100 to 100
  onChange: (val: number) => void;
  disabled?: boolean;
  accentColor?: string;
}

const SamsungCircularDial: React.FC<SamsungCircularDialProps> = ({
  labelMin,
  labelMax,
  title,
  value,
  onChange,
  disabled = false,
  accentColor = '#0ea5e9',
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map value (-100 to 100) to angle (-135deg to +135deg)
  const angle = (value / 100) * 135;

  const calculateAngle = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Angle from 12 o'clock in degrees (-180 to +180)
      let deg = Math.atan2(dx, -dy) * (180 / Math.PI);

      // Clamp angle within -135 to 135
      if (deg > 135 && deg < 180) deg = 135;
      if (deg < -135 && deg > -180) deg = -135;
      if (deg >= 180 || deg <= -180) {
        deg = dx > 0 ? 135 : -135;
      }

      const newVal = Math.round((deg / 135) * 100);
      onChange(Math.max(-100, Math.min(100, newVal)));
    },
    [disabled, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    setIsDragging(true);
    calculateAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    calculateAngle(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsDragging(false);
  };

  // Tick marks around dial
  const ticks = [-135, -90, -45, 0, 45, 90, 135];

  return (
    <div
      className={`flex flex-col items-center select-none touch-none ${
        disabled ? 'opacity-30 pointer-events-none' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <span className="text-[11px] font-medium text-neutral-400 mb-1">{title}</span>

      {/* Dial Container */}
      <div
        ref={dialRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-36 h-36 flex items-center justify-center cursor-pointer touch-none"
        style={{ touchAction: 'none' }}
      >
        {/* Outer Arc SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 144 144"
        >
          {/* Background Track */}
          <circle
            cx="72"
            cy="72"
            r="56"
            fill="none"
            stroke="#262626"
            strokeWidth="5"
            strokeDasharray="264 88"
            strokeDashoffset="-44"
            strokeLinecap="round"
          />
          {/* Active Colored Arc */}
          <circle
            cx="72"
            cy="72"
            r="56"
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
            strokeDasharray="264 88"
            strokeDashoffset={-44 + (135 - angle) * 0.98}
            strokeLinecap="round"
          />
        </svg>

        {/* Ticks */}
        {ticks.map((tAngle) => {
          const rad = ((tAngle - 90) * Math.PI) / 180;
          const x1 = 72 + Math.cos(rad) * 48;
          const y1 = 72 + Math.sin(rad) * 48;
          const x2 = 72 + Math.cos(rad) * 43;
          const y2 = 72 + Math.sin(rad) * 43;
          return (
            <svg
              key={tAngle}
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 144 144"
            >
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tAngle === 0 ? '#737373' : '#404040'}
                strokeWidth={tAngle === 0 ? 2 : 1}
                strokeLinecap="round"
              />
            </svg>
          );
        })}

        {/* Center Knob */}
        <div
          className="relative w-22 h-22 rounded-full flex items-center justify-center bg-neutral-900 border border-neutral-700/80 shadow-lg pointer-events-none"
        >
          {/* Rotating Indicator */}
          <div
            className="absolute inset-0 flex items-start justify-center pt-1.5 pointer-events-none"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            {/* LED Dot */}
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 6px ${accentColor}`,
              }}
            />
          </div>

          {/* Value Display */}
          <div className="flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-base font-bold font-mono text-white">
              {value > 0 ? `+${value}` : value}
            </span>
            <span className="text-[9px] text-neutral-400 uppercase tracking-tight">
              {value === 0 ? '0' : value < 0 ? labelMin : labelMax}
            </span>
          </div>
        </div>
      </div>

      {/* Labels below dial */}
      <div className="w-full flex justify-between items-center px-2 mt-1 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => onChange(-100)}
          className={`transition-colors ${
            value < -20 ? 'text-sky-400 font-bold' : 'text-neutral-500'
          }`}
        >
          {labelMin}
        </button>
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-neutral-600 hover:text-neutral-400 text-[10px]"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(100)}
          className={`transition-colors ${
            value > 20 ? 'text-sky-400 font-bold' : 'text-neutral-500'
          }`}
        >
          {labelMax}
        </button>
      </div>
    </div>
  );
};
