import { EQ_FREQUENCIES, SoundAliveState, ReverbSize, SurroundLevel } from './types';

export class SoundAliveEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | AudioBufferSourceNode | null = null;
  private isSourceMediaElement = false;

  // Analysis
  private analyserNode: AnalyserNode | null = null;

  // Nodes for DSP chain
  private inputGain: GainNode | null = null;
  private bypassGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;

  // 9-band EQ
  private eqFilters: BiquadFilterNode[] = [];

  // Dual Dials (Bass/Treble & Instrument/Vocal)
  private dialBassFilter: BiquadFilterNode | null = null;
  private dialTrebleFilter: BiquadFilterNode | null = null;
  private dialVocalFilter: BiquadFilterNode | null = null;
  private dialInstrumentFilter: BiquadFilterNode | null = null;

  // Enhancements
  private bassBoostFilter: BiquadFilterNode | null = null;
  private clarityFilter1: BiquadFilterNode | null = null;
  private clarityFilter2: BiquadFilterNode | null = null;
  private uhqFilter: BiquadFilterNode | null = null;

  // Tube Amp
  private tubeAmpWaveShaper: WaveShaperNode | null = null;
  private tubeAmpWarmthFilter: BiquadFilterNode | null = null;
  private tubeAmpWetGain: GainNode | null = null;
  private tubeAmpDryGain: GainNode | null = null;

  // 3D Surround (Mid-Side / Haas Stereo Widener)
  private surroundSplitter: ChannelSplitterNode | null = null;
  private surroundMerger: ChannelMergerNode | null = null;
  private surroundDelayL: DelayNode | null = null;
  private surroundDelayR: DelayNode | null = null;
  private surroundWetGain: GainNode | null = null;
  private surroundDryGain: GainNode | null = null;

  // Concert Hall (Reverb)
  private convolverNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // Adapt Sound Balance
  private pannerNode: StereoPannerNode | null = null;

  // State cache
  private currentState: SoundAliveState | null = null;

  constructor() {
    // Lazy init on first user interaction to satisfy browser autoplay policy
  }

  public init(audioElement?: HTMLAudioElement): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (audioElement && !this.isSourceMediaElement) {
        this.attachMediaElement(audioElement);
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.buildGraph();

    if (audioElement) {
      this.attachMediaElement(audioElement);
    }
  }

  public async resumeContext(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public attachMediaElement(audioElement: HTMLAudioElement): void {
    if (!this.ctx || !this.inputGain) return;
    try {
      if (this.sourceNode && this.isSourceMediaElement) {
        this.sourceNode.disconnect();
      }
      this.sourceNode = this.ctx.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.inputGain);
      this.isSourceMediaElement = true;
    } catch {
      // Node already connected or cross-origin handled
    }
  }

  private buildGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Master Nodes
    this.inputGain = ctx.createGain();
    this.bypassGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;

    // Analyser for visualizer
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Dynamics Limiter to prevent clipping
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-1.0, ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(6.0, ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(12.0, ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.003, ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.25, ctx.currentTime);

    // 1. Bypass route (dry sound when SoundAlive disabled)
    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.masterLimiter);

    // 2. Wet route (SoundAlive active)
    this.inputGain.connect(this.wetGain);

    // 9 Graphic EQ Filters
    this.eqFilters = EQ_FREQUENCIES.map((freq) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.414;
      filter.gain.value = 0;
      return filter;
    });

    // Connect 9 EQ bands in series
    let prevNode: AudioNode = this.wetGain;
    for (const filter of this.eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }

    // Dial Filters: Bass (lowshelf 120Hz), Treble (highshelf 7000Hz)
    this.dialBassFilter = ctx.createBiquadFilter();
    this.dialBassFilter.type = 'lowshelf';
    this.dialBassFilter.frequency.value = 120;
    this.dialBassFilter.gain.value = 0;

    this.dialTrebleFilter = ctx.createBiquadFilter();
    this.dialTrebleFilter.type = 'highshelf';
    this.dialTrebleFilter.frequency.value = 7500;
    this.dialTrebleFilter.gain.value = 0;

    // Dial Filters: Instrument vs Vocal
    this.dialVocalFilter = ctx.createBiquadFilter();
    this.dialVocalFilter.type = 'peaking';
    this.dialVocalFilter.frequency.value = 2500;
    this.dialVocalFilter.Q.value = 1.2;
    this.dialVocalFilter.gain.value = 0;

    this.dialInstrumentFilter = ctx.createBiquadFilter();
    this.dialInstrumentFilter.type = 'peaking';
    this.dialInstrumentFilter.frequency.value = 450;
    this.dialInstrumentFilter.Q.value = 1.0;
    this.dialInstrumentFilter.gain.value = 0;

    // Bass Boost Filter
    this.bassBoostFilter = ctx.createBiquadFilter();
    this.bassBoostFilter.type = 'lowshelf';
    this.bassBoostFilter.frequency.value = 85;
    this.bassBoostFilter.gain.value = 0;

    // Clarity Filters (presence and air)
    this.clarityFilter1 = ctx.createBiquadFilter();
    this.clarityFilter1.type = 'peaking';
    this.clarityFilter1.frequency.value = 3200;
    this.clarityFilter1.Q.value = 1.8;
    this.clarityFilter1.gain.value = 0;

    this.clarityFilter2 = ctx.createBiquadFilter();
    this.clarityFilter2.type = 'highshelf';
    this.clarityFilter2.frequency.value = 11000;
    this.clarityFilter2.gain.value = 0;

    // UHQ Upscaler harmonic exciter
    this.uhqFilter = ctx.createBiquadFilter();
    this.uhqFilter.type = 'highshelf';
    this.uhqFilter.frequency.value = 14000;
    this.uhqFilter.gain.value = 0;

    // Chain EQ output through Dials and basic enhancements
    prevNode.connect(this.dialBassFilter);
    this.dialBassFilter.connect(this.dialTrebleFilter);
    this.dialTrebleFilter.connect(this.dialVocalFilter);
    this.dialVocalFilter.connect(this.dialInstrumentFilter);
    this.dialInstrumentFilter.connect(this.bassBoostFilter);
    this.bassBoostFilter.connect(this.clarityFilter1);
    this.clarityFilter1.connect(this.clarityFilter2);
    this.clarityFilter2.connect(this.uhqFilter);

    const postEqNode = this.uhqFilter;

    // Setup Tube Amp Pro module
    this.setupTubeAmp(postEqNode);

    // Setup 3D Surround & Concert Hall in parallel/serial routing
    this.setupSpatialReverb();

    // Stereo Panner (Adapt Sound)
    this.pannerNode = ctx.createStereoPanner();

    // Connect to Limiter and Output
    this.masterLimiter.connect(this.outputGain);
    this.outputGain.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);
  }

  // Generate warm vacuum tube non-linear saturation curve
  private makeTubeCurve(amount = 20): Float32Array {
    const k = amount;
    const n = 4096;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      // Asymmetric saturation mimicking vacuum tube response with second harmonic warmth
      if (x >= 0) {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x)) * 0.7;
      } else {
        curve[i] = -((3 + k) * Math.abs(x) * 20 * deg) / (Math.PI + k * 0.8 * Math.abs(x)) * 0.65;
      }
      // Add subtle warm second harmonic
      curve[i] += 0.05 * Math.sin(Math.PI * x);
    }
    return curve;
  }

  private setupTubeAmp(inputNode: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.tubeAmpWaveShaper = ctx.createWaveShaper();
    this.tubeAmpWaveShaper.curve = this.makeTubeCurve(15) as Float32Array<ArrayBuffer>;
    this.tubeAmpWaveShaper.oversample = '4x';

    // Tube warmth filter
    this.tubeAmpWarmthFilter = ctx.createBiquadFilter();
    this.tubeAmpWarmthFilter.type = 'lowpass';
    this.tubeAmpWarmthFilter.frequency.value = 16000;

    this.tubeAmpDryGain = ctx.createGain();
    this.tubeAmpWetGain = ctx.createGain();
    this.tubeAmpWetGain.gain.value = 0;
    this.tubeAmpDryGain.gain.value = 1.0;

    inputNode.connect(this.tubeAmpDryGain);
    inputNode.connect(this.tubeAmpWaveShaper);
    this.tubeAmpWaveShaper.connect(this.tubeAmpWarmthFilter);
    this.tubeAmpWarmthFilter.connect(this.tubeAmpWetGain);
  }

  private setupSpatialReverb(): void {
    if (!this.ctx || !this.tubeAmpDryGain || !this.tubeAmpWetGain) return;
    const ctx = this.ctx;

    // Sum Tube Amp Output
    const preSpatialMix = ctx.createGain();
    this.tubeAmpDryGain.connect(preSpatialMix);
    this.tubeAmpWetGain.connect(preSpatialMix);

    // 3D Surround Branch
    this.surroundDryGain = ctx.createGain();
    this.surroundWetGain = ctx.createGain();
    this.surroundWetGain.gain.value = 0;
    this.surroundDryGain.gain.value = 1.0;

    this.surroundSplitter = ctx.createChannelSplitter(2);
    this.surroundMerger = ctx.createChannelMerger(2);
    this.surroundDelayL = ctx.createDelay();
    this.surroundDelayR = ctx.createDelay();
    this.surroundDelayL.delayTime.value = 0.008; // 8ms Haas delay
    this.surroundDelayR.delayTime.value = 0.015; // 15ms Haas delay

    preSpatialMix.connect(this.surroundDryGain);
    preSpatialMix.connect(this.surroundSplitter);

    // Crossfeed and widen
    this.surroundSplitter.connect(this.surroundDelayL, 0);
    this.surroundSplitter.connect(this.surroundDelayR, 1);
    this.surroundDelayL.connect(this.surroundMerger, 0, 1); // Cross L to R
    this.surroundDelayR.connect(this.surroundMerger, 0, 0); // Cross R to L
    this.surroundMerger.connect(this.surroundWetGain);

    const postSurroundMix = ctx.createGain();
    this.surroundDryGain.connect(postSurroundMix);
    this.surroundWetGain.connect(postSurroundMix);

    // Concert Hall (Impulse Reverb)
    this.convolverNode = ctx.createConvolver();
    this.convolverNode.buffer = this.generateImpulseResponse(2.4, 3.5, false);

    this.reverbDryGain = ctx.createGain();
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = 0;
    this.reverbDryGain.gain.value = 1.0;

    postSurroundMix.connect(this.reverbDryGain);
    postSurroundMix.connect(this.convolverNode);
    this.convolverNode.connect(this.reverbWetGain);

    const postReverbMix = ctx.createGain();
    this.reverbDryGain.connect(postReverbMix);
    this.reverbWetGain.connect(postReverbMix);

    // Connect to Master Limiter
    if (this.masterLimiter) {
      postReverbMix.connect(this.masterLimiter);
    }
  }

  // Algorithmic acoustic impulse response for Concert Hall
  private generateImpulseResponse(duration: number, decay: number, reverse: boolean): AudioBuffer {
    if (!this.ctx) {
      throw new Error('AudioContext missing');
    }
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      // Exponential decay envelope with natural diffusion
      const envelope = Math.pow(1 - n / length, decay);
      // Discrete early reflections in first 40ms
      const earlyReflection = (i < sampleRate * 0.04 && i % 380 === 0) ? 0.3 : 0;
      left[i] = ((Math.random() * 2 - 1) * envelope + earlyReflection) * 0.6;
      right[i] = ((Math.random() * 2 - 1) * envelope + earlyReflection * 0.8) * 0.6;
    }

    return impulse;
  }

  public updateConvolverSize(size: ReverbSize): void {
    if (!this.ctx || !this.convolverNode) return;
    let duration = 2.0;
    let decay = 3.0;

    switch (size) {
      case 'club':
        duration = 1.0;
        decay = 4.5;
        break;
      case 'auditorium':
        duration = 2.5;
        decay = 3.2;
        break;
      case 'cathedral':
        duration = 4.2;
        decay = 2.2;
        break;
    }
    this.convolverNode.buffer = this.generateImpulseResponse(duration, decay, false);
  }

  public applyState(state: SoundAliveState): void {
    this.currentState = state;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const t = 0.05; // smooth transition time constant to avoid pops

    // Master Bypass
    if (this.bypassGain && this.wetGain) {
      if (state.enabled) {
        this.wetGain.gain.setTargetAtTime(1.0, now, t);
        this.bypassGain.gain.setTargetAtTime(0.0, now, t);
      } else {
        this.wetGain.gain.setTargetAtTime(0.0, now, t);
        this.bypassGain.gain.setTargetAtTime(1.0, now, t);
      }
    }

    // 9-band EQ
    state.bands.forEach((gainVal, idx) => {
      if (this.eqFilters[idx]) {
        // Range -10 to +10 dB
        const clamped = Math.max(-10, Math.min(10, gainVal));
        this.eqFilters[idx].gain.setTargetAtTime(clamped, now, t);
      }
    });

    // Dual Dials: Bass / Treble (-100 to 100)
    // -100 = full bass, +100 = full treble
    if (this.dialBassFilter && this.dialTrebleFilter) {
      const bassGain = state.bassTreble < 0
        ? (-state.bassTreble / 100) * 8.5
        : (-state.bassTreble / 100) * 4.0;
      const trebleGain = state.bassTreble > 0
        ? (state.bassTreble / 100) * 8.5
        : (state.bassTreble / 100) * 4.0;

      this.dialBassFilter.gain.setTargetAtTime(bassGain, now, t);
      this.dialTrebleFilter.gain.setTargetAtTime(trebleGain, now, t);
    }

    // Dual Dials: Instrument / Vocal (-100 to 100)
    // -100 = Instrument focus (boost warm mids & presence, tame harsh vocal center)
    // +100 = Vocal focus (boost 2.5kHz voice clarity)
    if (this.dialVocalFilter && this.dialInstrumentFilter) {
      const vocalGain = (state.instrumentVocal / 100) * 7.0;
      const instGain = (-state.instrumentVocal / 100) * 5.0;

      this.dialVocalFilter.gain.setTargetAtTime(vocalGain, now, t);
      this.dialInstrumentFilter.gain.setTargetAtTime(instGain, now, t);
    }

    // Bass Boost
    if (this.bassBoostFilter) {
      const boostGain = state.bassBoost ? (state.bassBoostLevel / 10) * 7.5 : 0;
      this.bassBoostFilter.gain.setTargetAtTime(boostGain, now, t);
    }

    // Clarity
    if (this.clarityFilter1 && this.clarityFilter2) {
      const clarityGain1 = state.clarity ? (state.clarityLevel / 10) * 5.0 : 0;
      const clarityGain2 = state.clarity ? (state.clarityLevel / 10) * 4.0 : 0;
      this.clarityFilter1.gain.setTargetAtTime(clarityGain1, now, t);
      this.clarityFilter2.gain.setTargetAtTime(clarityGain2, now, t);
    }

    // UHQ Upscaler
    if (this.uhqFilter) {
      this.uhqFilter.gain.setTargetAtTime(state.uhqUpscaler ? 3.5 : 0, now, t);
    }

    // Tube Amp Pro
    if (this.tubeAmpWetGain && this.tubeAmpDryGain) {
      if (state.tubeAmp) {
        this.tubeAmpWetGain.gain.setTargetAtTime(0.75 * state.tubeAmpDrive, now, t);
        this.tubeAmpDryGain.gain.setTargetAtTime(0.55, now, t);
      } else {
        this.tubeAmpWetGain.gain.setTargetAtTime(0.0, now, t);
        this.tubeAmpDryGain.gain.setTargetAtTime(1.0, now, t);
      }
    }

    // Input Gain / Preamp
    if (this.inputGain && state.gainDb !== undefined) {
      const linearGain = Math.pow(10, state.gainDb / 20);
      this.inputGain.gain.setTargetAtTime(linearGain, now, t);
    }

    // 3D Surround (Haas stereo widener)
    if (this.surroundWetGain && this.surroundDryGain) {
      if (state.surround3D) {
        let amount = 0.55;
        if (state.surroundAmount !== undefined && state.surroundAmount > 0) {
          amount = (state.surroundAmount / 1000) * 0.95;
        } else if (state.surroundLevel === 'low') {
          amount = 0.35;
        } else if (state.surroundLevel === 'high') {
          amount = 0.85;
        }
        this.surroundWetGain.gain.setTargetAtTime(amount, now, t);
        this.surroundDryGain.gain.setTargetAtTime(Math.max(0.2, 1.0 - (amount * 0.25)), now, t);
      } else {
        this.surroundWetGain.gain.setTargetAtTime(0.0, now, t);
        this.surroundDryGain.gain.setTargetAtTime(1.0, now, t);
      }
    }

    // Concert Hall Reverb (Convolver acoustic matrix)
    if (this.reverbWetGain && this.reverbDryGain) {
      if (state.concertHall) {
        let wetAmt = 0.45;
        if (state.concertHallAmount !== undefined && state.concertHallAmount > 0) {
          wetAmt = (state.concertHallAmount / 1000) * 0.80;
        }
        this.reverbWetGain.gain.setTargetAtTime(wetAmt, now, t);
        this.reverbDryGain.gain.setTargetAtTime(Math.max(0.25, 1.0 - (wetAmt * 0.35)), now, t);
      } else {
        this.reverbWetGain.gain.setTargetAtTime(0.0, now, t);
        this.reverbDryGain.gain.setTargetAtTime(1.0, now, t);
      }
    }
  }

  // Get visualizer frequency data array
  public getFrequencyData(array: Uint8Array): void {
    if (this.analyserNode) {
      // Cast to satisfy stricter TypeScript lib.dom definitions
      this.analyserNode.getByteFrequencyData(array as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  // Get visualizer waveform data
  public getTimeDomainData(array: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(array as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  public setMasterVolume(volume: number): void {
    if (this.outputGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1.5, volume));
      this.outputGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  public destroy(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}

// Global singleton instance
export const soundAliveAudioEngine = new SoundAliveEngine();
