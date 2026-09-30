package com.soundalive.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.EnvironmentalReverb;
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

    // Frequencies of the 9 sliders in the SoundAlive UI
    public static final int[] UI_FREQUENCIES_HZ = {63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};

    private final Set<Integer> activeSessions = new HashSet<>();
    private final Map<Integer, Equalizer> equalizers = new HashMap<>();
    private final Map<Integer, BassBoost> bassBoosts = new HashMap<>();
    private final Map<Integer, Virtualizer> virtualizers = new HashMap<>();
    private final Map<Integer, PresetReverb> presetReverbs = new HashMap<>();
    private final Map<Integer, EnvironmentalReverb> envReverbs = new HashMap<>();

    private boolean masterEnabled = true;
    private short bassBoostStrength = 600; // 0 - 1000
    private short virtualizerStrength = 500; // 0 - 1000
    private short reverbPreset = PresetReverb.PRESET_NONE;
    private boolean concertHallEnabled = false;

    // Stores the 9 UI band levels (-1000 to +1000 mB)
    private final Map<Short, Short> uiBandLevels = new HashMap<>();

    private Context appContext;

    private AudioEffectsManager() {
        // Initialize default flat EQ
        for (short i = 0; i < UI_FREQUENCIES_HZ.length; i++) {
            uiBandLevels.put(i, (short) 0);
        }
    }

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
            // Session 0 (Global audio mix) - supported on Android 8.1 Oreo (Galaxy J2 Core)
            attachSession(0);
        }
    }

    public synchronized void attachSession(int sessionId) {
        if (activeSessions.contains(sessionId) && equalizers.containsKey(sessionId)) {
            return;
        }
        activeSessions.add(sessionId);

        // 1. Equalizer
        try {
            Equalizer eq = new Equalizer(0, sessionId);
            eq.setEnabled(masterEnabled);
            applyAllBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Equalizer on session " + sessionId + ": " + e.getMessage());
        }

        // 2. Bass Boost
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

        // 3. Virtualizer (Surround 3D)
        try {
            Virtualizer virt = new Virtualizer(0, sessionId);
            short effectiveVirtStrength = concertHallEnabled ? (short) Math.max(700, virtualizerStrength) : virtualizerStrength;
            virt.setEnabled(masterEnabled && effectiveVirtStrength > 0);
            if (virt.getStrengthSupported()) {
                virt.setStrength(effectiveVirtStrength);
            }
            virtualizers.put(sessionId, virt);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Virtualizer on session " + sessionId + ": " + e.getMessage());
        }

        // 4. EnvironmentalReverb (Deep hardware acoustic reverb)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(0, sessionId);
            configureEnvironmentalReverb(env);
            env.setEnabled(masterEnabled && concertHallEnabled);
            envReverbs.put(sessionId, env);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init EnvironmentalReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 5. PresetReverb (System auxiliary reverb)
        try {
            PresetReverb rev = new PresetReverb(0, sessionId);
            rev.setEnabled(masterEnabled && concertHallEnabled);
            rev.setPreset(reverbPreset != 0 ? reverbPreset : PresetReverb.PRESET_LARGEHALL);
            presetReverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init PresetReverb on session " + sessionId + ": " + e.getMessage());
        }
    }

    public synchronized void detachSession(int sessionId) {
        if (sessionId == 0) return; // Keep global mix active
        activeSessions.remove(sessionId);

        Equalizer eq = equalizers.remove(sessionId);
        if (eq != null) { try { eq.release(); } catch (Exception ignored) {} }

        BassBoost bb = bassBoosts.remove(sessionId);
        if (bb != null) { try { bb.release(); } catch (Exception ignored) {} }

        Virtualizer v = virtualizers.remove(sessionId);
        if (v != null) { try { v.release(); } catch (Exception ignored) {} }

        EnvironmentalReverb env = envReverbs.remove(sessionId);
        if (env != null) { try { env.release(); } catch (Exception ignored) {} }

        PresetReverb r = presetReverbs.remove(sessionId);
        if (r != null) { try { r.release(); } catch (Exception ignored) {} }
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
            short effVirt = concertHallEnabled ? (short) Math.max(700, virtualizerStrength) : virtualizerStrength;
            try { v.setEnabled(enabled && effVirt > 0); } catch (Exception ignored) {}
        }
        for (EnvironmentalReverb env : envReverbs.values()) {
            try { env.setEnabled(enabled && concertHallEnabled); } catch (Exception ignored) {}
        }
        for (PresetReverb r : presetReverbs.values()) {
            try { r.setEnabled(enabled && concertHallEnabled); } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setBandLevel(short uiBandIndex, short level) {
        if (uiBandIndex < 0 || uiBandIndex >= UI_FREQUENCIES_HZ.length) return;
        uiBandLevels.put(uiBandIndex, level);

        // Apply interpolated levels to all active equalizers
        for (Equalizer eq : equalizers.values()) {
            applyAllBandsToEqualizer(eq);
        }
        savePreferences();
    }

    /**
     * Smart frequency interpolation:
     * Maps the 9 UI frequencies into the actual physical bands of the device.
     * On Galaxy J2 Core (5 physical bands), every slider moves its corresponding acoustic range!
     * On devices with 9 or 10 physical bands, maps 1:1 directly!
     */
    private void applyAllBandsToEqualizer(Equalizer eq) {
        if (eq == null) return;
        try {
            short numPhysicalBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange(); // e.g. [-1000, 1000]
            short minLvl = range[0];
            short maxLvl = range[1];

            // If Concert Hall is on, SoundAlive adds acoustic brightness (+1.5 dB on high bands)
            short hallBoost = concertHallEnabled ? (short) 150 : (short) 0;

            if (numPhysicalBands >= 9) {
                // Direct 1:1 mapping on 9 or 10 band DSPs
                for (short b = 0; b < numPhysicalBands && b < UI_FREQUENCIES_HZ.length; b++) {
                    Short val = uiBandLevels.get(b);
                    short lvl = (val != null) ? val : 0;
                    if (b >= 5) lvl += hallBoost;
                    short clamped = (short) Math.max(minLvl, Math.min(maxLvl, lvl));
                    eq.setBandLevel(b, clamped);
                }
            } else {
                // Galaxy J2 Core and 5-band DSPs:
                // Map each physical band based on its center frequency and frequency span
                for (short p = 0; p < numPhysicalBands; p++) {
                    int centerFreqHz = eq.getCenterFreq(p) / 1000;
                    int[] bandSpan = eq.getBandFreqRange(p);
                    int minSpanHz = bandSpan[0] / 1000;
                    int maxSpanHz = bandSpan[1] / 1000;

                    double totalWeight = 0;
                    double weightedSum = 0;

                    for (int u = 0; u < UI_FREQUENCIES_HZ.length; u++) {
                        int uiFreq = UI_FREQUENCIES_HZ[u];
                        Short uiVal = uiBandLevels.get((short) u);
                        double val = (uiVal != null) ? uiVal : 0.0;
                        if (u >= 5) val += hallBoost;

                        // Check if this UI frequency is inside or near this physical band's span
                        if (uiFreq >= minSpanHz && uiFreq <= maxSpanHz) {
                            double dist = Math.abs(Math.log(Math.max(1, uiFreq)) - Math.log(Math.max(1, centerFreqHz)));
                            double weight = 1.0 / (1.0 + dist * 2.0);
                            weightedSum += val * weight;
                            totalWeight += weight;
                        }
                    }

                    // Fallback to nearest UI frequency if outside bounds
                    if (totalWeight <= 0) {
                        int bestU = 0;
                        double bestDist = Double.MAX_VALUE;
                        for (int u = 0; u < UI_FREQUENCIES_HZ.length; u++) {
                            double dist = Math.abs(Math.log(UI_FREQUENCIES_HZ[u]) - Math.log(Math.max(1, centerFreqHz)));
                            if (dist < bestDist) {
                                bestDist = dist;
                                bestU = u;
                            }
                        }
                        Short uiVal = uiBandLevels.get((short) bestU);
                        weightedSum = (uiVal != null) ? uiVal : 0.0;
                        totalWeight = 1.0;
                    }

                    short targetLevel = (short) Math.round(weightedSum / totalWeight);
                    short clamped = (short) Math.max(minLvl, Math.min(maxLvl, targetLevel));
                    eq.setBandLevel(p, clamped);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error applying bands to equalizer: " + e.getMessage());
        }
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
        updateVirtualizers();
        savePreferences();
    }

    private void updateVirtualizers() {
        short effectiveStrength = concertHallEnabled ? (short) Math.max(750, virtualizerStrength) : virtualizerStrength;
        for (Virtualizer v : virtualizers.values()) {
            try {
                v.setEnabled(masterEnabled && effectiveStrength > 0);
                if (v.getStrengthSupported()) {
                    v.setStrength(effectiveStrength);
                }
            } catch (Exception ignored) {}
        }
    }

    public synchronized void setReverbPreset(short preset) {
        this.reverbPreset = preset;
        this.concertHallEnabled = (preset != PresetReverb.PRESET_NONE);

        // 1. Update EnvironmentalReverb for hardware spatial resonance
        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                env.setEnabled(masterEnabled && concertHallEnabled);
                if (concertHallEnabled) {
                    configureEnvironmentalReverb(env);
                }
            } catch (Exception ignored) {}
        }

        // 2. Update PresetReverb
        for (PresetReverb r : presetReverbs.values()) {
            try {
                r.setEnabled(masterEnabled && concertHallEnabled);
                if (concertHallEnabled) {
                    r.setPreset(preset);
                }
            } catch (Exception ignored) {}
        }

        // 3. Samsung SoundAlive spatial coupling:
        // Concert Hall expands virtualizer to create 3D hall acoustics
        updateVirtualizers();

        // 4. Refresh Equalizer with acoustic presence boost
        for (Equalizer eq : equalizers.values()) {
            applyAllBandsToEqualizer(eq);
        }

        savePreferences();
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env) {
        if (env == null) return;
        try {
            // Loud, unmistakably audible concert hall room level
            env.setRoomLevel((short) 0); // 0 mB (Maximum room reflections)
            env.setRoomHFLevel((short) -150); // slight high freq attenuation for warmth
            env.setReflectionsLevel((short) -200); // clear early reflections
            env.setReverbLevel((short) 500); // +5 dB prominent reverb tail!

            if (reverbPreset == PresetReverb.PRESET_SMALLROOM) {
                env.setDecayTime(1500); // 1.5 seconds
                env.setDecayHFRatio((short) 750);
            } else if (reverbPreset == PresetReverb.PRESET_MEDIUMROOM) {
                env.setDecayTime(2200); // 2.2 seconds
                env.setDecayHFRatio((short) 800);
            } else if (reverbPreset == PresetReverb.PRESET_LARGEROOM) {
                env.setDecayTime(2900); // 2.9 seconds
                env.setDecayHFRatio((short) 850);
            } else if (reverbPreset == PresetReverb.PRESET_MEDIUMHALL) {
                env.setDecayTime(3500); // 3.5 seconds
                env.setDecayHFRatio((short) 900);
            } else { // LARGEHALL / AUDITORIUM (Concert Hall flagship)
                env.setDecayTime(4500); // 4.5 seconds massive concert hall decay!
                env.setDecayHFRatio((short) 950);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error configuring EnvironmentalReverb: " + e.getMessage());
        }
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
            for (Map.Entry<Short, Short> entry : uiBandLevels.entrySet()) {
                ed.putInt("ui_band_" + entry.getKey(), entry.getValue());
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
            concertHallEnabled = (reverbPreset != PresetReverb.PRESET_NONE);

            for (short b = 0; b < UI_FREQUENCIES_HZ.length; b++) {
                if (sp.contains("ui_band_" + b)) {
                    uiBandLevels.put(b, (short) sp.getInt("ui_band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }
}
