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
    private static final int EFFECT_PRIORITY = 2147483647; // Maximum possible priority for system domination
    private static AudioEffectsManager instance;

    // Frequencies of the UI bands (63Hz to 16kHz)
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
    private int gainMillibels = 0; // Preamp gain boost (-500 to +1500 mB)

    // Dual Samsung Dials values (-100 to +100)
    private int dialBassTreble = 0;
    private int dialVocalInstrument = 0;
    private boolean isBasicMode = true;

    // Sonido Ambiental (Subtle, pleasant Room Reverb - original SoundAlive style)
    private boolean ambientSoundEnabled = false;

    // Stores the 9 UI band levels (-1000 to +1000 mB)
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

            // 1. Attach to session 0 (Global audio output mix) immediately
            attachSession(0);

            // 2. Android 8.0+ System-wide Playback Interceptor & Session Tracker:
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
                                            if (sessionId > 0) {
                                                attachSession(sessionId);
                                            }
                                        }
                                    } catch (Exception ignored) {}
                                }
                                ensureSession0Alive();
                            }
                        }, new Handler(Looper.getMainLooper()));
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not register AudioPlaybackCallback: " + e.getMessage());
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

        // 1. Equalizer with MAXIMUM PRIORITY
        try {
            Equalizer eq = new Equalizer(EFFECT_PRIORITY, sessionId);
            eq.setEnabled(masterEnabled);
            applyAllBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
            Log.d(TAG, "Equalizer attached to session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Equalizer on session " + sessionId + ": " + e.getMessage());
        }

        // 2. Hardware Bass Boost
        try {
            BassBoost bb = new BassBoost(EFFECT_PRIORITY, sessionId);
            bb.setEnabled(masterEnabled && bassBoostStrength > 0);
            if (bb.getStrengthSupported()) {
                bb.setStrength(bassBoostStrength);
            }
            bassBoosts.put(sessionId, bb);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init BassBoost on session " + sessionId + ": " + e.getMessage());
        }

        // 3. LoudnessEnhancer (Preamp Gain Booster - FxSound style)
        try {
            LoudnessEnhancer le = new LoudnessEnhancer(sessionId);
            le.setTargetGain(gainMillibels);
            le.setEnabled(masterEnabled && gainMillibels != 0);
            loudnessEnhancers.put(sessionId, le);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init LoudnessEnhancer on session " + sessionId + ": " + e.getMessage());
        }

        // 4. EnvironmentalReverb (Sonido Ambiental)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env);
            env.setEnabled(masterEnabled && ambientSoundEnabled);
            envReverbs.put(sessionId, env);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init EnvironmentalReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 5. PresetReverb
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            if (ambientSoundEnabled) {
                rev.setPreset(PresetReverb.PRESET_MEDIUMROOM);
            } else {
                rev.setPreset(PresetReverb.PRESET_NONE);
            }
            rev.setEnabled(masterEnabled && ambientSoundEnabled);
            presetReverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init PresetReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 6. Virtualizer (Surround Sound Widener)
        try {
            Virtualizer virt = new Virtualizer(EFFECT_PRIORITY, sessionId);
            if (virt.getStrengthSupported()) {
                virt.setStrength((short) 500); // 50% surround enhancement
            }
            virt.setEnabled(masterEnabled && ambientSoundEnabled);
            virtualizers.put(sessionId, virt);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Virtualizer on session " + sessionId + ": " + e.getMessage());
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
        for (Equalizer eq : equalizers.values()) {
            try { eq.setEnabled(enabled); } catch (Exception ignored) {}
        }
        for (BassBoost bb : bassBoosts.values()) {
            try { bb.setEnabled(enabled && bassBoostStrength > 0); } catch (Exception ignored) {}
        }
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try { le.setEnabled(enabled && gainMillibels != 0); } catch (Exception ignored) {}
        }
        for (EnvironmentalReverb env : envReverbs.values()) {
            try { env.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
        }
        for (PresetReverb r : presetReverbs.values()) {
            try { r.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
        }
        for (Virtualizer v : virtualizers.values()) {
            try { v.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
        }
        savePreferences();
    }

    public synchronized void setSamsungDials(int bassTreble, int vocalInstrument) {
        this.isBasicMode = true;
        this.dialBassTreble = Math.max(-100, Math.min(100, bassTreble));
        this.dialVocalInstrument = Math.max(-100, Math.min(100, vocalInstrument));

        double btNorm = this.dialBassTreble / 100.0;
        double viNorm = this.dialVocalInstrument / 100.0;

        short bassLevel = (short) Math.round(-btNorm * 800);
        short trebleLevel = (short) Math.round(btNorm * 800);
        short vocalLevel = (short) Math.round(viNorm * 800);
        short instLevel = (short) Math.round(-viNorm * 600);

        uiBandLevels.put((short) 0, (short) (bassLevel + instLevel));       // 63Hz
        uiBandLevels.put((short) 1, (short) (bassLevel * 0.8 + instLevel * 0.5)); // 125Hz
        uiBandLevels.put((short) 2, (short) (bassLevel * 0.4));             // 250Hz
        uiBandLevels.put((short) 3, (short) (vocalLevel * 0.5));            // 500Hz
        uiBandLevels.put((short) 4, (short) (vocalLevel));                  // 1kHz
        uiBandLevels.put((short) 5, (short) (vocalLevel * 0.7));            // 2kHz
        uiBandLevels.put((short) 6, (short) (trebleLevel * 0.4));           // 4kHz
        uiBandLevels.put((short) 7, (short) (trebleLevel * 0.8 + instLevel * 0.5)); // 8kHz
        uiBandLevels.put((short) 8, (short) (trebleLevel + instLevel));     // 16kHz

        if (btNorm < 0) {
            this.bassBoostStrength = (short) Math.round(-btNorm * 900);
        } else {
            this.bassBoostStrength = 0;
        }
        for (BassBoost bb : bassBoosts.values()) {
            try {
                bb.setEnabled(masterEnabled && bassBoostStrength > 0);
                if (bb.getStrengthSupported()) {
                    bb.setStrength(bassBoostStrength);
                }
            } catch (Exception ignored) {}
        }

        for (Equalizer eq : equalizers.values()) {
            applyAllBandsToEqualizer(eq);
        }
        savePreferences();
    }

    public synchronized void setBandLevel(short uiBandIndex, short level) {
        this.isBasicMode = false;
        if (uiBandIndex < 0 || uiBandIndex >= UI_FREQUENCIES_HZ.length) return;
        uiBandLevels.put(uiBandIndex, level);

        for (Equalizer eq : equalizers.values()) {
            applyAllBandsToEqualizer(eq);
        }
        savePreferences();
    }

    public synchronized void setBassBoostStrength(short strength) {
        this.bassBoostStrength = strength;
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

    public synchronized void setGain(int millibels) {
        this.gainMillibels = Math.max(-500, Math.min(1500, millibels)); // -5dB to +15dB boost
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try {
                le.setTargetGain(this.gainMillibels);
                le.setEnabled(masterEnabled && this.gainMillibels != 0);
            } catch (Exception ignored) {}
        }
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
        } catch (Exception e) {
            Log.w(TAG, "Error applying bands: " + e.getMessage());
        }
    }

    public synchronized void setAmbientSound(boolean enabled) {
        this.ambientSoundEnabled = enabled;

        for (PresetReverb r : presetReverbs.values()) {
            try {
                if (ambientSoundEnabled) {
                    r.setPreset(PresetReverb.PRESET_MEDIUMROOM);
                    r.setEnabled(masterEnabled);
                } else {
                    r.setEnabled(false);
                    r.setPreset(PresetReverb.PRESET_NONE);
                }
            } catch (Exception ignored) {}
        }

        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                if (ambientSoundEnabled) {
                    configureEnvironmentalReverb(env);
                    env.setEnabled(masterEnabled);
                } else {
                    env.setEnabled(false);
                }
            } catch (Exception ignored) {}
        }

        for (Virtualizer v : virtualizers.values()) {
            try {
                v.setEnabled(masterEnabled && ambientSoundEnabled);
            } catch (Exception ignored) {}
        }

        // Instant refresh trick
        for (Equalizer eq : equalizers.values()) {
            try {
                eq.setEnabled(false);
                eq.setEnabled(masterEnabled);
            } catch (Exception ignored) {}
        }

        savePreferences();
    }

    public synchronized void setConcertHall(boolean enabled) {
        setAmbientSound(enabled);
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env) {
        if (env == null) return;
        try {
            env.setRoomLevel((short) -700);
            env.setRoomHFLevel((short) -500);
            env.setReflectionsLevel((short) -1000);
            env.setReverbLevel((short) -500);
            env.setDecayTime(1800);
            env.setDecayHFRatio((short) 800);
        } catch (Exception ignored) {}
    }

    public synchronized JSObject getStatus() {
        JSObject obj = new JSObject();
        obj.put("masterEnabled", masterEnabled);
        obj.put("equalizerActive", masterEnabled && !equalizers.isEmpty());
        obj.put("gainMillibels", gainMillibels);
        obj.put("ambientSoundEnabled", ambientSoundEnabled);
        obj.put("concertHallEnabled", ambientSoundEnabled);
        obj.put("sessionsCount", activeSessions.size());
        return obj;
    }

    private void savePreferences() {
        if (appContext == null) return;
        try {
            SharedPreferences sp = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean("masterEnabled", masterEnabled);
            ed.putBoolean("ambientSound", ambientSoundEnabled);
            ed.putInt("gainMillibels", gainMillibels);
            ed.putBoolean("isBasicMode", isBasicMode);
            ed.putInt("dialBassTreble", dialBassTreble);
            ed.putInt("dialVocalInstrument", dialVocalInstrument);
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
            ambientSoundEnabled = sp.getBoolean("ambientSound", false);
            gainMillibels = sp.getInt("gainMillibels", 0);
            isBasicMode = sp.getBoolean("isBasicMode", true);
            dialBassTreble = sp.getInt("dialBassTreble", 0);
            dialVocalInstrument = sp.getInt("dialVocalInstrument", 0);

            for (short b = 0; b < UI_FREQUENCIES_HZ.length; b++) {
                if (sp.contains("ui_band_" + b)) {
                    uiBandLevels.put(b, (short) sp.getInt("ui_band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }
}
