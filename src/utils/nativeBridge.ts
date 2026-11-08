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
  globalOnly?: boolean;
  globalActive?: boolean;
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
  setLimiter(options: { strength: number }): Promise<void>;
  setRoomType(options: { type: number }): Promise<void>;
  setGlobalOutputOnly(options: { enabled: boolean }): Promise<{ globalOnly: boolean }>;
  getEffectsStatus(): Promise<NativeEffectsStatus>;
  // Bridge methods expected by App.tsx
  updateControl(options: { controlName: string; value: number }): Promise<void>;
  setBypass(options: { bypass: boolean }): Promise<void>;
  saveProfileSlot(options: { slotIndex: number; profileData: string }): Promise<void>;
  loadProfileSlot(options: { slotIndex: number }): Promise<{ profileData: string }>;
}

const SoundAliveSystem = registerPlugin<SoundAliveSystemPlugin>('SoundAliveSystem');

export const nativeBridge = {
  isNativeAndroidApp: () => {
    if (typeof window === 'undefined') return false;
    const cap = (window as any).Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  },

  updateControl: async (controlName: string, value: number) => {
    if (nativeBridge.isNativeAndroidApp()) {
      try { await SoundAliveSystem.updateControl({ controlName, value }); } catch (e) { console.error(e); }
    } else {
      console.log(`[Web Fallback] updateControl: ${controlName} = ${value}`);
    }
  },

  setBypass: async (bypass: boolean) => {
    if (nativeBridge.isNativeAndroidApp()) {
      try { await SoundAliveSystem.setBypass({ bypass }); } catch (e) { console.error(e); }
    } else {
      console.log(`[Web Fallback] setBypass: ${bypass}`);
    }
  },

  setGlobalOutputOnly: async (enabled: boolean) => {
    if (nativeBridge.isNativeAndroidApp()) {
      try { await SoundAliveSystem.setGlobalOutputOnly({ enabled }); } catch (e) { console.error(e); }
    } else {
      console.log(`[Web Fallback] setGlobalOutputOnly: ${enabled}`);
    }
  },

  getEffectsStatus: async (): Promise<NativeEffectsStatus | null> => {
    if (!nativeBridge.isNativeAndroidApp()) return null;
    try { return await SoundAliveSystem.getEffectsStatus(); } catch (e) { console.error(e); return null; }
  },

  saveProfileSlot: async (slotIndex: number, profileData: any) => {
    const jsonStr = JSON.stringify(profileData);
    if (nativeBridge.isNativeAndroidApp()) {
      try { await SoundAliveSystem.saveProfileSlot({ slotIndex, profileData: jsonStr }); } catch (e) { console.error(e); }
    } else {
      localStorage.setItem(`profile_slot_${slotIndex}`, jsonStr);
    }
  },

  loadProfileSlot: async (slotIndex: number): Promise<any> => {
    if (nativeBridge.isNativeAndroidApp()) {
      try { 
        const res = await SoundAliveSystem.loadProfileSlot({ slotIndex });
        return res.profileData ? JSON.parse(res.profileData) : null;
      } catch (e) { console.error(e); return null; }
    } else {
      const res = localStorage.getItem(`profile_slot_${slotIndex}`);
      return res ? JSON.parse(res) : null;
    }
  }
};
