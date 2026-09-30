/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SoundAliveState,
  EqualizerPreset,
  SOUNDALIVE_PRESETS,
  ReverbSize,
  SurroundLevel,
  AdaptSoundAge,
} from './audio/types';
import { soundAliveAudioEngine } from './audio/soundAliveEngine';
import { Track, INITIAL_DEMO_TRACKS, generateDemoTrackBlob } from './audio/demoAudio';
import { SoundAliveDials } from './components/SoundAliveDials';
import { GraphicEqualizer } from './components/GraphicEqualizer';
import { PresetsSelector } from './components/PresetsSelector';
import { EffectsGrid } from './components/EffectsGrid';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AdaptSoundModal } from './components/AdaptSoundModal';
import { J2CoreInfoModal } from './components/J2CoreInfoModal';
import {
  Sparkles,
  Sliders,
  Disc,
  Headphones,
  Info,
  Radio,
  Power,
  Layers,
  Volume2,
  Download,
} from 'lucide-react';

const INITIAL_STATE: SoundAliveState = {
  enabled: true,
  mode: 'basic',
  selectedPresetId: 'rock',
  bands: [5, 4, 2, -1, -2, 1, 3, 5, 6], // default to energetic Rock curve
  bassTreble: 30,
  instrumentVocal: -40,
  tubeAmp: true,
  tubeAmpDrive: 0.65,
  surround3D: true,
  surroundLevel: 'medium',
  concertHall: false,
  concertHallSize: 'auditorium',
  bassBoost: true,
  bassBoostLevel: 7,
  clarity: true,
  clarityLevel: 6,
  uhqUpscaler: true,
  adaptSound: 'under30',
  adaptSoundCustomL: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  adaptSoundCustomR: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export default function App() {
  const [state, setState] = useState<SoundAliveState>(INITIAL_STATE);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_DEMO_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isAdaptSoundOpen, setIsAdaptSoundOpen] = useState(false);
  const [isJ2CoreModalOpen, setIsJ2CoreModalOpen] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize demo music tracks in the background
  useEffect(() => {
    let isCancelled = false;

    async function loadTracks() {
      try {
        const [urlFunk, urlSynth, urlAcoustic] = await Promise.all([
          generateDemoTrackBlob('funk'),
          generateDemoTrackBlob('synthwave'),
          generateDemoTrackBlob('acoustic'),
        ]);

        if (isCancelled) return;

        setTracks([
          {
            ...INITIAL_DEMO_TRACKS[0],
            url: urlFunk,
          },
          {
            ...INITIAL_DEMO_TRACKS[1],
            url: urlSynth,
          },
          {
            ...INITIAL_DEMO_TRACKS[2],
            url: urlAcoustic,
          },
        ]);
        setDemoLoaded(true);
      } catch (err) {
        console.error('Failed generating demo tracks:', err);
      }
    }

    loadTracks();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Sync state to Web Audio DSP Engine
  useEffect(() => {
    soundAliveAudioEngine.applyState(state);
  }, [state]);

  // Handle current track changes
  useEffect(() => {
    const currentTrack = tracks[currentTrackIndex];
    if (audioRef.current && currentTrack?.url) {
      const wasPlaying = isPlaying;
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      if (wasPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [currentTrackIndex, tracks]);

  // Connect audio element to AudioEngine
  const ensureAudioEngine = useCallback(() => {
    if (audioRef.current) {
      soundAliveAudioEngine.init(audioRef.current);
      soundAliveAudioEngine.resumeContext();
    }
  }, []);

  const handleTogglePlay = async () => {
    ensureAudioEngine();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Playback error:', err);
      }
    }
  };

  const handleNextTrack = () => {
    ensureAudioEngine();
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  };

  const handleSelectTrack = (track: Track) => {
    ensureAudioEngine();
    const index = tracks.findIndex((t) => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
    }
  };

  const handleUploadFile = (file: File) => {
    ensureAudioEngine();
    const objectUrl = URL.createObjectURL(file);
    const newTrack: Track = {
      id: `custom-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Tu Dispositivo',
      genre: 'Audio Local',
      durationSec: 180,
      url: objectUrl,
      isCustom: true,
    };

    setTracks((prev) => [newTrack, ...prev]);
    setCurrentTrackIndex(0);
    setIsPlaying(false);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 150);
  };

  // State mutators
  const handleToggleMasterEnabled = () => {
    ensureAudioEngine();
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSelectPreset = (preset: EqualizerPreset) => {
    setState((prev) => ({
      ...prev,
      selectedPresetId: preset.id,
      bands: [...preset.bands],
      bassTreble: preset.bassTreble,
      instrumentVocal: preset.instrumentVocal,
    }));
  };

  const handleChangeBand = (index: number, value: number) => {
    setState((prev) => {
      const newBands = [...prev.bands];
      newBands[index] = value;
      return {
        ...prev,
        bands: newBands,
        selectedPresetId: 'custom',
      };
    });
  };

  const handleResetBands = () => {
    setState((prev) => ({
      ...prev,
      bands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      selectedPresetId: 'normal',
    }));
  };

  const handleChangeBassTreble = (val: number) => {
    setState((prev) => ({
      ...prev,
      bassTreble: val,
      selectedPresetId: 'custom',
    }));
  };

  const handleChangeInstrumentVocal = (val: number) => {
    setState((prev) => ({
      ...prev,
      instrumentVocal: val,
      selectedPresetId: 'custom',
    }));
  };

  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans pb-28 selection:bg-blue-600 selection:text-white">
      {/* Hidden Audio Tag connected to Web Audio DSP */}
      <audio
        ref={audioRef}
        loop={isLooping}
        onEnded={() => {
          if (!isLooping) handleNextTrack();
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* Samsung One UI Header */}
      <header className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  SoundAlive
                </h1>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Universal Web
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Motor de Efectos & Ecualizador Samsung para cualquier dispositivo
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Download Project ZIP */}
            <a
              href="/SoundAlive-Galaxy-J2-Core-Proyecto.zip"
              download="SoundAlive-Galaxy-J2-Core-Proyecto.zip"
              title="Descargar todos los archivos del proyecto en formato .ZIP"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/40 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar Proyecto (.ZIP)</span>
              <span className="sm:hidden">ZIP</span>
            </a>

            {/* Galaxy J2 Core Guide button */}
            <button
              type="button"
              onClick={() => setIsJ2CoreModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/40 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Galaxy J2 Core & APK</span>
              <span className="sm:hidden">J2 Core</span>
            </button>

            {/* Adapt Sound button */}
            <button
              type="button"
              onClick={() => setIsAdaptSoundOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-950/40 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-900/40 transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adapt Sound</span>
              <span className="sm:hidden">Adapt</span>
            </button>

            {/* Master On/Off Switch */}
            <button
              type="button"
              onClick={handleToggleMasterEnabled}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                state.enabled
                  ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${state.enabled ? 'text-white' : 'text-slate-500'}`} />
              <span>{state.enabled ? 'ACTIVADO' : 'DESACTIVADO'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main App Container */}
      <main className="max-w-6xl mx-auto w-full px-4 pt-6 space-y-6 flex-1">
        {/* Bypass Notification Bar if disabled */}
        {!state.enabled && (
          <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Power className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>SoundAlive en Modo Bypass:</strong> El audio se escucha con su respuesta plana original sin procesamiento.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleMasterEnabled}
              className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shrink-0"
            >
              Activar
            </button>
          </div>
        )}

        {/* Status Badges & Hardware Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Modo de Sonido:
            </span>
            <div className="inline-flex rounded-xl bg-[#131b2e] p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: 'basic' }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  state.mode === 'basic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Disc className="w-3.5 h-3.5" />
                Básico (Perillas)
              </button>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: 'advanced' }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  state.mode === 'advanced'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Avanzado (9 Bandas)
              </button>
            </div>
          </div>

          {/* Quality Tags */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-900/50">
              Dolby Atmos FX
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-900/50">
              UHQ 32-bit Hi-Fi
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-emerald-400 border border-emerald-900/40">
              DSP Activo
            </span>
          </div>
        </div>

        {/* Presets Horizontal Row */}
        <PresetsSelector
          selectedPresetId={state.selectedPresetId}
          onSelectPreset={handleSelectPreset}
          disabled={!state.enabled}
        />

        {/* Equalizer Workspace: Dual Dials OR 9-band Graphic EQ */}
        {state.mode === 'basic' ? (
          <SoundAliveDials
            bassTreble={state.bassTreble}
            instrumentVocal={state.instrumentVocal}
            onChangeBassTreble={handleChangeBassTreble}
            onChangeInstrumentVocal={handleChangeInstrumentVocal}
            disabled={!state.enabled}
          />
        ) : (
          <GraphicEqualizer
            bands={state.bands}
            onChangeBand={handleChangeBand}
            onReset={handleResetBands}
            disabled={!state.enabled}
          />
        )}

        {/* SoundAlive Legendary Effects Grid */}
        <EffectsGrid
          tubeAmp={state.tubeAmp}
          tubeAmpDrive={state.tubeAmpDrive}
          onToggleTubeAmp={() => setState((prev) => ({ ...prev, tubeAmp: !prev.tubeAmp }))}
          onChangeTubeAmpDrive={(drive) => setState((prev) => ({ ...prev, tubeAmpDrive: drive }))}
          surround3D={state.surround3D}
          surroundLevel={state.surroundLevel}
          onToggleSurround={() => setState((prev) => ({ ...prev, surround3D: !prev.surround3D }))}
          onChangeSurroundLevel={(surroundLevel) => setState((prev) => ({ ...prev, surroundLevel }))}
          concertHall={state.concertHall}
          concertHallSize={state.concertHallSize}
          onToggleConcertHall={() => {
            const nextVal = !state.concertHall;
            if (nextVal) {
              soundAliveAudioEngine.updateConvolverSize(state.concertHallSize);
            }
            setState((prev) => ({ ...prev, concertHall: nextVal }));
          }}
          onChangeConcertHallSize={(concertHallSize) => {
            soundAliveAudioEngine.updateConvolverSize(concertHallSize);
            setState((prev) => ({ ...prev, concertHallSize }));
          }}
          bassBoost={state.bassBoost}
          bassBoostLevel={state.bassBoostLevel}
          onToggleBassBoost={() => setState((prev) => ({ ...prev, bassBoost: !prev.bassBoost }))}
          onChangeBassBoostLevel={(bassBoostLevel) => setState((prev) => ({ ...prev, bassBoostLevel }))}
          clarity={state.clarity}
          clarityLevel={state.clarityLevel}
          onToggleClarity={() => setState((prev) => ({ ...prev, clarity: !prev.clarity }))}
          onChangeClarityLevel={(clarityLevel) => setState((prev) => ({ ...prev, clarityLevel }))}
          uhqUpscaler={state.uhqUpscaler}
          onToggleUhq={() => setState((prev) => ({ ...prev, uhqUpscaler: !prev.uhqUpscaler }))}
          disabled={!state.enabled}
        />

        {/* Quick Testing Tips */}
        <div className="bg-[#101624]/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Consejo de prueba:</strong> Dale a <span className="text-white font-semibold">Play (▶)</span> en la barra inferior para escuchar la pista de demostración y usa el botón <span className="text-blue-400 font-semibold">SoundAlive: ON/BYPASS</span> para notar la enorme diferencia de audio.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsJ2CoreModalOpen(true)}
            className="text-cyan-400 hover:text-cyan-300 font-medium shrink-0 flex items-center gap-1"
          >
            ¿Cómo usar en Samsung J2 Core? →
          </button>
        </div>
      </main>

      {/* Floating Audio Player with Real-time Spectrum Visualizer */}
      <AudioPlayerBar
        currentTrack={currentTrack}
        tracks={tracks}
        isPlaying={isPlaying}
        isLooping={isLooping}
        soundAliveEnabled={state.enabled}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onToggleLoop={() => setIsLooping((prev) => !prev)}
        onSelectTrack={handleSelectTrack}
        onUploadFile={handleUploadFile}
        onToggleSoundAlive={handleToggleMasterEnabled}
      />

      {/* Adapt Sound Audiometric Calibration Modal */}
      <AdaptSoundModal
        isOpen={isAdaptSoundOpen}
        onClose={() => setIsAdaptSoundOpen(false)}
        currentProfile={state.adaptSound}
        onSelectProfile={(profile) => setState((prev) => ({ ...prev, adaptSound: profile }))}
      />

      {/* Galaxy J2 Core Compatibility & APK conversion Modal */}
      <J2CoreInfoModal
        isOpen={isJ2CoreModalOpen}
        onClose={() => setIsJ2CoreModalOpen(false)}
      />
    </div>
  );
}
