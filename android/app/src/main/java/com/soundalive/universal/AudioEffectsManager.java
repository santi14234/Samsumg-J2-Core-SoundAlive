package com.soundalive.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.EnvironmentalReverb;
import android.media.audiofx.LoudnessEnhancer;
import android.media.audiofx.PresetReverb;
import android.media.audiofx.Virtualizer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class AudioEffectsManager {
    private static final String TAG = "SoundAliveEffects";
    private static final String PREFS_NAME = "SoundAliveAudioPrefs";
    private static final int EFFECT_PRIORITY = 2147483647; // Maximum priority
    private static AudioEffectsManager instance;

    public static final int[] UI_FREQUENCIES_HZ = {63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};

    private final Set<Integer> activeSessions = new HashSet<>();
    private final Map<Integer, Equalizer> equalizers = new HashMap<>();
    private final Map<Integer, BassBoost> bassBoosts = new HashMap<>();
    private final Map<Integer, LoudnessEnhancer> loudnessEnhancers = new HashMap<>();
    private final Map<Integer, PresetReverb> presetReverbs = new HashMap<>();
    private final Map<Integer, EnvironmentalReverb> envReverbs = new HashMap<>();
    private final Map<Integer, Virtualizer> virtualizers = new HashMap<>();

    private boolean masterEnabled = true;
    private short bassBoostStrength = 0; // 0 - 1000
    private int gainMillibels = 0; // -500 to +1200 mB
    private int clarityStrength = 0; // 0 - 1000 (Treble boost)
    private int ambienteStrength = 0; // 0 - 1000 (Reverb amount)
    private int surroundStrength = 0; // 0 - 1000 (Virtualizer width)
    private int dynamicBoostStrength = 0; // 0 - 1000 (Compression / Loudness)

    // Dual Dials
    private int dialBassTreble = 0;
    private int dialVocalInstrument = 0;
    private boolean isBasicMode = true;

    private final Map<Short, Short> uiBandLevels = new HashMap<>();
    private Context appContext;

    private AudioEffectsManager() {
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
            attachSession(0);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    AudioManager am = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
                    if (am != null) {
                        am.registerAudioPlaybackCallback(new AudioManager.AudioPlaybackCallback() {
                            @Override
                            public void onPlaybackConfigChanged(List<AudioPlaybackConfiguration> configs) {
                                if (configs == null) return;
                                for (AudioPlaybackConfiguration config : configs) {
                                    try {
                                        java.lang.reflect.Method m = config.getClass().getMethod("getClientAudioSessionId");
                                        Object res = m.invoke(config);
                                        if (res instanceof Integer) {
                                            int sessionId = (Integer) res;
                                            if (sessionId > 0) attachSession(sessionId);
                                        }
                                    } catch (Exception ignored) {}
                                }
                                ensureSession0Alive();
                            }
                        }, new Handler(Looper.getMainLooper()));
                    }
                } catch (Exception e) {
                    Log.w(TAG, "AudioPlaybackCallback error: " + e.getMessage());
                }
            }
        }
    }

    public synchronized void attachSession(int sessionId) {
        if (activeSessions.contains(sessionId) && equalizers.containsKey(sessionId)) {
            Equalizer eq = equalizers.get(sessionId);
            if (eq != null) {
                try {
                    if (!eq.getEnabled()) eq.setEnabled(masterEnabled);
                    applyAllBandsToEqualizer(eq);
                } catch (Exception ignored) {}
            }
            return;
        }
        activeSessions.add(sessionId);

        // 1. Equalizer
        try {
            Equalizer eq = new Equalizer(EFFECT_PRIORITY, sessionId);
            eq.setEnabled(masterEnabled);
            applyAllBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
        } catch (Exception e) {
            Log.w(TAG, "Equalizer init error: " + e.getMessage());
        }

        // 2. BassBoost
        try {
            BassBoost bb = new BassBoost(EFFECT_PRIORITY, sessionId);
            bb.setEnabled(masterEnabled && bassBoostStrength > 0);
            if (bb.getStrengthSupported()) bb.setStrength(bassBoostStrength);
            bassBoosts.put(sessionId, bb);
        } catch (Exception e) {
            Log.w(TAG, "BassBoost init error: " + e.getMessage());
        }

        // 3. LoudnessEnhancer (Gain + Dynamic Boost)
        try {
            LoudnessEnhancer le = new LoudnessEnhancer(sessionId);
            int totalGain = gainMillibels + (int)(dynamicBoostStrength * 0.5); // Add dynamic compression boost
            le.setTargetGain(totalGain);
            le.setEnabled(masterEnabled && totalGain != 0);
            loudnessEnhancers.put(sessionId, le);
        } catch (Exception e) {
            Log.w(TAG, "LoudnessEnhancer init error: " + e.getMessage());
        }

        // 4. EnvironmentalReverb (Ambiente)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env, ambienteStrength);
            env.setEnabled(masterEnabled && ambienteStrength > 0);
            envReverbs.put(sessionId, env);
        } catch (Exception e) {
            Log.w(TAG, "EnvironmentalReverb init error: " + e.getMessage());
        }

        // 5. PresetReverb
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            rev.setPreset(ambienteStrength > 0 ? PresetReverb.PRESET_MEDIUMROOM : PresetReverb.PRESET_NONE);
            rev.setEnabled(masterEnabled && ambienteStrength > 0);
            presetReverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "PresetReverb init error: " + e.getMessage());
        }

        // 6. Virtualizer (Sonido Envolvente)
        try {
            Virtualizer virt = new Virtualizer(EFFECT_PRIORITY, sessionId);
            if (virt.getStrengthSupported()) {
                virt.setStrength((short) surroundStrength);
            }
            virt.setEnabled(masterEnabled && surroundStrength > 0);
            virtualizers.put(sessionId, virt);
        } catch (Exception e) {
            Log.w(TAG, "Virtualizer init error: " + e.getMessage());
        }
    }

    public synchronized void detachSession(int sessionId) {
        if (sessionId == 0) return;
        activeSessions.remove(sessionId);

        Equalizer eq = equalizers.remove(sessionId);
        if (eq != null) { try { eq.release(); } catch (Exception ignored) {} }

        BassBoost bb = bassBoosts.remove(sessionId);
        if (bb != null) { try { bb.release(); } catch (Exception ignored) {} }

        LoudnessEnhancer le = loudnessEnhancers.remove(sessionId);
        if (le != null) { try { le.release(); } catch (Exception ignored) {} }

        EnvironmentalReverb env = envReverbs.remove(sessionId);
        if (env != null) { try { env.release(); } catch (Exception ignored) {} }

        PresetReverb r = presetReverbs.remove(sessionId);
        if (r != null) { try { r.release(); } catch (Exception ignored) {} }

        Virtualizer v = virtualizers.remove(sessionId);
        if (v != null) { try { v.release(); } catch (Exception ignored) {} }
    }

    public synchronized void ensureSession0Alive() {
        if (!masterEnabled) return;
        try {
            Equalizer eq = equalizers.get(0);
            if (eq == null || !eq.hasControl()) {
                attachSession(0);
            } else if (!eq.getEnabled()) {
                eq.setEnabled(true);
            }
        } catch (Exception ignored) {}
    }

    public synchronized void setMasterEnabled(boolean enabled) {
        this.masterEnabled = enabled;
        for (Equalizer eq : equalizers.values()) { try { eq.setEnabled(enabled); } catch (Exception ignored) {} }
        for (BassBoost bb : bassBoosts.values()) { try { bb.setEnabled(enabled && bassBoostStrength > 0); } catch (Exception ignored) {} }
        for (LoudnessEnhancer le : loudnessEnhancers.values()) { try { le.setEnabled(enabled && (gainMillibels != 0 || dynamicBoostStrength > 0)); } catch (Exception ignored) {} }
        for (EnvironmentalReverb env : envReverbs.values()) { try { env.setEnabled(enabled && ambienteStrength > 0); } catch (Exception ignored) {} }
        for (PresetReverb r : presetReverbs.values()) { try { r.setEnabled(enabled && ambienteStrength > 0); } catch (Exception ignored) {} }
        for (Virtualizer v : virtualizers.values()) { try { v.setEnabled(enabled && surroundStrength > 0); } catch (Exception ignored) {} }
        savePreferences();
    }

    public synchronized void setGain(int millibels) {
        this.gainMillibels = Math.max(-500, Math.min(1500, millibels));
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try {
                int totalGain = this.gainMillibels + (int)(dynamicBoostStrength * 0.5);
                le.setTargetGain(totalGain);
                le.setEnabled(masterEnabled && totalGain != 0);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setClarity(int strength) {
        this.clarityStrength = Math.max(0, Math.min(1000, strength));
        // Boost high frequencies (8kHz and 16kHz) for FxSound Clarity
        short boost = (short) Math.round((this.clarityStrength / 1000.0) * 800);
        uiBandLevels.put((short) 7, boost);
        uiBandLevels.put((short) 8, (short) Math.round(boost * 1.2));
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        savePreferences();
    }

    public synchronized void setAmbiente(int strength) {
        this.ambienteStrength = Math.max(0, Math.min(1000, strength));
        boolean active = ambienteStrength > 0;
        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                configureEnvironmentalReverb(env, ambienteStrength);
                env.setEnabled(masterEnabled && active);
            } catch (Exception ignored) {}
        }
        for (PresetReverb r : presetReverbs.values()) {
            try {
                r.setPreset(active ? PresetReverb.PRESET_MEDIUMROOM : PresetReverb.PRESET_NONE);
                r.setEnabled(masterEnabled && active);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setAmbientSound(boolean enabled) {
        setAmbiente(enabled ? 500 : 0);
    }

    public synchronized void setSurround(int strength) {
        this.surroundStrength = Math.max(0, Math.min(1000, strength));
        for (Virtualizer v : virtualizers.values()) {
            try {
                if (v.getStrengthSupported()) v.setStrength((short) surroundStrength);
                v.setEnabled(masterEnabled && surroundStrength > 0);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setDynamicBoost(int strength) {
        this.dynamicBoostStrength = Math.max(0, Math.min(1000, strength));
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try {
                int totalGain = gainMillibels + (int)(dynamicBoostStrength * 0.5);
                le.setTargetGain(totalGain);
                le.setEnabled(masterEnabled && totalGain != 0);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setBassBoostStrength(short strength) {
        this.bassBoostStrength = strength;
        for (BassBoost bb : bassBoosts.values()) {
            try {
                bb.setEnabled(masterEnabled && bassBoostStrength > 0);
                if (bb.getStrengthSupported()) bb.setStrength(bassBoostStrength);
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setBandLevel(short uiBandIndex, short level) {
        if (uiBandIndex < 0 || uiBandIndex >= UI_FREQUENCIES_HZ.length) return;
        uiBandLevels.put(uiBandIndex, level);
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        savePreferences();
    }

    private short getUiVal(int index) {
        Short val = uiBandLevels.get((short) index);
        return (val != null) ? val : 0;
    }

    private short clamp(short val, short min, short max) {
        return (short) Math.max(min, Math.min(max, val));
    }

    private void applyAllBandsToEqualizer(Equalizer eq) {
        if (eq == null) return;
        try {
            short numPhysicalBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange();
            short minLvl = range[0];
            short maxLvl = range[1];

            if (numPhysicalBands == 5) {
                short b0 = (short) Math.round((getUiVal(0) * 0.6) + (getUiVal(1) * 0.4));
                eq.setBandLevel((short) 0, clamp(b0, minLvl, maxLvl));

                short b1 = getUiVal(2);
                eq.setBandLevel((short) 1, clamp(b1, minLvl, maxLvl));

                short b2 = (short) Math.round((getUiVal(3) * 0.5) + (getUiVal(4) * 0.5));
                eq.setBandLevel((short) 2, clamp(b2, minLvl, maxLvl));

                short b3 = (short) Math.round((getUiVal(5) * 0.5) + (getUiVal(6) * 0.5));
                eq.setBandLevel((short) 3, clamp(b3, minLvl, maxLvl));

                short b4 = (short) Math.round((getUiVal(7) * 0.4) + (getUiVal(8) * 0.6));
                eq.setBandLevel((short) 4, clamp(b4, minLvl, maxLvl));
            } else {
                for (short b = 0; b < numPhysicalBands && b < UI_FREQUENCIES_HZ.length; b++) {
                    short lvl = getUiVal(b);
                    eq.setBandLevel(b, clamp(lvl, minLvl, maxLvl));
                }
            }
        } catch (Exception ignored) {}
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env, int strength) {
        if (env == null) return;
        try {
            double ratio = strength / 1000.0;
            env.setRoomLevel((short) (-1000 + (ratio * 400)));
            env.setRoomHFLevel((short) -500);
            env.setReflectionsLevel((short) (-1200 + (ratio * 400)));
            env.setReverbLevel((short) (-800 + (ratio * 400)));
            env.setDecayTime((int)(1000 + (ratio * 1500)));
            env.setDecayHFRatio((short) 750);
        } catch (Exception ignored) {}
    }

    public synchronized JSObject getStatus() {
        JSObject obj = new JSObject();
        obj.put("masterEnabled", masterEnabled);
        obj.put("equalizerActive", masterEnabled && !equalizers.isEmpty());
        obj.put("gainMillibels", gainMillibels);
        obj.put("clarity", clarityStrength);
        obj.put("ambiente", ambienteStrength);
        obj.put("surround", surroundStrength);
        obj.put("dynamicBoost", dynamicBoostStrength);
        obj.put("bassBoost", bassBoostStrength);
        obj.put("sessionsCount", activeSessions.size());
        return obj;
    }

    private void savePreferences() {
        if (appContext == null) return;
        try {
            SharedPreferences sp = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean("masterEnabled", masterEnabled);
            ed.putInt("gainMillibels", gainMillibels);
            ed.putInt("clarity", clarityStrength);
            ed.putInt("ambiente", ambienteStrength);
            ed.putInt("surround", surroundStrength);
            ed.putInt("dynamicBoost", dynamicBoostStrength);
            ed.putInt("bassBoost", bassBoostStrength);
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
            gainMillibels = sp.getInt("gainMillibels", 0);
            clarityStrength = sp.getInt("clarity", 0);
            ambienteStrength = sp.getInt("ambiente", 0);
            surroundStrength = sp.getInt("surround", 0);
            dynamicBoostStrength = sp.getInt("dynamicBoost", 0);
            bassBoostStrength = (short) sp.getInt("bassBoost", 0);

            for (short b = 0; b < UI_FREQUENCIES_HZ.length; b++) {
                if (sp.contains("ui_band_" + b)) {
                    uiBandLevels.put(b, (short) sp.getInt("ui_band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }
}
