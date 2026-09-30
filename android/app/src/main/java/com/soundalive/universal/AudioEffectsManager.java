package com.soundalive.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.PresetReverb;
import android.media.audiofx.Virtualizer;
import android.util.Log;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class AudioEffectsManager {
    private static final String TAG = "SoundAliveEffects";
    private static final String PREFS_NAME = "SoundAliveAudioPrefs";
    private static AudioEffectsManager instance;

    private final Set<Integer> activeSessions = new HashSet<>();
    private final Map<Integer, Equalizer> equalizers = new HashMap<>();
    private final Map<Integer, BassBoost> bassBoosts = new HashMap<>();
    private final Map<Integer, Virtualizer> virtualizers = new HashMap<>();
    private final Map<Integer, PresetReverb> reverbs = new HashMap<>();

    private boolean masterEnabled = true;
    private short bassBoostStrength = 600; // 0 - 1000
    private short virtualizerStrength = 500; // 0 - 1000
    private short reverbPreset = PresetReverb.PRESET_NONE;
    private final Map<Short, Short> bandLevels = new HashMap<>();

    private Context appContext;

    private AudioEffectsManager() {}

    public static synchronized AudioEffectsManager getInstance() {
        if (instance == null) {
            instance = new AudioEffectsManager();
        }
        return instance;
    }

    public synchronized void init(Context context) {
        if (this.appContext == null) {
            this.appContext = context.getApplicationContext();
            loadPreferences();
            // Attach to global audio mix session (0) - supported on Android 8.1 / Galaxy J2 Core
            attachSession(0);
        }
    }

    public synchronized void attachSession(int sessionId) {
        if (activeSessions.contains(sessionId) && equalizers.containsKey(sessionId)) {
            return;
        }
        activeSessions.add(sessionId);

        try {
            Equalizer eq = new Equalizer(0, sessionId);
            eq.setEnabled(masterEnabled);
            applyBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Equalizer on session " + sessionId + ": " + e.getMessage());
        }

        try {
            BassBoost bb = new BassBoost(0, sessionId);
            bb.setEnabled(masterEnabled && bassBoostStrength > 0);
            if (bb.getStrengthSupported()) {
                bb.setStrength(bassBoostStrength);
            }
            bassBoosts.put(sessionId, bb);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init BassBoost on session " + sessionId + ": " + e.getMessage());
        }

        try {
            Virtualizer virt = new Virtualizer(0, sessionId);
            virt.setEnabled(masterEnabled && virtualizerStrength > 0);
            if (virt.getStrengthSupported()) {
                virt.setStrength(virtualizerStrength);
            }
            virtualizers.put(sessionId, virt);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Virtualizer on session " + sessionId + ": " + e.getMessage());
        }

        try {
            PresetReverb rev = new PresetReverb(0, sessionId);
            rev.setEnabled(masterEnabled && reverbPreset != PresetReverb.PRESET_NONE);
            rev.setPreset(reverbPreset);
            reverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init PresetReverb on session " + sessionId + ": " + e.getMessage());
        }
    }

    public synchronized void detachSession(int sessionId) {
        if (sessionId == 0) return; // Keep global mix active
        activeSessions.remove(sessionId);

        Equalizer eq = equalizers.remove(sessionId);
        if (eq != null) {
            try { eq.release(); } catch (Exception ignored) {}
        }
        BassBoost bb = bassBoosts.remove(sessionId);
        if (bb != null) {
            try { bb.release(); } catch (Exception ignored) {}
        }
        Virtualizer v = virtualizers.remove(sessionId);
        if (v != null) {
            try { v.release(); } catch (Exception ignored) {}
        }
        PresetReverb r = reverbs.remove(sessionId);
        if (r != null) {
            try { r.release(); } catch (Exception ignored) {}
        }
    }

    public synchronized void setMasterEnabled(boolean enabled) {
        this.masterEnabled = enabled;
        for (Equalizer eq : equalizers.values()) {
            try { eq.setEnabled(enabled); } catch (Exception ignored) {}
        }
        for (BassBoost bb : bassBoosts.values()) {
            try { bb.setEnabled(enabled && bassBoostStrength > 0); } catch (Exception ignored) {}
        }
        for (Virtualizer v : virtualizers.values()) {
            try { v.setEnabled(enabled && virtualizerStrength > 0); } catch (Exception ignored) {}
        }
        for (PresetReverb r : reverbs.values()) {
            try { r.setEnabled(enabled && reverbPreset != PresetReverb.PRESET_NONE); } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setBandLevel(short band, short level) {
        bandLevels.put(band, level);
        for (Equalizer eq : equalizers.values()) {
            try {
                short min = eq.getBandLevelRange()[0];
                short max = eq.getBandLevelRange()[1];
                short clamped = (short) Math.max(min, Math.min(max, level));
                eq.setBandLevel(band, clamped);
            } catch (Exception e) {
                Log.w(TAG, "Error setting band " + band + ": " + e.getMessage());
            }
        }
        savePreferences();
    }

    public synchronized void setBassBoostStrength(short strength) {
        this.bassBoostStrength = (short) Math.max(0, Math.min(1000, strength));
        for (BassBoost bb : bassBoosts.values()) {
            try {
                bb.setEnabled(masterEnabled && bassBoostStrength > 0);
                if (bb.getStrengthSupported()) {
                    bb.setStrength(bassBoostStrength);
                }
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setVirtualizerStrength(short strength) {
        this.virtualizerStrength = (short) Math.max(0, Math.min(1000, strength));
        for (Virtualizer v : virtualizers.values()) {
            try {
                v.setEnabled(masterEnabled && virtualizerStrength > 0);
                if (v.getStrengthSupported()) {
                    v.setStrength(virtualizerStrength);
                }
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setReverbPreset(short preset) {
        this.reverbPreset = preset;
        for (PresetReverb r : reverbs.values()) {
            try {
                r.setEnabled(masterEnabled && reverbPreset != PresetReverb.PRESET_NONE);
                r.setPreset(reverbPreset);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    private void applyBandsToEqualizer(Equalizer eq) {
        try {
            short[] range = eq.getBandLevelRange();
            short numBands = eq.getNumberOfBands();
            for (short b = 0; b < numBands; b++) {
                Short lvl = bandLevels.get(b);
                if (lvl != null) {
                    short clamped = (short) Math.max(range[0], Math.min(range[1], lvl));
                    eq.setBandLevel(b, clamped);
                }
            }
        } catch (Exception ignored) {}
    }

    private void savePreferences() {
        if (appContext == null) return;
        try {
            SharedPreferences sp = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean("masterEnabled", masterEnabled);
            ed.putInt("bassBoost", bassBoostStrength);
            ed.putInt("virtualizer", virtualizerStrength);
            ed.putInt("reverb", reverbPreset);
            for (Map.Entry<Short, Short> entry : bandLevels.entrySet()) {
                ed.putInt("band_" + entry.getKey(), entry.getValue());
            }
            ed.apply();
        } catch (Exception ignored) {}
    }

    private void loadPreferences() {
        if (appContext == null) return;
        try {
            SharedPreferences sp = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            masterEnabled = sp.getBoolean("masterEnabled", true);
            bassBoostStrength = (short) sp.getInt("bassBoost", 600);
            virtualizerStrength = (short) sp.getInt("virtualizer", 500);
            reverbPreset = (short) sp.getInt("reverb", PresetReverb.PRESET_NONE);

            for (short b = 0; b < 10; b++) {
                if (sp.contains("band_" + b)) {
                    bandLevels.put(b, (short) sp.getInt("band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }
}
