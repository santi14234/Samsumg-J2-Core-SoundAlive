import { registerPlugin } from '@capacitor/core';

interface SoundAliveSystemPlugin {
  canWriteSettings(): Promise<{ canWrite: boolean }>;
  openWriteSettings(): Promise<void>;
  startBackgroundService(): Promise<{ started: boolean }>;
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
