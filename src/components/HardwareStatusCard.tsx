import React, { useState, useEffect } from 'react';
import {
  getNativeEffectsStatus,
  NativeEffectsStatus,
  isNativeAndroidApp,
} from '../utils/nativeBridge';
import {
  CheckCircle2,
  AlertCircle,
  Activity,
  Cpu,
  ChevronDown,
  ChevronUp,
  Volume2,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface HardwareStatusCardProps {
  masterEnabled: boolean;
  concertHallEnabled: boolean;
  mode: 'basic' | 'advanced';
  status?: NativeEffectsStatus | null;
  isAudioStreaming?: boolean;
}

export const HardwareStatusCard: React.FC<HardwareStatusCardProps> = ({
  masterEnabled,
  concertHallEnabled,
  mode,
  status: propStatus,
  isAudioStreaming = false,
}) => {
  const [internalStatus, setInternalStatus] = useState<NativeEffectsStatus | null>(null);
  const [showEngines, setShowEngines] = useState(false);

  useEffect(() => {
    if (propStatus) return; // Use prop if passed
    let mounted = true;

    const fetchStatus = async () => {
      if (!isNativeAndroidApp()) {
        return;
      }

      try {
        const res = await getNativeEffectsStatus();
        if (mounted && res) {
          setInternalStatus(res);
        }
      } catch (err) {
        console.warn('Error fetching status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [propStatus]);

  const status = propStatus || internalStatus;
  if (!status) return null;

  const audioDetected = isNativeAndroidApp() ? !!status.isAudioOutputActive : isAudioStreaming;

  return (
    <section className="bg-black border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Diagnóstico de Efectos en Vivo
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
            audioDetected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${audioDetected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
            {audioDetected ? 'Audio en salida detectado' : 'Sin salida (En espera)'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium">
            {status.sessionsCount > 1 ? `${status.sessionsCount} canales` : 'Canal Global'}
          </span>
        </div>
      </div>

      {/* Grid of Features Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Equalizer Status */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
            <div>
              <span className="text-[11px] text-neutral-300 font-medium block">
                Ecualizador
              </span>
              <span className="text-[10px] text-neutral-500 block">
                {status.equalizerBands} bandas de hardware
              </span>
            </div>
          </div>
          {status.eqLive ? (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CAMBIO APLICADO
            </span>
          ) : (
            <span className="text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" /> PLANO
            </span>
          )}
        </div>

        {/* Bass Boost Status */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
            <div>
              <span className="text-[11px] text-neutral-300 font-medium block">
                Graves (Bass)
              </span>
              <span className="text-[10px] text-neutral-500 block">
                {status.bassBoostStrength > 0
                  ? `Potencia: ${status.bassBoostStrength}`
                  : 'Listo / Plano'}
              </span>
            </div>
          </div>
          {status.bassBoostLive ? (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CAMBIO APLICADO
            </span>
          ) : (
            <span className="text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" /> PLANO
            </span>
          )}
        </div>

        {/* Sonido Ambiental (Pure Reverb / FxSound Ambience) Status */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            <div>
              <span className="text-[11px] text-neutral-300 font-medium block">
                Sonido Ambiental
              </span>
              <span className="text-[10px] text-neutral-500 block truncate max-w-[110px]">
                {status.reverbLive ? 'Sala Conciertos' : 'Apagado'}
              </span>
            </div>
          </div>
          {status.reverbLive ? (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CAMBIO APLICADO
            </span>
          ) : (
            <span className="text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" /> PLANO
            </span>
          )}
        </div>
      </div>

      {/* Hardware engines detected dropdown */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowEngines(!showEngines)}
          className="w-full flex items-center justify-between text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors py-1 px-1 rounded"
        >
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-neutral-500" />
            <span>Motores de audio detectados en el teléfono ({status.hardwareEngines.length})</span>
          </div>
          {showEngines ? (
            <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          )}
        </button>

        {showEngines && (
          <div className="mt-2 p-2 bg-neutral-950/80 border border-neutral-800 rounded-xl flex flex-col gap-1 text-[10px] text-neutral-400">
            {status.hardwareEngines.length > 0 ? (
              status.hardwareEngines.map((engine, idx) => (
                <div key={idx} className="flex items-center gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>{engine}</span>
                </div>
              ))
            ) : (
              <span className="text-neutral-500 italic">
                Cargando módulos de efectos del sistema...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Emulator Driver Configuration Note */}
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 flex flex-col gap-1 text-left mt-1">
        <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Aviso para Emuladores (MD.emu, RetroArch, etc.):</span>
        </div>
        <p className="text-[11px] text-neutral-300 leading-snug">
          Si tu emulador tiene <code className="text-sky-300 bg-sky-950/80 px-1 py-0.5 rounded font-mono">Audio Driver: AAudio</code>, este puentea directamente el chip de sonido para latencia cero y se salta el ecualizador del sistema.
        </p>
        <p className="text-[11px] text-neutral-300 leading-snug">
          👉 <strong>Solución:</strong> En Audio Options de tu emulador, cambia <em>Audio Driver</em> a <strong className="text-emerald-400">AudioTrack</strong> (o <em>OpenSL ES</em>). ¡Al instante el ecualizador y la reverberación procesarán todo el juego!
        </p>
      </div>
    </section>
  );
};
