import { registerPlugin } from '@capacitor/core';

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
  getEffectsStatus(): Promise<NativeEffectsStatus>;
}

const SoundAliveSystem = registerPlugin<SoundAliveSystemPlugin>('SoundAliveSystem');

export const isNativeAndroidApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
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
  if (!isNativeAndroidApp()) return;
  try {
    await SoundAliveSystem.setConcertHall({ enabled });
  } catch (err) {
    console.warn('Native setConcertHall error:', err);
  }
};

export const syncNativeAmbientSound = syncNativeConcertHall;

export const syncNativeBandLevel = async (band: number, dbGain: number): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    // Convert dB (-10 to +10 dB) to millibels (-1000 to +1000 mB)
    const level = Math.round(dbGain * 100);
    await SoundAliveSystem.setBandLevel({ band, level });
  } catch (err) {
    console.warn('Native setBandLevel error:', err);
  }
};

export const getNativeEffectsStatus = async (): Promise<NativeEffectsStatus | null> => {
  if (!isNativeAndroidApp()) return null;
  try {
    return await SoundAliveSystem.getEffectsStatus();
  } catch (err) {
    console.warn('Cannot get native effects status:', err);
    return null;
  }
};
