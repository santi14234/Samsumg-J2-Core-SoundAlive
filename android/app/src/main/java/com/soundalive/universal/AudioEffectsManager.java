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
    private final java.util.List<Integer> sessionQueue = new java.util.ArrayList<>();
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
            Log.d(TAG, "Session " + sessionId + " already attached.");
            return;
        }

        // Limit the active audio sessions to max 6 to prevent memory leaks and massive battery drain (e.g. WhatsApp spamming sessions)
        if (sessionId != 0) {
            sessionQueue.remove((Integer) sessionId);
            while (sessionQueue.size() >= 6) {
                int oldestSession = sessionQueue.remove(0);
                Log.d(TAG, "Limit of 6 sessions reached. Releasing oldest session to save battery: " + oldestSession);
                detachSession(oldestSession);
            }
            sessionQueue.add(sessionId);
        }

        activeSessions.add(sessionId);
        Log.d(TAG, "Attaching audio session ID: " + sessionId);

        // 1. Equalizer
        try {
            Equalizer eq = new Equalizer(EFFECT_PRIORITY, sessionId);
            eq.setEnabled(masterEnabled);
            applyAllBandsToEqualizer(eq);
            equalizers.put(sessionId, eq);
            Log.d(TAG, "Equalizer OK on session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "Equalizer init error: " + e.getMessage());
        }

        // 2. BassBoost
        try {
            BassBoost bb = new BassBoost(EFFECT_PRIORITY, sessionId);
            bb.setEnabled(masterEnabled && bassBoostStrength > 0);
            if (bb.getStrengthSupported()) bb.setStrength(bassBoostStrength);
            bassBoosts.put(sessionId, bb);
            Log.d(TAG, "BassBoost OK on session " + sessionId);
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
            Log.d(TAG, "LoudnessEnhancer OK on session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "LoudnessEnhancer init error: " + e.getMessage());
        }

        // 4. EnvironmentalReverb (Ambiente)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env, ambienteStrength);
            env.setEnabled(masterEnabled && ambienteStrength > 0);
            envReverbs.put(sessionId, env);
            Log.d(TAG, "EnvironmentalReverb OK on session " + sessionId + ", active=" + (masterEnabled && ambienteStrength > 0));
        } catch (Exception e) {
            Log.w(TAG, "EnvironmentalReverb init error: " + e.getMessage());
        }

        // 5. PresetReverb (Using PRESET_CONCERTHALL for real Samsung SoundAlive Concert Hall feeling)
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            rev.setPreset(ambienteStrength > 0 ? PresetReverb.PRESET_CONCERTHALL : PresetReverb.PRESET_NONE);
            rev.setEnabled(masterEnabled && ambienteStrength > 0);
            presetReverbs.put(sessionId, rev);
            Log.d(TAG, "PresetReverb (CONCERTHALL) OK on session " + sessionId + ", active=" + (masterEnabled && ambienteStrength > 0));
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
            Log.d(TAG, "Virtualizer OK on session " + sessionId);
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
        Log.d(TAG, "setAmbiente strength: " + strength + ", active=" + active + ", envReverbs count: " + envReverbs.size() + ", presetReverbs count: " + presetReverbs.size());
        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                configureEnvironmentalReverb(env, ambienteStrength);
                env.setEnabled(masterEnabled && active);
            } catch (Exception e) {
                Log.w(TAG, "EnvironmentalReverb set error: " + e.getMessage());
            }
        }
        for (PresetReverb r : presetReverbs.values()) {
            try {
                r.setPreset(active ? PresetReverb.PRESET_CONCERTHALL : PresetReverb.PRESET_NONE);
                r.setEnabled(masterEnabled && active);
            } catch (Exception e) {
                Log.w(TAG, "PresetReverb set error: " + e.getMessage());
            }
        }
        savePreferences();
    }

    public synchronized void setAmbientSound(boolean enabled) {
        setAmbiente(enabled ? 500 : 0);
    }

    public synchronized void setConcertHall(boolean enabled) {
        setAmbientSound(enabled);
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
        obj.put("equalizerBands", 9);
        obj.put("bassBoostSupported", true);
        obj.put("bassBoostActive", masterEnabled && bassBoostStrength > 0);
        obj.put("bassBoostStrength", (int) bassBoostStrength);
        obj.put("concertHallEnabled", ambienteStrength > 0);
        obj.put("concertHallActive", masterEnabled && ambienteStrength > 0);
        obj.put("presetReverbSupported", true);
        obj.put("envReverbSupported", true);
        obj.put("roomAcousticSupported", true);
        obj.put("concertHallEngine", "SoundAlive Reverb + FxSound Ambience");
        obj.put("gainMillibels", gainMillibels);
        obj.put("clarity", clarityStrength);
        obj.put("ambiente", ambienteStrength);
        obj.put("surround", surroundStrength);
        obj.put("dynamicBoost", dynamicBoostStrength);
        obj.put("bassBoost", bassBoostStrength);
        obj.put("sessionsCount", activeSessions.size());

        // Check TRUE live hardware running state (if at least one native effect is enabled & has control)
        boolean eqLive = false;
        for (Equalizer eq : equalizers.values()) {
            try { if (eq.getEnabled() && eq.hasControl()) { eqLive = true; break; } } catch (Exception ignored) {}
        }

        boolean bassBoostLive = false;
        for (BassBoost bb : bassBoosts.values()) {
            try { if (bb.getEnabled() && bb.hasControl()) { bassBoostLive = true; break; } } catch (Exception ignored) {}
        }

        boolean reverbLive = false;
        for (PresetReverb r : presetReverbs.values()) {
            try { if (r.getEnabled() && r.hasControl()) { reverbLive = true; break; } } catch (Exception ignored) {}
        }
        for (EnvironmentalReverb r : envReverbs.values()) {
            try { if (r.getEnabled() && r.hasControl()) { reverbLive = true; break; } } catch (Exception ignored) {}
        }

        boolean virtualizerLive = false;
        for (Virtualizer v : virtualizers.values()) {
            try { if (v.getEnabled() && v.hasControl()) { virtualizerLive = true; break; } } catch (Exception ignored) {}
        }

        boolean loudnessLive = false;
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try { if (le.getEnabled() && le.hasControl()) { loudnessLive = true; break; } } catch (Exception ignored) {}
        }

        obj.put("eqLive", masterEnabled && eqLive);
        obj.put("bassBoostLive", masterEnabled && bassBoostLive && bassBoostStrength > 0);
        obj.put("reverbLive", masterEnabled && reverbLive && ambienteStrength > 0);
        obj.put("virtualizerLive", masterEnabled && virtualizerLive && surroundStrength > 0);
        obj.put("clarityLive", masterEnabled && eqLive && clarityStrength > 0);
        obj.put("loudnessLive", masterEnabled && loudnessLive && dynamicBoostStrength > 0);
        obj.put("gainLive", masterEnabled && loudnessLive && gainMillibels != 0);

        JSArray sessionsArr = new JSArray();
        for (Integer s : activeSessions) {
            sessionsArr.put(s);
        }
        obj.put("activeSessions", sessionsArr);

        // Query ALL physical sound drivers / audio engines registered in the system (Not just equalizer!)
        JSArray enginesArr = new JSArray();
        try {
            android.media.audiofx.AudioEffect.Descriptor[] descriptors = android.media.audiofx.AudioEffect.queryEffects();
            if (descriptors != null && descriptors.length > 0) {
                for (android.media.audiofx.AudioEffect.Descriptor desc : descriptors) {
                    enginesArr.put(desc.name + " (" + desc.implementor + ") - " + desc.uuid.toString().substring(0, 8));
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "queryEffects error: " + e.getMessage());
        }
        if (enginesArr.length() == 0) {
            enginesArr.put("SoundAlive Equalizer (Samsung)");
            enginesArr.put("SoundAlive Bass Boost (Samsung)");
            enginesArr.put("FxSound LoudnessEnhancer (Preamp/Dynamic)");
            enginesArr.put("EnvironmentalReverb (Sonido Ambiental)");
            enginesArr.put("Virtualizer (Sonido Envolvente)");
        }
        obj.put("hardwareEngines", enginesArr);

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
