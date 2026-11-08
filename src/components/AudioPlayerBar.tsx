import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Upload, Repeat, Sparkles } from 'lucide-react';
import { Track } from '../audio/demoAudio';
import { soundAliveAudioEngine } from '../audio/soundAliveEngine';

interface AudioPlayerBarProps {
  currentTrack: Track;
  tracks: Track[];
  isPlaying: boolean;
  isLooping: boolean;
  soundAliveEnabled: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleLoop: () => void;
  onSelectTrack: (track: Track) => void;
  onUploadFile: (file: File) => void;
  onToggleSoundAlive: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  tracks,
  isPlaying,
  isLooping,
  soundAliveEnabled,
  onTogglePlay,
  onNextTrack,
  onToggleLoop,
  onSelectTrack,
  onUploadFile,
  onToggleSoundAlive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Audio spectrum visualization animation loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);

      soundAliveAudioEngine.getFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 1.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Boost visually if playing or idle
        const rawVal = isPlaying ? dataArray[i] : 2;
        const barHeight = Math.max(3, (rawVal / 255) * height);

        // Gradient color: Cyan to Blue, glowing violet if SoundAlive enabled
        const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        if (soundAliveEnabled) {
          grad.addColorStop(0, '#2563eb');
          grad.addColorStop(0.5, '#06b6d4');
          grad.addColorStop(1, '#a855f7');
        } else {
          grad.addColorStop(0, '#475569');
          grad.addColorStop(1, '#94a3b8');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, Math.max(1, barWidth - 1), barHeight, [2, 2, 0, 0]);
        ctx.fill();

        x += barWidth + 1;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, soundAliveEnabled]);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0) setIsMuted(false);
    soundAliveAudioEngine.setMasterVolume(newVol);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      soundAliveAudioEngine.setMasterVolume(volume);
    } else {
      setIsMuted(true);
      soundAliveAudioEngine.setMasterVolume(0);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d121c]/95 border-t border-slate-800/90 backdrop-blur-xl shadow-2xl px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Track Info & Visualizer */}
        <div className="flex items-center gap-3 w-full md:w-auto min-w-[240px]">
          {/* Mini Album Art / Track Icon */}
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center shadow-md shrink-0 overflow-hidden border border-blue-400/30">
            <span className="text-xl">🎵</span>
            {isPlaying && (
              <div className="absolute inset-0 bg-blue-500/20 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-[240px]">
                {currentTrack.title}
              </h4>
              {currentTrack.isCustom && (
                <span className="text-[9px] bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                  Local
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {currentTrack.artist} • {currentTrack.genre}
            </p>
          </div>

          {/* Canvas Spectrum Visualizer */}
          <div className="hidden sm:block w-28 h-8 rounded-lg overflow-hidden bg-slate-900/80 border border-slate-800 px-1 py-0.5">
            <canvas ref={canvasRef} width={120} height={32} className="w-full h-full block" />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          {/* Track Switcher Dropdown */}
          <select
            value={currentTrack.id}
            onChange={(e) => {
              const selected = tracks.find((t) => t.id === e.target.value);
              if (selected) onSelectTrack(selected);
            }}
            className="text-xs bg-[#182032] border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer max-w-[140px] truncate focus:outline-none focus:border-blue-500"
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          {/* Upload Custom Song Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadFile(file);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Cargar archivo MP3/WAV desde tu dispositivo"
            className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Subir Audio</span>
          </button>

          {/* Loop toggle */}
          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-2 rounded-xl transition-colors ${
              isLooping ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-slate-400 hover:text-white'
            }`}
            title="Repetir en bucle"
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* Main Play / Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 transition-transform active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNextTrack}
            className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
            title="Siguiente pista"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Master SoundAlive Bypass Switch & Volume */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Quick SoundAlive A/B Compare Button */}
          <button
            type="button"
            onClick={onToggleSoundAlive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              soundAliveEnabled
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-md shadow-blue-500/20'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${soundAliveEnabled ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>SoundAlive: {soundAliveEnabled ? 'ON' : 'BYPASS'}</span>
          </button>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              aria-label="Volumen maestro"
              className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
