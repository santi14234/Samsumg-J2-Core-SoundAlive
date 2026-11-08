import React from 'react';
import { EqualizerPreset, SOUNDALIVE_PRESETS } from '../audio/types';
import { SlidersHorizontal, Sparkles } from 'lucide-react';

interface PresetsSelectorProps {
  selectedPresetId: string;
  onSelectPreset: (preset: EqualizerPreset) => void;
  disabled?: boolean;
}

export const PresetsSelector: React.FC<PresetsSelectorProps> = ({
  selectedPresetId,
  onSelectPreset,
  disabled = false,
}) => {
  return (
    <div className="bg-[#121826]/90 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Ajustes Predefinidos
          </h3>
        </div>
        <span className="text-xs text-slate-400">Perfiles oficiales SoundAlive</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
        {SOUNDALIVE_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              disabled={disabled}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400/50 scale-[1.02]'
                  : 'bg-[#182032] text-slate-300 hover:bg-[#202b44] hover:text-white border border-slate-800'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {preset.id === 'custom' ? (
                <SlidersHorizontal className="w-3 h-3" />
              ) : (
                <Sparkles className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
              )}
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Preset description */}
      <div className="mt-2 text-xs text-slate-400 italic">
        {SOUNDALIVE_PRESETS.find((p) => p.id === selectedPresetId)?.description || ''}
      </div>
    </div>
  );
};
