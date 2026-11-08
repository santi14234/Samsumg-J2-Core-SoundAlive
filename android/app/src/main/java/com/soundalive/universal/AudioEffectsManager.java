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
    private final Set<Integer> knownSessions = new HashSet<>(); // sesiones anunciadas por reproductores (modo no-global)

    private boolean masterEnabled = true;
    private short bassBoostStrength = 0; // 0 - 1000
    private int gainMillibels = 0; // -500 to +1200 mB
    private int clarityStrength = 0; // 0 - 1000 (Treble boost)
    private int ambienteStrength = 0; // 0 - 1000 (Reverb amount)
    private int surroundStrength = 0; // 0 - 1000 (Surround 3D = ganancia extra del Reverb, ya NO usa Virtualizer)
    private int roomType = 1; // 1..5 (Estudio, Habitacion, Estudio Pro, Auditorio, Catedral)
    private boolean globalOnly = true; // true = solo sesion 0 (Global Output, como Eqfy)
    private int limiterStrength = 0; // 0 - 1000 (Limitador: reserva de margen contra saturacion)

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
            if (globalOnly) attachSession(0);

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
        if (sessionId != 0) knownSessions.add(sessionId);
        // Modo "Global Output (only)": solo se procesa la mezcla global (sesion 0)
        if (globalOnly && sessionId != 0) return;
        if (!globalOnly && sessionId == 0) return;

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

        if (sessionId != 0) {
            sessionQueue.remove((Integer) sessionId);
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
            int totalGain = computeTotalGain();
            le.setTargetGain(totalGain);
            le.setEnabled(masterEnabled && totalGain != 0);
            loudnessEnhancers.put(sessionId, le);
            Log.d(TAG, "LoudnessEnhancer OK on session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "LoudnessEnhancer init error: " + e.getMessage());
        }

        // 4. EnvironmentalReverb (Ambiente + Surround 3D = ganancia del reverb)
        boolean envOk = false;
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env);
            env.setEnabled(masterEnabled && isReverbActive());
            envReverbs.put(sessionId, env);
            envOk = true;
            Log.d(TAG, "EnvironmentalReverb OK on session " + sessionId);
        } catch (Exception e) {
            Log.w(TAG, "EnvironmentalReverb init error: " + e.getMessage());
        }

        // 5. PresetReverb: solo de respaldo si el equipo no ofrece EnvironmentalReverb
        if (!envOk) {
            try {
                PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
                rev.setPreset(isReverbActive() ? presetForRoom() : PresetReverb.PRESET_NONE);
                rev.setEnabled(masterEnabled && isReverbActive());
                presetReverbs.put(sessionId, rev);
                Log.d(TAG, "PresetReverb (respaldo) OK on session " + sessionId);
            } catch (Exception e) {
                Log.w(TAG, "PresetReverb init error: " + e.getMessage());
            }
        }
    }

    public synchronized void detachSession(int sessionId) {
        if (sessionId != 0) knownSessions.remove(sessionId);
        if (sessionId == 0 && globalOnly) return; // la sesion global no se suelta mientras el modo Global este activo
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

    }

    public synchronized void ensureSession0Alive() {
        if (!masterEnabled || !globalOnly) return;
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
        for (LoudnessEnhancer le : loudnessEnhancers.values()) { try { le.setEnabled(enabled && computeTotalGain() != 0); } catch (Exception ignored) {} }
        for (EnvironmentalReverb env : envReverbs.values()) { try { env.setEnabled(enabled && isReverbActive()); } catch (Exception ignored) {} }
        for (PresetReverb r : presetReverbs.values()) { try { r.setEnabled(enabled && isReverbActive()); } catch (Exception ignored) {} }
        savePreferences();
    }

    public synchronized void setGain(int millibels) {
        this.gainMillibels = Math.max(-500, Math.min(1500, millibels));
        refreshGain();
        savePreferences();
    }

    /** Ganancia final = volumen maestro menos el margen que reserva el limitador segun el realce del EQ. */
    private int computeTotalGain() {
        int maxBoost = 0;
        for (int i = 0; i < UI_FREQUENCIES_HZ.length; i++) {
            maxBoost = Math.max(maxBoost, getUiVal(i));
        }
        int headroom = (int) Math.round((limiterStrength / 1000.0) * maxBoost);
        return gainMillibels - headroom;
    }

    private void refreshGain() {
        int totalGain = computeTotalGain();
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try {
                le.setTargetGain(totalGain);
                le.setEnabled(masterEnabled && totalGain != 0);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void setClarity(int strength) {
        this.clarityStrength = Math.max(0, Math.min(1000, strength));
        // La claridad realza 8k/16k como desplazamiento aparte (ver getUiVal), sin tocar los sliders del usuario
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        refreshGain();
        savePreferences();
    }

    public synchronized void setAmbiente(int strength) {
        this.ambienteStrength = Math.max(0, Math.min(1000, strength));
        applyReverb();
        savePreferences();
    }

    public synchronized void setRoomType(int type) {
        this.roomType = Math.max(1, Math.min(5, type));
        applyReverb();
        savePreferences();
    }

    /** Reverb activo si hay mezcla de sala o Surround 3D (que amplifica la ganancia del reverb). */
    private boolean isReverbActive() {
        return ambienteStrength > 0 || surroundStrength > 0;
    }

    private short presetForRoom() {
        switch (roomType) {
            case 1: return PresetReverb.PRESET_SMALLROOM;
            case 2: return PresetReverb.PRESET_MEDIUMROOM;
            case 3: return PresetReverb.PRESET_LARGEROOM;
            case 4: return PresetReverb.PRESET_MEDIUMHALL;
            default: return PresetReverb.PRESET_LARGEHALL;
        }
    }

    private void applyReverb() {
        boolean active = isReverbActive();
        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                configureEnvironmentalReverb(env);
                env.setEnabled(masterEnabled && active);
            } catch (Exception e) {
                Log.w(TAG, "EnvironmentalReverb set error: " + e.getMessage());
            }
        }
        for (PresetReverb r : presetReverbs.values()) {
            try {
                r.setPreset(active ? presetForRoom() : PresetReverb.PRESET_NONE);
                r.setEnabled(masterEnabled && active);
            } catch (Exception e) {
                Log.w(TAG, "PresetReverb set error: " + e.getMessage());
            }
        }
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

    /** Surround 3D: amplifica la ganancia del Reverb (sin Virtualizer). */
    public synchronized void setSurround(int strength) {
        this.surroundStrength = Math.max(0, Math.min(1000, strength));
        applyReverb();
        savePreferences();
    }

    public synchronized void setLimiter(int strength) {
        this.limiterStrength = Math.max(0, Math.min(1000, strength));
        refreshGain();
        savePreferences();
    }

    /** Global Output (only): true = solo sesion 0 (todas las apps); false = solo sesiones de reproductores. */
    public synchronized void setGlobalOutputOnly(boolean enabled) {
        if (this.globalOnly == enabled) return;
        this.globalOnly = enabled;
        if (enabled) {
            for (Integer id : new java.util.ArrayList<>(activeSessions)) {
                if (id != 0) detachSession(id);
            }
            sessionQueue.clear();
            attachSession(0);
        } else {
            detachSession(0);
            for (Integer id : new java.util.ArrayList<>(knownSessions)) {
                attachSession(id);
            }
        }
        savePreferences();
    }

    public synchronized boolean isGlobalOutputOnly() {
        return globalOnly;
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
        refreshGain();
        savePreferences();
    }

    private short getUiVal(int index) {
        Short val = uiBandLevels.get((short) index);
        int v = (val != null) ? val : 0;
        if (index == 7) v += (int) Math.round((clarityStrength / 1000.0) * 800);
        if (index == 8) v += (int) Math.round((clarityStrength / 1000.0) * 960);
        return (short) Math.max(-32768, Math.min(32767, v));
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

    private int clampMb(double v, int min, int max) {
        return (int) Math.max(min, Math.min(max, Math.round(v)));
    }

    /**
     * Mix (slider "Nivel de Ganancia") fija el nivel base del reverb.
     * Surround 3D suma ganancia extra al reverb: hasta +10 dB en la sala y +15 dB en la cola.
     * Rangos validos de Android (mB): room -9000..0 | reflexiones -9000..1000 | reverb -9000..2000
     */
    private void configureEnvironmentalReverb(EnvironmentalReverb env) {
        if (env == null) return;
        try {
            double mix = ambienteStrength / 1000.0;
            double amp = surroundStrength / 1000.0;
            int[] decay = {800, 1100, 1500, 2400, 4500};   // ms segun la sala elegida
            int[] delay = {5, 8, 12, 20, 40};              // ms de retardo del reverb
            int r = Math.max(1, Math.min(5, roomType)) - 1;

            env.setRoomLevel((short) clampMb(-1500 + mix * 1500 + amp * 1000, -9000, 0));
            env.setRoomHFLevel((short) -300);
            env.setReflectionsLevel((short) clampMb(-1000 + mix * 1000 + amp * 800, -9000, 1000));
            env.setReverbLevel((short) clampMb(-600 + mix * 1800 + amp * 1500, -9000, 2000));
            env.setDecayTime(decay[r]);
            env.setDecayHFRatio((short) 800);
            env.setReverbDelay((short) delay[r]);
            env.setDiffusion((short) 1000);
            env.setDensity((short) 1000);
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
        obj.put("concertHallEnabled", isReverbActive());
        obj.put("concertHallActive", masterEnabled && isReverbActive());
        obj.put("presetReverbSupported", true);
        obj.put("envReverbSupported", true);
        obj.put("roomAcousticSupported", true);
        obj.put("concertHallEngine", "SoundAlive Reverb + FxSound Ambience");
        obj.put("gainMillibels", gainMillibels);
        obj.put("clarity", clarityStrength);
        obj.put("ambiente", ambienteStrength);
        obj.put("surround", surroundStrength);
        obj.put("limiter", limiterStrength);
        obj.put("roomType", roomType);
        obj.put("globalOnly", globalOnly);
        Equalizer globalEq = equalizers.get(0);
        boolean globalActive = false;
        try { globalActive = globalEq != null && globalEq.hasControl() && globalEq.getEnabled(); } catch (Exception ignored) {}
        obj.put("globalActive", globalActive);
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

        boolean loudnessLive = false;
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try { if (le.getEnabled() && le.hasControl()) { loudnessLive = true; break; } } catch (Exception ignored) {}
        }

        // Check if effects have active audio changes applied to the system
        boolean eqModified = false;
        for (short lvl : uiBandLevels.values()) {
            if (lvl != 0) {
                eqModified = true;
                break;
            }
        }
        if (dialBassTreble != 0 || dialVocalInstrument != 0) {
            eqModified = true;
        }

        boolean bassBoostModified = (bassBoostStrength > 0);
        boolean reverbModified = isReverbActive();
        boolean virtualizerModified = (surroundStrength > 0 && isReverbActive());
        boolean clarityModified = (clarityStrength > 0);
        boolean loudnessModified = (limiterStrength > 0);
        boolean gainModified = (gainMillibels != 0);

        boolean audioModifiedInSystem = masterEnabled && (eqModified || bassBoostModified || reverbModified || virtualizerModified || clarityModified || loudnessModified || gainModified);

        obj.put("audioModifiedInSystem", audioModifiedInSystem);
        obj.put("eqLive", masterEnabled && eqModified);
        obj.put("bassBoostLive", masterEnabled && bassBoostModified);
        obj.put("reverbLive", masterEnabled && reverbModified);
        obj.put("virtualizerLive", masterEnabled && virtualizerModified);
        obj.put("clarityLive", masterEnabled && clarityModified);
        obj.put("loudnessLive", masterEnabled && loudnessModified);
        obj.put("gainLive", masterEnabled && gainModified);

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
            ed.putInt("limiter", limiterStrength);
            ed.putInt("roomType", roomType);
            ed.putBoolean("globalOnly", globalOnly);
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
            limiterStrength = sp.getInt("limiter", 0);
            roomType = sp.getInt("roomType", 1);
            globalOnly = sp.getBoolean("globalOnly", true);
            bassBoostStrength = (short) sp.getInt("bassBoost", 0);

            for (short b = 0; b < UI_FREQUENCIES_HZ.length; b++) {
                if (sp.contains("ui_band_" + b)) {
                    uiBandLevels.put(b, (short) sp.getInt("ui_band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }
}
