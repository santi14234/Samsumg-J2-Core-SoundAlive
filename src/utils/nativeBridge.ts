import { registerPlugin } from '@capacitor/core';

interface SoundAliveSystemPlugin {
  canWriteSettings(): Promise<{ canWrite: boolean }>;
  openWriteSettings(): Promise<void>;
  startBackgroundService(): Promise<{ started: boolean }>;
  setMasterEnabled(options: { enabled: boolean }): Promise<void>;
  setBandLevel(options: { band: number; level: number }): Promise<void>;
  setBassBoost(options: { strength: number }): Promise<void>;
  setSurround(options: { strength: number }): Promise<void>;
  setReverb(options: { preset: number }): Promise<void>;
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

export const syncNativeBassBoost = async (enabled: boolean, level: number): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    // level is 0 - 10, scale to 0 - 1000
    const strength = enabled ? Math.round((level / 10) * 1000) : 0;
    await SoundAliveSystem.setBassBoost({ strength });
  } catch (err) {
    console.warn('Native setBassBoost error:', err);
  }
};

export const syncNativeSurround = async (enabled: boolean, level: 'low' | 'medium' | 'high'): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    const multiplier = level === 'high' ? 1000 : level === 'medium' ? 650 : 350;
    const strength = enabled ? multiplier : 0;
    await SoundAliveSystem.setSurround({ strength });
  } catch (err) {
    console.warn('Native setSurround error:', err);
  }
};

export const syncNativeReverb = async (enabled: boolean, size: string): Promise<void> => {
  if (!isNativeAndroidApp()) return;
  try {
    // PresetReverb: 0 = NONE, 1 = SMALLROOM, 2 = MEDIUMROOM, 3 = LARGEROOM, 4 = MEDIUMHALL, 5 = LARGEHALL, 6 = PLATE
    let preset = 0;
    if (enabled) {
      if (size === 'room') preset = 1;
      else if (size === 'hall') preset = 4;
      else if (size === 'auditorium') preset = 5;
      else preset = 2;
    }
    await SoundAliveSystem.setReverb({ preset });
  } catch (err) {
    console.warn('Native setReverb error:', err);
  }
};
