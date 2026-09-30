import React from 'react';
import { EQ_FREQUENCIES } from '../audio/types';
import { RotateCcw } from 'lucide-react';

interface GraphicEqualizerProps {
  bands: number[]; // 9 values in dB (-10 to +10)
  onChangeBand: (index: number, value: number) => void;
  onReset: () => void;
  disabled?: boolean;
}

export const GraphicEqualizer: React.FC<GraphicEqualizerProps> = ({
  bands,
  onChangeBand,
  onReset,
  disabled = false,
}) => {
  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
  };

  // Generate SVG curve points for visual EQ line
  const svgWidth = 600;
  const svgHeight = 120;
  const stepX = svgWidth / (bands.length - 1);
  const points = bands.map((val, i) => {
    const x = i * stepX;
    // val is -10 to +10. Map 0dB to y=60, +10 to y=10, -10 to y=110
    const y = 60 - (val / 10) * 45;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-[#121826]/90 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Ecualizador Gráfico de 9 Bandas
          </h3>
          <p className="text-xs text-slate-400">
            Calibración precisa por frecuencias de 63Hz a 16kHz (-10 dB a +10 dB)
          </p>
        </div>
        <button
          onClick={onReset}
          disabled={disabled || bands.every((b) => b === 0)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:hover:text-blue-400 transition-colors px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-900/40"
        >
          <RotateCcw className="w-3 h-3" />
          Plano (0 dB)
        </button>
      </div>

      {/* Mini EQ Curve Graph */}
      <div className="relative h-20 w-full mb-6 rounded-2xl bg-[#0b0f19] border border-slate-800/60 p-2 overflow-hidden">
        {/* Horizontal center 0dB line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-b border-dashed border-slate-700/50" />
        <span className="absolute right-2 top-1 text-[9px] font-mono text-slate-500">+10dB</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600">0dB</span>
        <span className="absolute right-2 bottom-1 text-[9px] font-mono text-slate-500">-10dB</span>

        <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Filled polygon under curve */}
          <polygon
            points={`0,${svgHeight} ${points} ${svgWidth},${svgHeight}`}
            fill="url(#eqGlow)"
          />
          {/* Curve stroke */}
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' }}
          />
        </svg>
      </div>

      {/* 9 Vertical Sliders */}
      <div className={`grid grid-cols-9 gap-1 sm:gap-2 select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {bands.map((val, idx) => {
          const freq = EQ_FREQUENCIES[idx];
          return (
            <div key={freq} className="flex flex-col items-center">
              {/* Value indicator */}
              <span className={`text-[10px] sm:text-xs font-mono mb-2 transition-colors ${val !== 0 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
                {val > 0 ? `+${val}` : val}
              </span>

              {/* Vertical Slider Track Container */}
              <div className="relative h-44 sm:h-52 w-8 sm:w-10 flex items-center justify-center py-2 bg-[#090d16] border border-slate-800/80 rounded-2xl">
                {/* Center 0dB notch marker */}
                <div className="absolute w-full border-t border-slate-700/60 top-1/2 -translate-y-1/2 pointer-events-none" />

                {/* Vertical Range Input */}
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={val}
                  onChange={(e) => onChangeBand(idx, parseInt(e.target.value, 10))}
                  aria-label={`${formatFreq(freq)}Hz slider`}
                  className="eq-vertical-slider"
                  style={{
                    WebkitAppearance: 'slider-vertical',
                    width: '100%',
                    height: '100%',
                    accentColor: '#3b82f6',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Frequency Label */}
              <div className="mt-3 text-center">
                <span className="text-[11px] sm:text-xs font-medium text-slate-300 block">
                  {formatFreq(freq)}
                </span>
                <span className="text-[9px] text-slate-500 block uppercase">Hz</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
