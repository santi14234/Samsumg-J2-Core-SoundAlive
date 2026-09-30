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

  return (
    <div className="bg-black border border-neutral-800 rounded-2xl p-4 select-none touch-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-neutral-200">
            Bandas del Ecualizador
          </h3>
          <p className="text-xs text-neutral-500">
            Ajuste detallado de frecuencias (63Hz a 16kHz)
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled || bands.every((b) => b === 0)}
          className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 disabled:opacity-30 transition-colors px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 active:bg-neutral-800"
        >
          <RotateCcw className="w-3 h-3" />
          Plano
        </button>
      </div>

      {/* 9 Vertical Sliders */}
      <div
        className={`grid grid-cols-9 gap-1 select-none touch-none ${
          disabled ? 'opacity-30 pointer-events-none' : ''
        }`}
        style={{ touchAction: 'none' }}
      >
        {bands.map((val, idx) => {
          const freq = EQ_FREQUENCIES[idx];
          return (
            <div
              key={freq}
              className="flex flex-col items-center select-none touch-none"
              style={{ touchAction: 'none' }}
            >
              {/* Value indicator */}
              <span
                className={`text-[10px] font-mono mb-2 transition-colors ${
                  val !== 0 ? 'text-sky-400 font-bold' : 'text-neutral-500'
                }`}
              >
                {val > 0 ? `+${val}` : val}
              </span>

              {/* Vertical Slider Track */}
              <div
                className="relative h-44 w-7 sm:w-8 flex items-center justify-center py-2 bg-neutral-950 border border-neutral-800 rounded-xl touch-none overflow-hidden"
                style={{ touchAction: 'none' }}
              >
                {/* 0dB center line */}
                <div className="absolute w-full border-t border-neutral-700/60 top-1/2 -translate-y-1/2 pointer-events-none" />

                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={val}
                  onChange={(e) => onChangeBand(idx, parseInt(e.target.value, 10))}
                  aria-label={`${formatFreq(freq)}Hz slider`}
                  className="w-full h-full cursor-pointer touch-none"
                  style={{
                    WebkitAppearance: 'slider-vertical',
                    touchAction: 'none',
                    accentColor: '#0ea5e9',
                  }}
                />
              </div>

              {/* Frequency Label */}
              <div className="mt-2 text-center pointer-events-none">
                <span className="text-[10px] font-semibold text-neutral-300 block">
                  {formatFreq(freq)}
                </span>
                <span className="text-[8px] text-neutral-600 block uppercase">Hz</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
