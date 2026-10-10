import { registerPlugin } from '@capacitor/core';

// Direct Root WebView JavascriptInterface (window.AndroidAudio)
declare global {
  interface Window {
    AndroidAudio?: {
      isConnected(): boolean;
      isRootDevice(): boolean;
      setMasterPower(enabled: boolean): void;
      updateAtmosphere(progress: number): void;
      updateClarity(progress: number): void;
      updateBassBoost(progress: number): void;
      updateSurround(progress: number): void;
      updateDynamicBoost(progress: number): void;
      getStatus(): string;
    };
  }
}

export interface NativeEffectsStatus {
  masterEnabled: boolean;
  equalizerActive: boolean;
  equalizerBands: number;
  bassBoostSupported: boolean;
  bassBoostActive: boolean;
  bassBoostStrength: number;
  concertHallEnabled: boolean;
  concertHallActive: boolean;
  presetReverbSupported: boolean;
  envReverbSupported: boolean;
  roomAcousticSupported: boolean;
  concertHallEngine: string;
  sessionsCount: number;
  activeSessions: number[];
  hardwareEngines: string[];
  isAudioOutputActive?: boolean;
  audioModifiedInSystem?: boolean;
  eqLive?: boolean;
  bassBoostLive?: boolean;
  reverbLive?: boolean;
  virtualizerLive?: boolean;
  clarityLive?: boolean;
  loudnessLive?: boolean;
  gainLive?: boolean;
  isAndroidGoDetected?: boolean;
  hasEqualizerHardware?: boolean;
  hasBassBoostHardware?: boolean;
  hasVirtualizerHardware?: boolean;
  hasReverbHardware?: boolean;
  hasLoudnessEnhancerHardware?: boolean;
  lastAudioFlingerError?: string;
  isRootActive?: boolean;
  bridgeConnected?: boolean;
}

interface SoundAliveSystemPlugin {
  canWriteSettings(): Promise<{ canWrite: boolean }>;
  openWriteSettings(): Promise<void>;
  startBackgroundService(): Promise<{ started: boolean }>;
  setMasterEnabled(options: { enabled: boolean }): Promise<void>;
  setBandLevel(options: { band: number; level: number }): Promise<void>;
  setBassBoost(options: { strength: number }): Promise<void>;
  setSamsungDials(options: { bassTreble: number; vocalInstrument: number }): Promise<void>;
  setConcertHall(options: { enabled: boolean }): Promise<void>;
  setGain(options: { gain: number }): Promise<void>;
  setClarity(options: { strength: number }): Promise<void>;
  setAmbiente(options: { strength: number }): Promise<void>;
  setSurround(options: { strength: number }): Promise<void>;
  setDynamicBoost(options: { strength: number }): Promise<void>;
  getEffectsStatus(): Promise<NativeEffectsStatus>;
}

const SoundAliveSystem = registerPlugin<SoundAliveSystemPlugin>('SoundAliveSystem');

export const isNativeAndroidApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  if ((window as any).AndroidAudio) return true;
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
};

export const hasDirectRootBridge = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).AndroidAudio;
};

export const checkWriteSettingsPermission = async (): Promise<boolean> => {
  try {
    const res = await SoundAliveSystem.canWriteSettings();
    return !!res?.canWrite;
  } catch {
    return false;
  }
};

export const openWriteSettingsScreen = async (): Promise<void> => {
  try {
    await SoundAliveSystem.openWriteSettings();
  } catch (err) {
    console.warn('Cannot open native settings:', err);
  }
};

export const startNativeBackgroundService = async (): Promise<void> => {
  try {
    await SoundAliveSystem.startBackgroundService();
  } catch (err) {
    console.warn('Cannot start background service:', err);
  }
};

export const syncNativeMasterEnabled = async (enabled: boolean): Promise<void> => {
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.setMasterPower(enabled);
    } catch (e) {
      console.warn('AndroidAudio.setMasterPower error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setMasterEnabled({ enabled });
  } catch (err) {
    console.warn('Native setMasterEnabled error:', err);
  }
};

export const syncNativeSamsungDials = async (bassTreble: number, vocalInstrument: number): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setSamsungDials({ bassTreble, vocalInstrument });
  } catch (err) {
    console.warn('Native setSamsungDials error:', err);
  }
};

export const syncNativeConcertHall = async (enabled: boolean): Promise<void> => {
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateAtmosphere(enabled ? 60 : 0);
    } catch (e) {
      console.warn('AndroidAudio.updateAtmosphere error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setConcertHall({ enabled });
  } catch (err) {
    console.warn('Native setConcertHall error:', err);
  }
};

export const syncNativeGain = async (gainDb: number): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    const gain = Math.round(gainDb * 100);
    await SoundAliveSystem.setGain({ gain });
  } catch (err) {
    console.warn('Native setGain error:', err);
  }
};

export const syncNativeClarity = async (strength: number): Promise<void> => {
  // strength is 0 - 1000, convert to 0 - 100% for direct bridge
  const percent = Math.round(strength / 10);
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateClarity(percent);
    } catch (e) {
      console.warn('AndroidAudio.updateClarity error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setClarity({ strength });
  } catch (err) {
    console.warn('Native setClarity error:', err);
  }
};

export const syncNativeAmbiente = async (strength: number): Promise<void> => {
  // strength is 0 - 1000, convert to 0 - 100% for direct bridge
  const percent = Math.round(strength / 10);
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateAtmosphere(percent);
    } catch (e) {
      console.warn('AndroidAudio.updateAtmosphere error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setAmbiente({ strength });
  } catch (err) {
    console.warn('Native setAmbiente error:', err);
  }
};

export const syncNativeSurround = async (strength: number): Promise<void> => {
  const percent = Math.round(strength / 10);
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateSurround(percent);
    } catch (e) {
      console.warn('AndroidAudio.updateSurround error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setSurround({ strength });
  } catch (err) {
    console.warn('Native setSurround error:', err);
  }
};

export const syncNativeDynamicBoost = async (strength: number): Promise<void> => {
  const percent = Math.round(strength / 10);
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateDynamicBoost(percent);
    } catch (e) {
      console.warn('AndroidAudio.updateDynamicBoost error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setDynamicBoost({ strength });
  } catch (err) {
    console.warn('Native setDynamicBoost error:', err);
  }
};

export const syncNativeBassBoost = async (strength: number): Promise<void> => {
  const percent = Math.round(strength / 10);
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      window.AndroidAudio.updateBassBoost(percent);
    } catch (e) {
      console.warn('AndroidAudio.updateBassBoost error:', e);
    }
  }
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setBassBoost({ strength });
  } catch (err) {
    console.warn('Native setBassBoost error:', err);
  }
};

export const syncNativeAmbientSound = syncNativeConcertHall;

export const syncNativeBandLevel = async (band: number, dbGain: number): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    const level = Math.round(dbGain * 100);
    await SoundAliveSystem.setBandLevel({ band, level });
  } catch (err) {
    console.warn('Native setBandLevel error:', err);
  }
};

export const getNativeEffectsStatus = async (): Promise<NativeEffectsStatus | null> => {
  // If direct Root JavascriptInterface is present, pull instant status
  if (typeof window !== 'undefined' && window.AndroidAudio) {
    try {
      const raw = window.AndroidAudio.getStatus();
      const parsed = JSON.parse(raw);
      return {
        masterEnabled: parsed.masterEnabled !== false,
        equalizerActive: !!parsed.equalizerActive,
        equalizerBands: 9,
        bassBoostSupported: true,
        bassBoostActive: !!parsed.bassBoostActive,
        bassBoostStrength: 500,
        concertHallEnabled: !!parsed.reverbActive,
        concertHallActive: !!parsed.reverbActive,
        presetReverbSupported: true,
        envReverbSupported: true,
        roomAcousticSupported: true,
        concertHallEngine: 'EnvironmentalReverb (Root Session 0)',
        sessionsCount: 1,
        activeSessions: [0],
        hardwareEngines: ['Root Global AudioFX (Session 0)'],
        isAudioOutputActive: true,
        audioModifiedInSystem: true,
        eqLive: !!parsed.masterEnabled,
        bassBoostLive: !!parsed.masterEnabled,
        reverbLive: !!parsed.masterEnabled,
        virtualizerLive: !!parsed.masterEnabled,
        clarityLive: !!parsed.masterEnabled,
        loudnessLive: !!parsed.masterEnabled,
        gainLive: !!parsed.masterEnabled,
        isAndroidGoDetected: false,
        hasEqualizerHardware: true,
        hasBassBoostHardware: true,
        hasVirtualizerHardware: true,
        hasReverbHardware: true,
        hasLoudnessEnhancerHardware: true,
        isRootActive: !!parsed.isRootActive,
        bridgeConnected: true,
      };
    } catch (e) {
      console.warn('Direct bridge getStatus error:', e);
    }
  }

  if (!isNativeAndroidApp()) return null;
  try {
    return await SoundAliveSystem.getEffectsStatus();
  } catch (err) {
    console.warn('Cannot get native effects status:', err);
    return null;
  }
};
