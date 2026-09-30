import React, { useState } from 'react';
import { AdaptSoundAge } from '../audio/types';
import { Headphones, Check, X, Sparkles, Volume2 } from 'lucide-react';

interface AdaptSoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: AdaptSoundAge;
  onSelectProfile: (profile: AdaptSoundAge) => void;
}

export const AdaptSoundModal: React.FC<AdaptSoundModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSelectProfile,
}) => {
  const [testingEar, setTestingEar] = useState<'idle' | 'left' | 'right'>('idle');

  if (!isOpen) return null;

  const profiles: { id: AdaptSoundAge; title: string; subtitle: string; desc: string }[] = [
    {
      id: 'off',
      title: 'Desactivado',
      subtitle: 'Sonido por defecto',
      desc: 'No aplica compensación por curva de audición.',
    },
    {
      id: 'under30',
      title: 'Menor de 30 años',
      subtitle: 'Refuerzo de frecuencias muy altas',
      desc: 'Optimiza la claridad de frecuencias entre 8kHz y 16kHz preservando dinamismo juvenil.',
    },
    {
      id: 'between30and60',
      title: 'De 30 a 60 años',
      subtitle: 'Refuerzo de frecuencias medias y altas',
      desc: 'Compensa la sensibilidad auditiva natural en la zona de 2kHz a 6kHz para voces nítidas.',
    },
    {
      id: 'over60',
      title: 'Mayor de 60 años',
      subtitle: 'Refuerzo de todas las frecuencias',
      desc: 'Eleva la presencia en todo el espectro acústico para máxima inteligibilidad en llamadas y música.',
    },
  ];

  const handleTestBeep = (ear: 'left' | 'right') => {
    setTestingEar(ear);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      osc.frequency.setValueAtTime(ear === 'left' ? 1200 : 2400, ctx.currentTime);
      panner.pan.setValueAtTime(ear === 'left' ? -1 : 1, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      setTimeout(() => {
        setTestingEar('idle');
      }, 700);
    } catch {
      setTestingEar('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121826] border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Adapt Sound <Sparkles className="w-4 h-4 text-blue-400" />
            </h3>
            <p className="text-xs text-slate-400">Calibración auditiva personalizada de Samsung</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Encuentra el mejor sonido para ti. Cada persona escucha las frecuencias de manera diferente; SoundAlive adapta la curva de ganancia a tus oídos.
        </p>

        {/* Profiles list */}
        <div className="space-y-2.5 mb-6">
          {profiles.map((p) => {
            const isSelected = currentProfile === p.id;
            return (
              <div
                key={p.id}
                onClick={() => onSelectProfile(p.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                    : 'bg-[#161e30] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <h4 className={`text-sm font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                    {p.title}
                  </h4>
                  <span className="text-[11px] text-blue-400/80 font-medium block">
                    {p.subtitle}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ml-3 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'border-slate-600 bg-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Ear Beep Test */}
        <div className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              Prueba de Audición Binaural
            </span>
            <span className="text-[10px] text-slate-500">Usa auriculares</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTestBeep('left')}
              disabled={testingEar !== 'idle'}
              className="py-2 px-3 rounded-xl bg-[#182236] hover:bg-blue-900/40 text-xs font-medium text-slate-200 border border-slate-700/60 transition-colors flex items-center justify-center gap-2"
            >
              <span>{testingEar === 'left' ? '🔊 Sonando...' : '🎧 Oído Izquierdo'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTestBeep('right')}
              disabled={testingEar !== 'idle'}
              className="py-2 px-3 rounded-xl bg-[#182236] hover:bg-blue-900/40 text-xs font-medium text-slate-200 border border-slate-700/60 transition-colors flex items-center justify-center gap-2"
            >
              <span>{testingEar === 'right' ? '🔊 Sonando...' : '🎧 Oído Derecho'}</span>
            </button>
          </div>
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
        >
          Aplicar y Cerrar
        </button>
      </div>
    </div>
  );
};
