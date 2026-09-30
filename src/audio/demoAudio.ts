export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSec: number;
  url?: string;
  isCustom?: boolean;
}

// Generate realistic music tracks dynamically using Web Audio API synthesis into Blob audio files
export async function generateDemoTrackBlob(genre: 'funk' | 'synthwave' | 'acoustic'): Promise<string> {
  const sampleRate = 44100;
  const duration = genre === 'funk' ? 12 : genre === 'synthwave' ? 14 : 10;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  const tempo = genre === 'funk' ? 112 : genre === 'synthwave' ? 124 : 95;
  const beatDuration = 60 / tempo;
  const totalBeats = Math.floor(duration / beatDuration);

  // Helper: Kick drum generator
  const playKick = (time: number) => {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
  };

  // Helper: Snare generator
  const playSnare = (time: number) => {
    // Noise buffer
    const bufferSize = sampleRate * 0.2;
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = offlineCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);

    // Body tone
    const osc = offlineCtx.createOscillator();
    const toneGain = offlineCtx.createGain();
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    toneGain.gain.setValueAtTime(0.4, time);
    toneGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    osc.connect(toneGain);
    toneGain.connect(offlineCtx.destination);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.2);
  };

  // Helper: Hi-hat
  const playHiHat = (time: number, accent = false) => {
    const bufferSize = sampleRate * 0.05;
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(accent ? 0.35 : 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(offlineCtx.destination);

    noise.start(time);
    noise.stop(time + 0.05);
  };

  // Helper: Bass note
  const playBassNote = (time: number, noteFreq: number, dur: number) => {
    const osc = offlineCtx.createOscillator();
    osc.type = genre === 'funk' ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(noteFreq, time);

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(genre === 'funk' ? 420 : 850, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + dur * 0.8);

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(offlineCtx.destination);

    osc.start(time);
    osc.stop(time + dur);
  };

  // Helper: Melody / Chords
  const playChords = (time: number, freqs: number[], dur: number) => {
    freqs.forEach((freq) => {
      const osc = offlineCtx.createOscillator();
      osc.type = genre === 'acoustic' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(genre === 'acoustic' ? 2400 : 3800, time);

      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(time);
      osc.stop(time + dur);
    });
  };

  // Generate Pattern
  const bassNotes = [55, 65.41, 73.42, 82.41, 65.41, 55, 98]; // A1, C2, D2, E2...
  const chordProgressions = [
    [220, 261.63, 329.63, 392], // Am7
    [174.61, 220, 261.63, 329.63], // Fmaj7
    [130.81, 164.81, 196, 246.94], // Cmaj7
    [196, 246.94, 293.66, 349.23], // G7
  ];

  for (let b = 0; b < totalBeats; b++) {
    const t = b * beatDuration;

    // Drum Patterns
    if (b % 4 === 0) {
      playKick(t);
    } else if (b % 4 === 2) {
      playSnare(t);
    }

    if (genre === 'funk' && b % 4 === 1 && Math.random() > 0.4) {
      playKick(t + beatDuration * 0.5);
    }

    // Hi-hats on 8th or 16th notes
    playHiHat(t, b % 2 === 0);
    playHiHat(t + beatDuration * 0.5, false);

    // Bass
    const bassFreq = bassNotes[(Math.floor(b / 2)) % bassNotes.length];
    if (b % 2 === 0) {
      playBassNote(t, bassFreq, beatDuration * 1.6);
    }

    // Chords / Melody every 4 beats
    if (b % 4 === 0) {
      const chord = chordProgressions[(Math.floor(b / 4)) % chordProgressions.length];
      playChords(t, chord, beatDuration * 3.8);
    }
  }

  // Render to audio buffer
  const renderedBuffer = await offlineCtx.startRendering();

  // Convert rendered AudioBuffer to WAV blob
  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  return URL.createObjectURL(wavBlob);
}

// Convert AudioBuffer to 16-bit PCM WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write Interleaved Samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const INITIAL_DEMO_TRACKS: Track[] = [
  {
    id: 'demo-funk',
    title: 'Samsung Groove (Funk & Bass)',
    artist: 'SoundAlive Demo Lab',
    genre: 'Funk / Hip-Hop',
    durationSec: 12,
  },
  {
    id: 'demo-synthwave',
    title: 'Neon Horizon (Surround & Reverb)',
    artist: 'SoundAlive Demo Lab',
    genre: 'Synthwave / 80s',
    durationSec: 14,
  },
  {
    id: 'demo-acoustic',
    title: 'Vocal Clarity & Acoustic Mids',
    artist: 'SoundAlive Demo Lab',
    genre: 'Acústico / Soul',
    durationSec: 10,
  },
];
