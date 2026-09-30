package com.soundalive.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.EnvironmentalReverb;
import android.media.audiofx.PresetReverb;
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
    private static final int EFFECT_PRIORITY = 1000; // High priority
    private static AudioEffectsManager instance;

    // Frequencies of the UI bands (63Hz to 16kHz)
    public static final int[] UI_FREQUENCIES_HZ = {63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};

    private final Set<Integer> activeSessions = new HashSet<>();
    private final Map<Integer, Equalizer> equalizers = new HashMap<>();
    private final Map<Integer, BassBoost> bassBoosts = new HashMap<>();
    private final Map<Integer, PresetReverb> presetReverbs = new HashMap<>();
    private final Map<Integer, EnvironmentalReverb> envReverbs = new HashMap<>();
    private final Map<Integer, AudioEffect> customInsertReverbs = new HashMap<>();

    private boolean masterEnabled = true;
    private short bassBoostStrength = 0; // 0 - 1000

    // Dual Samsung Dials values (-100 to +100)
    private int dialBassTreble = 0;
    private int dialVocalInstrument = 0;
    private boolean isBasicMode = true;

    // Sonido Ambiental (Pure Reverb / FxSound Ambience - NO VIRTUALIZERS)
    private boolean ambientSoundEnabled = false;

    // Stores the 9 UI band levels (-1000 to +1000 mB)
    private final Map<Short, Short> uiBandLevels = new HashMap<>();

    private Context appContext;

    // Discovered NXP hardware insert reverb descriptor
    private AudioEffect.Descriptor nxpInsertReverbDesc = null;

    private AudioEffectsManager() {
        for (short i = 0; i < UI_FREQUENCIES_HZ.length; i++) {
            uiBandLevels.put(i, (short) 0);
        }
        findNxpInsertReverb();
    }

    private void findNxpInsertReverb() {
        try {
            AudioEffect.Descriptor[] descs = AudioEffect.queryEffects();
            if (descs != null) {
                for (AudioEffect.Descriptor d : descs) {
                    if (d != null && d.name != null) {
                        String nameLow = d.name.toLowerCase();
                        if (nameLow.contains("insert") && nameLow.contains("reverb")) {
                            nxpInsertReverbDesc = d;
                            Log.d(TAG, "Found NXP hardware Insert Reverb: " + d.name + " (" + d.uuid + ")");
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error querying audio effect descriptors: " + e.getMessage());
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

            // 1. Attach to session 0 (Global audio output mix)
            attachSession(0);

            // 2. Android 8.0+ System-wide Playback Interceptor:
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

        // 1. Equalizer with HIGH PRIORITY (1000)
        try {
            Equalizer eq = new Equalizer(EFFECT_PRIORITY, sessionId);
            eq.setEnabled(masterEnabled);
            applyAllBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
            Log.d(TAG, "Equalizer attached to session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init Equalizer on session " + sessionId + ": " + e.getMessage());
        }

        // 2. Hardware Bass Boost with HIGH PRIORITY (1000)
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

        // 3. EnvironmentalReverb (Pure Ambient Sound / Sonido Ambiental)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            if (ambientSoundEnabled) {
                configureEnvironmentalReverb(env);
            }
            env.setEnabled(masterEnabled && ambientSoundEnabled);
            envReverbs.put(sessionId, env);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init EnvironmentalReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 4. PresetReverb (configured BEFORE enabling)
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            if (ambientSoundEnabled) {
                rev.setPreset(PresetReverb.PRESET_LARGEHALL);
            } else {
                rev.setPreset(PresetReverb.PRESET_NONE);
            }
            rev.setEnabled(masterEnabled && ambientSoundEnabled);
            presetReverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init PresetReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 5. NXP Hardware Insert Reverb (if present on device)
        if (nxpInsertReverbDesc != null) {
            try {
                AudioEffect customRev = new AudioEffect(nxpInsertReverbDesc.type, nxpInsertReverbDesc.uuid, EFFECT_PRIORITY, sessionId);
                customRev.setEnabled(masterEnabled && ambientSoundEnabled);
                customInsertReverbs.put(sessionId, customRev);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void detachSession(int sessionId) {
        if (sessionId == 0) return;
        activeSessions.remove(sessionId);

        Equalizer eq = equalizers.remove(sessionId);
        if (eq != null) { try { eq.release(); } catch (Exception ignored) {} }

        BassBoost bb = bassBoosts.remove(sessionId);
        if (bb != null) { try { bb.release(); } catch (Exception ignored) {} }

        EnvironmentalReverb env = envReverbs.remove(sessionId);
        if (env != null) { try { env.release(); } catch (Exception ignored) {} }

        PresetReverb r = presetReverbs.remove(sessionId);
        if (r != null) { try { r.release(); } catch (Exception ignored) {} }

        AudioEffect c = customInsertReverbs.remove(sessionId);
        if (c != null) { try { c.release(); } catch (Exception ignored) {} }
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
        for (EnvironmentalReverb env : envReverbs.values()) {
            try { env.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
        }
        for (PresetReverb r : presetReverbs.values()) {
            try { r.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
        }
        for (AudioEffect c : customInsertReverbs.values()) {
            try { c.setEnabled(enabled && ambientSoundEnabled); } catch (Exception ignored) {}
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

    private short getUiVal(int index) {
        Short val = uiBandLevels.get((short) index);
        return (val != null) ? val : 0;
    }

    private short clamp(short val, short min, short max) {
        return (short) Math.max(min, Math.min(max, val));
    }

    /**
     * Direct 5-band physical hardware mapping for Samsung Galaxy J2 Core
     */
    private void applyAllBandsToEqualizer(Equalizer eq) {
        if (eq == null) return;
        try {
            short numPhysicalBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange();
            short minLvl = range[0];
            short maxLvl = range[1];

            if (numPhysicalBands == 5) {
                // Band 0: ~60 Hz (Deep Sub-Bass) -> UI 63Hz & 125Hz
                short b0 = (short) Math.round((getUiVal(0) * 0.6) + (getUiVal(1) * 0.4));
                eq.setBandLevel((short) 0, clamp(b0, minLvl, maxLvl));

                // Band 1: ~230 Hz (Punch / Low-Mids) -> UI 250Hz
                short b1 = getUiVal(2);
                eq.setBandLevel((short) 1, clamp(b1, minLvl, maxLvl));

                // Band 2: ~910 Hz (Vocals / Body) -> UI 500Hz & 1kHz
                short b2 = (short) Math.round((getUiVal(3) * 0.5) + (getUiVal(4) * 0.5));
                eq.setBandLevel((short) 2, clamp(b2, minLvl, maxLvl));

                // Band 3: ~3.6 kHz (Presence / Clarity) -> UI 2kHz & 4kHz
                short b3 = (short) Math.round((getUiVal(5) * 0.5) + (getUiVal(6) * 0.5));
                eq.setBandLevel((short) 3, clamp(b3, minLvl, maxLvl));

                // Band 4: ~14 kHz (Air / Brilliance) -> UI 8kHz & 16kHz
                short b4 = (short) Math.round((getUiVal(7) * 0.4) + (getUiVal(8) * 0.6));
                eq.setBandLevel((short) 4, clamp(b4, minLvl, maxLvl));

                Log.d(TAG, String.format("Mapped 5 bands: [%d, %d, %d, %d, %d]", b0, b1, b2, b3, b4));
            } else {
                for (short b = 0; b < numPhysicalBands && b < UI_FREQUENCIES_HZ.length; b++) {
                    short lvl = getUiVal(b);
                    eq.setBandLevel(b, clamp(lvl, minLvl, maxLvl));
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error applying bands to equalizer: " + e.getMessage());
        }
    }

    /**
     * Sonido Ambiental (Pure Reverb / FxSound Ambience - Zero Virtualizer)
     */
    public synchronized void setAmbientSound(boolean enabled) {
        this.ambientSoundEnabled = enabled;

        // 1. PresetReverb (setPreset BEFORE setEnabled)
        for (PresetReverb r : presetReverbs.values()) {
            try {
                if (ambientSoundEnabled) {
                    r.setPreset(PresetReverb.PRESET_LARGEHALL);
                    r.setEnabled(masterEnabled);
                } else {
                    r.setEnabled(false);
                    r.setPreset(PresetReverb.PRESET_NONE);
                }
            } catch (Exception ignored) {}
        }

        // 2. EnvironmentalReverb (Warm FxSound Ambience natural room acoustics)
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

        // 3. Custom NXP Insert Reverb
        for (AudioEffect c : customInsertReverbs.values()) {
            try {
                c.setEnabled(masterEnabled && ambientSoundEnabled);
            } catch (Exception ignored) {}
        }

        savePreferences();
    }

    // Alias for compatibility
    public synchronized void setConcertHall(boolean enabled) {
        setAmbientSound(enabled);
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env) {
        if (env == null) return;
        try {
            // Natural, warm room ambiance (like FxSound Ambience)
            env.setRoomLevel((short) 0); // 0 mB (Full room volume)
            env.setRoomHFLevel((short) -300); // Warm natural high-end rolloff
            env.setReflectionsLevel((short) 600); // Smooth early reflections
            env.setReverbLevel((short) 1800); // Lush, warm ambient reverb (+18 dB)
            env.setDecayTime(2600); // 2.6 seconds decay time (warm ambient space)
            env.setDecayHFRatio((short) 850);
        } catch (Exception e) {
            Log.w(TAG, "Error configuring EnvironmentalReverb: " + e.getMessage());
        }
    }

    public synchronized JSObject getStatus() {
        JSObject obj = new JSObject();
        obj.put("masterEnabled", masterEnabled);
        obj.put("equalizerActive", masterEnabled && !equalizers.isEmpty());

        int physicalBands = 5;
        Equalizer eq0 = equalizers.get(0);
        if (eq0 != null) {
            try { physicalBands = eq0.getNumberOfBands(); } catch (Exception ignored) {}
        }
        obj.put("equalizerBands", physicalBands);

        obj.put("bassBoostSupported", !bassBoosts.isEmpty());
        obj.put("bassBoostActive", masterEnabled && bassBoostStrength > 0);
        obj.put("bassBoostStrength", bassBoostStrength);

        boolean reverbActive = ambientSoundEnabled && masterEnabled;
        boolean hasPreset = !presetReverbs.isEmpty();
        boolean hasEnv = !envReverbs.isEmpty();
        boolean hasNxpInsert = !customInsertReverbs.isEmpty();

        obj.put("concertHallEnabled", ambientSoundEnabled);
        obj.put("ambientSoundEnabled", ambientSoundEnabled);
        obj.put("concertHallActive", reverbActive);
        obj.put("presetReverbSupported", hasPreset);
        obj.put("envReverbSupported", hasEnv);
        obj.put("roomAcousticSupported", false); // ZERO virtualizer

        StringBuilder sb = new StringBuilder();
        if (hasEnv) sb.append("EnvironmentalReverb ");
        if (hasPreset) sb.append("+ PresetReverb ");
        if (hasNxpInsert) sb.append("+ NXP Hardware Insert");
        obj.put("concertHallEngine", sb.toString().trim());

        obj.put("sessionsCount", activeSessions.size());
        JSArray sessArray = new JSArray();
        for (Integer s : activeSessions) {
            sessArray.put(s);
        }
        obj.put("activeSessions", sessArray);

        JSArray enginesArray = new JSArray();
        try {
            AudioEffect.Descriptor[] descriptors = AudioEffect.queryEffects();
            if (descriptors != null) {
                for (AudioEffect.Descriptor d : descriptors) {
                    if (d != null && d.name != null) {
                        enginesArray.put(d.name + " (" + d.implementor + ")");
                    }
                }
            }
        } catch (Exception ignored) {}
        obj.put("hardwareEngines", enginesArray);

        return obj;
    }

    private void savePreferences() {
        if (appContext == null) return;
        try {
            SharedPreferences sp = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean("masterEnabled", masterEnabled);
            ed.putBoolean("ambientSound", ambientSoundEnabled);
            ed.putBoolean("concertHall", ambientSoundEnabled);
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
            ambientSoundEnabled = sp.getBoolean("ambientSound", sp.getBoolean("concertHall", false));
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
