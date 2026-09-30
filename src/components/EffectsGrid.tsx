import React from 'react';
import { ReverbSize, SurroundLevel } from '../audio/types';
import { Disc3, Waves, Building2, Zap, Sparkles, Volume2 } from 'lucide-react';

interface EffectsGridProps {
  // Tube Amp
  tubeAmp: boolean;
  tubeAmpDrive: number;
  onToggleTubeAmp: () => void;
  onChangeTubeAmpDrive: (drive: number) => void;

  // 3D Surround
  surround3D: boolean;
  surroundLevel: SurroundLevel;
  onToggleSurround: () => void;
  onChangeSurroundLevel: (level: SurroundLevel) => void;

  // Concert Hall
  concertHall: boolean;
  concertHallSize: ReverbSize;
  onToggleConcertHall: () => void;
  onChangeConcertHallSize: (size: ReverbSize) => void;

  // Bass Boost
  bassBoost: boolean;
  bassBoostLevel: number;
  onToggleBassBoost: () => void;
  onChangeBassBoostLevel: (level: number) => void;

  // Clarity
  clarity: boolean;
  clarityLevel: number;
  onToggleClarity: () => void;
  onChangeClarityLevel: (level: number) => void;

  // UHQ Upscaler
  uhqUpscaler: boolean;
  onToggleUhq: () => void;

  disabled?: boolean;
}

export const EffectsGrid: React.FC<EffectsGridProps> = ({
  tubeAmp,
  tubeAmpDrive,
  onToggleTubeAmp,
  onChangeTubeAmpDrive,
  surround3D,
  surroundLevel,
  onToggleSurround,
  onChangeSurroundLevel,
  concertHall,
  concertHallSize,
  onToggleConcertHall,
  onChangeConcertHallSize,
  bassBoost,
  bassBoostLevel,
  onToggleBassBoost,
  onChangeBassBoostLevel,
  clarity,
  clarityLevel,
  onToggleClarity,
  onChangeClarityLevel,
  uhqUpscaler,
  onToggleUhq,
  disabled = false,
}) => {
  return (
    <div className="bg-[#121826]/90 border border-slate-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Efectos Legendarios SoundAlive
          </h3>
          <p className="text-xs text-slate-400">
            Algoritmos patentados de Samsung para realce acústico y espacial
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* 1. Tube Amp Pro */}
        <div
          className={`relative p-4 rounded-2xl border transition-all overflow-hidden ${
            tubeAmp
              ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Subtle animated filament glow */}
          {tubeAmp && (
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" />
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  tubeAmp ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Amplificador a Válvulas</h4>
                <span className="text-[10px] text-slate-400">Tube Amp Pro</span>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={onToggleTubeAmp}
              aria-label="Toggle Tube Amp Pro"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                tubeAmp ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  tubeAmp ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Emula el timbre cálido, rico en armónicos pares y respuesta suave de válvulas de vacío.
          </p>

          {/* Drive Slider */}
          {tubeAmp && (
            <div className="space-y-1 pt-1 border-t border-amber-900/30">
              <div className="flex justify-between text-[10px] text-amber-400/90 font-medium">
                <span>Calidez / Drive</span>
                <span>{Math.round(tubeAmpDrive * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={tubeAmpDrive}
                onChange={(e) => onChangeTubeAmpDrive(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-amber-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          )}
        </div>

        {/* 2. Sonido Envolvente 3D */}
        <div
          className={`relative p-4 rounded-2xl border transition-all overflow-hidden ${
            surround3D
              ? 'bg-blue-950/25 border-blue-500/50 shadow-lg shadow-blue-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  surround3D ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Sonido Envolvente 3D</h4>
                <span className="text-[10px] text-slate-400">3D Surround Field</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleSurround}
              aria-label="Toggle 3D Surround"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                surround3D ? 'bg-blue-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  surround3D ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Expande el campo acústico estéreo brindando sensación tridimensional inmersiva.
          </p>

          {/* Level selector */}
          {surround3D && (
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-blue-900/30">
              {(['low', 'medium', 'high'] as SurroundLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChangeSurroundLevel(lvl)}
                  className={`py-1 text-[10px] rounded-lg font-medium transition-all ${
                    surroundLevel === lvl
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-950/40 text-blue-300 hover:bg-blue-900/50'
                  }`}
                >
                  {lvl === 'low' ? 'Suave' : lvl === 'medium' ? 'Medio' : 'Inmersivo'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Sala de Conciertos (Concert Hall) */}
        <div
          className={`relative p-4 rounded-2xl border transition-all overflow-hidden ${
            concertHall
              ? 'bg-indigo-950/25 border-indigo-500/50 shadow-lg shadow-indigo-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  concertHall ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Sala de Conciertos</h4>
                <span className="text-[10px] text-slate-400">Concert Hall Reverb</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleConcertHall}
              aria-label="Toggle Concert Hall"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                concertHall ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  concertHall ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Simula la reverberación física y reflexiones acústicas de una sala espaciosa.
          </p>

          {/* Size selector */}
          {concertHall && (
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-indigo-900/30">
              {(['club', 'auditorium', 'cathedral'] as ReverbSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onChangeConcertHallSize(sz)}
                  className={`py-1 text-[10px] rounded-lg font-medium transition-all ${
                    concertHallSize === sz
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50'
                  }`}
                >
                  {sz === 'club' ? 'Club' : sz === 'auditorium' ? 'Auditorio' : 'Catedral'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Refuerzo de Graves (Bass Boost) */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            bassBoost
              ? 'bg-cyan-950/25 border-cyan-500/50 shadow-lg shadow-cyan-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  bassBoost ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Disc3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Refuerzo de Graves</h4>
                <span className="text-[10px] text-slate-400">Bass Boost Extender</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleBassBoost}
              aria-label="Toggle Bass Boost"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                bassBoost ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  bassBoost ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Realza frecuencias sub-graves de 60 a 90 Hz sin saturar los medios.
          </p>

          {bassBoost && (
            <div className="space-y-1 pt-1 border-t border-cyan-900/30">
              <div className="flex justify-between text-[10px] text-cyan-400/90 font-medium">
                <span>Nivel de Graves</span>
                <span>+{bassBoostLevel * 10}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={bassBoostLevel}
                onChange={(e) => onChangeBassBoostLevel(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-cyan-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          )}
        </div>

        {/* 5. Claridad Vocal (Clarity) */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            clarity
              ? 'bg-emerald-950/25 border-emerald-500/50 shadow-lg shadow-emerald-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  clarity ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Claridad Vocal</h4>
                <span className="text-[10px] text-slate-400">Voice & Dialogue Clarity</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleClarity}
              aria-label="Toggle Clarity"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                clarity ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  clarity ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Realza la inteligibilidad de diálogos y frecuencias altas sin estridencia.
          </p>

          {clarity && (
            <div className="space-y-1 pt-1 border-t border-emerald-900/30">
              <div className="flex justify-between text-[10px] text-emerald-400/90 font-medium">
                <span>Nivel de Claridad</span>
                <span>+{clarityLevel * 10}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={clarityLevel}
                onChange={(e) => onChangeClarityLevel(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          )}
        </div>

        {/* 6. UHQ UpScaler */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            uhqUpscaler
              ? 'bg-purple-950/25 border-purple-500/50 shadow-lg shadow-purple-900/20'
              : 'bg-[#151c2c] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl transition-colors ${
                  uhqUpscaler ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">UHQ UpScaler</h4>
                <span className="text-[10px] text-slate-400">Ultra High Quality 32-bit</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleUhq}
              aria-label="Toggle UHQ UpScaler"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                uhqUpscaler ? 'bg-purple-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  uhqUpscaler ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Genera armónicos de alta resolución simulando audio Hi-Fi de 32 bits a 384 kHz.
          </p>
        </div>
      </div>
    </div>
  );
};
