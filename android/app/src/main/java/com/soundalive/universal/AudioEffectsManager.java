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
    private int dynamicBoostStrength = 0; // 0 - 1000 (Volumen maestro -> ganancia)
    private int normalizationStrength = 0; // 0 - 1000 (Normalizacion dinamica -> ganancia extra)
    private int roomType = 1; // 1 Estudio, 2 Habitacion, 3 Estadio, 4 Auditorio, 5 Catedral
    // El PresetReverb tiene nivel fijo y hace que el slider Mix no controle nada. Ponlo en true si lo quieres.
    private static final boolean USE_PRESET_REVERB = true;
    // Desde este valor del slider Mix (1100 = 11) se suma un segundo reverb (PresetReverb) para que
    // suene mas fuerte. Pon 2100 para quitarlo.
    private static final int PRESET_REVERB_FROM = 1100;
    // Reverb (milibelios, 100 mB = 1 dB). El slider Mix va de 0 a 20:
    //   0..10  -> de -30 dB hasta REVERB_AT_10_MB   (el +3 dB que te gustaba)
    //   10..20 -> de REVERB_AT_10_MB hasta REVERB_MAX_MB (+20 dB es el maximo que permite Android)
    // Si satura, baja REVERB_MAX_MB.
    // Capa de graves: el slider "Refuerzo de Graves" tambien sube estas bandas (parlantes chicos
    // casi no reproducen 63 Hz, el cuerpo del bajo esta en 125-250 Hz). Multiplicadores sobre +8 dB.
    // Fuerza maxima (slider en 10) de Claridad y Graves, en mB. Bajalos si aun suenan muy fuertes.
    private static final int CLARITY_MAX_MB = 500;
    private static final int BASS_LAYER_MAX_MB = 500;
    // Compensacion de volumen. El Bundle de Android baja el volumen cuando subes bandas (no baja nada
    // hasta +3 dB en graves/medios ni +4 dB en agudos). HEADROOM_COMP es cuanto de esa bajada se
    // devuelve: 0 = nada, 1 = todo. Los efectos no deben subir el volumen por si solos;
    // solo el Volumen Maestro y la Normalizacion amplifican.
    private static final double HEADROOM_COMP = 0.7;
    // VOLUMEN MAESTRO = amplificador (como las apps "Volume Booster"): suma ganancia real aunque el volumen
    // del sistema este al 100%. NORMALIZACION suma un poco mas de nivel. Valores al maximo del slider (mB).
    private static final int MASTER_MAX_MB = 1200;
    private static final int NORMALIZATION_MAX_MB = 400;
    // Peso de cada banda de pantalla (63 Hz ... 16 kHz) en la energia tipica de la musica; sirve para
    // calcular cuanto volumen agregan Claridad y Graves y restarlo (los efectos no deben subir el volumen).
    private static final double[] BAND_ENERGY_W = {0.10, 0.16, 0.18, 0.16, 0.14, 0.11, 0.07, 0.05, 0.03};
    // Nivel extra de cada sala del reverb en mB (100 = 1 dB). Editable tambien desde la app.
    private final int[] roomLevelMb = {0, -300, 200, 100, 400};
    private static final int HEADROOM_OFFSET_LOW_MB = 300;
    private static final int HEADROOM_OFFSET_HIGH_MB = 400;
    // Volumen que SUMA el virtualizador al subirlo al maximo (mB, 100 = 1 dB). 250 = +2,5 dB.
    private static final int SURROUND_GAIN_MB = 250;
    // true = fuerza binaural/transaural segun la salida; false = modo automatico de Android (como las apps de EQ normales)
    private static final boolean FORCE_VIRTUALIZER_MODE = false;
    private static final double BASS_LAYER_63 = 0.3;
    private static final double BASS_LAYER_125 = 1.0;
    private static final double BASS_LAYER_250 = 0.5;
    private static final int REVERB_AT_10_MB = 300;
    private static final int REVERB_MAX_MB = 2000;
    private static final int REFLECTIONS_MAX_MB = 500;

    // Dual Dials
    private int dialBassTreble = 0;
    private int dialVocalInstrument = 0;
    private boolean isBasicMode = true;
    private boolean dialsUsed = false; // true solo si se usaron las perillas basicas (setSamsungDials)

    private final Map<Short, Short> uiBandLevels = new HashMap<>();
    private Context appContext;

    private boolean isAndroidGoDetected = false;
    private boolean hasEqualizerHardware = false;
    private boolean hasBassBoostHardware = false;
    private boolean hasVirtualizerHardware = false;
    private boolean hasReverbHardware = false;
    private boolean hasLoudnessEnhancerHardware = false;
    private String lastAudioFlingerError = null;

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
            hasEqualizerHardware = true;
            Log.d(TAG, "Equalizer OK on session " + sessionId);
        } catch (RuntimeException e) {
            Log.w(TAG, "Equalizer rejected by AudioFlinger (Status -38 or HAL missing): " + e.getMessage());
            lastAudioFlingerError = e.getMessage();
            isAndroidGoDetected = true;
        } catch (Throwable t) {
            Log.w(TAG, "Equalizer init error: " + t.getMessage());
        }

        // 2. BassBoost
        try {
            BassBoost bb = new BassBoost(EFFECT_PRIORITY, sessionId);
            bb.setEnabled(masterEnabled && bassBoostStrength > 0);
            if (bb.getStrengthSupported()) bb.setStrength(bassBoostStrength);
            bassBoosts.put(sessionId, bb);
            hasBassBoostHardware = true;
            Log.d(TAG, "BassBoost OK on session " + sessionId);
        } catch (RuntimeException e) {
            Log.w(TAG, "BassBoost rejected by AudioFlinger: " + e.getMessage());
            lastAudioFlingerError = e.getMessage();
            isAndroidGoDetected = true;
        } catch (Throwable t) {
            Log.w(TAG, "BassBoost init error: " + t.getMessage());
        }

        // 3. LoudnessEnhancer (Gain + Dynamic Boost)
        try {
            LoudnessEnhancer le = new LoudnessEnhancer(sessionId);
            int totalGain = computeLoudnessGain();
            le.setTargetGain(totalGain);
            le.setEnabled(masterEnabled && totalGain != 0);
            loudnessEnhancers.put(sessionId, le);
            hasLoudnessEnhancerHardware = true;
            Log.d(TAG, "LoudnessEnhancer OK on session " + sessionId);
        } catch (RuntimeException e) {
            Log.w(TAG, "LoudnessEnhancer rejected by AudioFlinger: " + e.getMessage());
        } catch (Throwable t) {
            Log.w(TAG, "LoudnessEnhancer init error: " + t.getMessage());
        }

        // 4. EnvironmentalReverb (Ambiente)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env, ambienteStrength);
            env.setEnabled(masterEnabled && ambienteStrength > 0);
            envReverbs.put(sessionId, env);
            hasReverbHardware = true;
            Log.d(TAG, "EnvironmentalReverb OK on session " + sessionId + ", active=" + (masterEnabled && ambienteStrength > 0));
        } catch (RuntimeException e) {
            Log.w(TAG, "EnvironmentalReverb rejected by AudioFlinger (Status -38): " + e.getMessage());
            lastAudioFlingerError = e.getMessage();
            isAndroidGoDetected = true;
        } catch (Throwable t) {
            Log.w(TAG, "EnvironmentalReverb init error: " + t.getMessage());
        }

        // 5. PresetReverb (Using PRESET_LARGEHALL for real Samsung SoundAlive Concert Hall feeling)
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            applyPresetReverb(rev);
            presetReverbs.put(sessionId, rev);
            hasReverbHardware = true;
            Log.d(TAG, "PresetReverb (LARGEHALL) OK on session " + sessionId + ", active=" + (masterEnabled && ambienteStrength > 0));
        } catch (RuntimeException e) {
            Log.w(TAG, "PresetReverb rejected by AudioFlinger (Status -38): " + e.getMessage());
            lastAudioFlingerError = e.getMessage();
            isAndroidGoDetected = true;
        } catch (Throwable t) {
            Log.w(TAG, "PresetReverb init error: " + t.getMessage());
        }

        // 6. Virtualizer (Sonido Envolvente)
        try {
            Virtualizer virt = new Virtualizer(EFFECT_PRIORITY, sessionId);
            if (virt.getStrengthSupported()) {
                virt.setStrength(virtStrength());
            }
            tuneVirtualizer(virt);
            virt.setEnabled(virtualizerOn(virt));
            virtualizers.put(sessionId, virt);
            hasVirtualizerHardware = true;
            Log.d(TAG, "Virtualizer OK on session " + sessionId);
        } catch (RuntimeException e) {
            Log.w(TAG, "Virtualizer rejected by AudioFlinger (Status -38): " + e.getMessage());
            lastAudioFlingerError = e.getMessage();
            isAndroidGoDetected = true;
        } catch (Throwable t) {
            Log.w(TAG, "Virtualizer init error: " + t.getMessage());
        }
    }

    public synchronized boolean isMasterEnabled() {
        return masterEnabled;
    }

    /** true si ya hay efectos puestos en esa sesion (por ejemplo porque el reproductor la aviso). */
    public synchronized boolean isSessionAttached(int sessionId) {
        return sessionId != 0 && (activeSessions.contains(sessionId) || equalizers.containsKey(sessionId));
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
        int lg = computeLoudnessGain();
        for (LoudnessEnhancer le : loudnessEnhancers.values()) { try { le.setTargetGain(lg); le.setEnabled(enabled && lg != 0); } catch (Exception ignored) {} }
        for (EnvironmentalReverb env : envReverbs.values()) { try { env.setEnabled(enabled && ambienteStrength > 0); } catch (Exception ignored) {} }
        for (PresetReverb r : presetReverbs.values()) { applyPresetReverb(r); }
        for (Virtualizer v : virtualizers.values()) { try { v.setEnabled(virtualizerOn(v)); } catch (Exception ignored) {} }
        savePreferences();
    }

    public synchronized void setGain(int millibels) {
        this.gainMillibels = Math.max(-500, Math.min(1500, millibels));
        applyLoudness();
        savePreferences();
    }

    /** Ganancia total del LoudnessEnhancer (mB): volumen maestro + normalizacion + compensacion. */
    private int computeLoudnessGain() {
        int master = (int) (dynamicBoostStrength / 1000.0 * MASTER_MAX_MB);       // amplificador
        int norm = (int) (normalizationStrength / 1000.0 * NORMALIZATION_MAX_MB);  // nivel extra

        // Mayor subida en graves/medios (63 Hz - 4 kHz) y en agudos (8 y 16 kHz)
        int maxLow = 0, maxHigh = 0;
        for (int i = 0; i < UI_FREQUENCIES_HZ.length; i++) {
            int v = getUiVal(i);
            if (i <= 6) maxLow = Math.max(maxLow, v); else maxHigh = Math.max(maxHigh, v);
        }
        int lost = Math.max(0, Math.max(maxLow - HEADROOM_OFFSET_LOW_MB, maxHigh - HEADROOM_OFFSET_HIGH_MB));
        lost = Math.min(lost, 1500);
        // + lo que baja el Bundle, - lo que suben Claridad/Graves, + el poco de volumen del virtualizador
        int eqPart = (int) (lost * HEADROOM_COMP) - effectsEnergyMb() + (int) (surroundStrength * SURROUND_GAIN_MB / 1000.0);
        eqPart = Math.max(-600, Math.min(1100, eqPart));   // no se come el rango del Volumen Maestro

        int total = gainMillibels + master + norm + eqPart;
        return Math.max(-600, Math.min(2200, total));
    }

    private void applyLoudness() {
        int g = computeLoudnessGain();
        for (LoudnessEnhancer le : loudnessEnhancers.values()) {
            try {
                le.setTargetGain(g);
                le.setEnabled(masterEnabled && g != 0);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void setClarity(int strength) {
        this.clarityStrength = Math.max(0, Math.min(1000, strength));
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        savePreferences();
    }

    private short presetForRoom() {
        switch (roomType) {
            case 2:  return PresetReverb.PRESET_SMALLROOM;   // Habitacion
            case 3:  return PresetReverb.PRESET_LARGEHALL;   // Estadio
            case 4:  return PresetReverb.PRESET_MEDIUMHALL;  // Auditorio
            case 5:  return PresetReverb.PRESET_LARGEHALL;   // Catedral
            default: return PresetReverb.PRESET_MEDIUMROOM;  // Estudio
        }
    }

    private void applyPresetReverb(PresetReverb r) {
        try {
            boolean on = masterEnabled && USE_PRESET_REVERB && ambienteStrength >= PRESET_REVERB_FROM;
            r.setPreset(on ? presetForRoom() : PresetReverb.PRESET_NONE);
            r.setEnabled(on);
        } catch (Exception e) {
            Log.w(TAG, "PresetReverb set error: " + e.getMessage());
        }
    }

    public synchronized void setAmbiente(int strength, int room) {
        this.roomType = Math.max(1, Math.min(5, room));
        setAmbiente(strength);
    }

    public synchronized void setAmbiente(int strength) {
        this.ambienteStrength = Math.max(0, Math.min(2000, strength));
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
            applyPresetReverb(r);
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
        this.dialsUsed = true;
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

    /** Lineal, como un virtualizador normal: slider 0..10 -> fuerza 0..1000 (maximo de Android). */
    private short virtStrength() {
        return (short) Math.max(0, Math.min(1000, surroundStrength));
    }

    /**
     * El virtualizador se queda ENCENDIDO mientras la app este activa (con fuerza 0 en el slider 0).
     * Antes se apagaba en 0, y encenderlo/apagarlo cambiaba el volumen de golpe.
     * Si el equipo no soporta fuerza variable, solo se enciende con el slider arriba de 0.
     */
    /** true si hay auriculares (cable, USB o Bluetooth) como salida. */
    private boolean headphonesConnected() {
        try {
            if (appContext == null) return false;
            AudioManager am = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return false;
            for (android.media.AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                int t = d.getType();
                if (t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET
                        || t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                        || t == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                        || t == android.media.AudioDeviceInfo.TYPE_USB_HEADSET) return true;
            }
        } catch (Throwable ignored) {}
        return false;
    }

    /** Fuerza el modo del virtualizador segun la salida: binaural (auriculares) o transaural (parlante). */
    private void tuneVirtualizer(Virtualizer v) {
        if (!FORCE_VIRTUALIZER_MODE) return;
        try {
            int mode = headphonesConnected() ? Virtualizer.VIRTUALIZATION_MODE_BINAURAL
                                             : Virtualizer.VIRTUALIZATION_MODE_TRANSAURAL;
            if (v.canVirtualize(android.media.AudioFormat.CHANNEL_OUT_STEREO, mode)) {
                v.forceVirtualizationMode(mode);
            } else {
                v.forceVirtualizationMode(Virtualizer.VIRTUALIZATION_MODE_AUTO);
            }
        } catch (Throwable ignored) {}
    }

    private boolean virtualizerOn(Virtualizer v) {
        boolean strengthOk = false;
        try { strengthOk = v.getStrengthSupported(); } catch (Exception ignored) {}
        return masterEnabled && (strengthOk || surroundStrength > 0);
    }

    public synchronized void setSurround(int strength) {
        this.surroundStrength = Math.max(0, Math.min(1000, strength));
        for (Virtualizer v : virtualizers.values()) {
            try {
                if (v.getStrengthSupported()) v.setStrength(virtStrength());
                tuneVirtualizer(v);
                v.setEnabled(virtualizerOn(v));
            } catch (Exception ignored) {}
        }
        for (EnvironmentalReverb env : envReverbs.values()) { configureEnvironmentalReverb(env, ambienteStrength); }
        applyLoudness();
        savePreferences();
    }

    public synchronized void setDynamicBoost(int strength) {
        this.dynamicBoostStrength = Math.max(0, Math.min(1000, strength));
        applyLoudness();
        savePreferences();
    }

    public synchronized void setNormalization(int strength) {
        this.normalizationStrength = Math.max(0, Math.min(1000, strength));
        applyLoudness();
        savePreferences();
    }

    /** Nivel extra de una sala (1..5) en dB, -12..+12. */
    public synchronized void setRoomLevelDb(int room, int db) {
        if (room < 1 || room > 5) return;
        roomLevelMb[room - 1] = Math.max(-12, Math.min(12, db)) * 100;
        setAmbiente(ambienteStrength);
    }

    public synchronized void setBassBoostStrength(short strength) {
        this.bassBoostStrength = strength;
        for (BassBoost bb : bassBoosts.values()) {
            try {
                bb.setEnabled(masterEnabled && bassBoostStrength > 0);
                if (bb.getStrengthSupported()) bb.setStrength(bassBoostStrength);
            } catch (Exception ignored) {}
        }
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        applyLoudness();
        savePreferences();
    }

    public synchronized void setBandLevel(short uiBandIndex, short level) {
        if (uiBandIndex < 0 || uiBandIndex >= UI_FREQUENCIES_HZ.length) return;
        uiBandLevels.put(uiBandIndex, level);
        for (Equalizer eq : equalizers.values()) { applyAllBandsToEqualizer(eq); }
        savePreferences();
    }

    /** Subida (mB) que agrega el slider de Claridad en cada banda de pantalla. */
    private int clarityLayerMb(int index) {
        double boost = (clarityStrength / 1000.0) * CLARITY_MAX_MB;
        if (index == 7) return (int) Math.round(boost);
        if (index == 8) return (int) Math.round(boost * 1.2);
        return 0;
    }

    /** Subida (mB) que agrega el slider de Graves en cada banda de pantalla. */
    private int bassLayerMb(int index) {
        if (dialsUsed) return 0;
        double bass = (bassBoostStrength / 1000.0) * BASS_LAYER_MAX_MB;
        if (index == 0) return (int) Math.round(bass * BASS_LAYER_63);
        if (index == 1) return (int) Math.round(bass * BASS_LAYER_125);
        if (index == 2) return (int) Math.round(bass * BASS_LAYER_250);
        return 0;
    }

    /** Cuanto sube el volumen (mB) lo que agregan Claridad y Graves, ponderado por la energia de cada banda. */
    private int effectsEnergyMb() {
        double sum = 0;
        for (int i = 0; i < BAND_ENERGY_W.length; i++) {
            double g = (clarityLayerMb(i) + bassLayerMb(i)) / 100.0;   // dB
            sum += BAND_ENERGY_W[i] * Math.pow(10.0, g / 10.0);
        }
        return (int) Math.round(10.0 * Math.log10(Math.max(sum, 1e-6)) * 100.0);
    }

    private short getUiVal(int index) {
        Short val = uiBandLevels.get((short) index);
        int v = (val != null) ? val : 0;
        v += clarityLayerMb(index) + bassLayerMb(index);
        return (short) Math.max(-3000, Math.min(3000, v));
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
        applyLoudness();
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env, int strength) {
        if (env == null) return;
        double mixPos = Math.max(0, Math.min(2000, strength)) / 100.0; // 0..20
        short wet, refl;
        if (mixPos <= 10) {
            wet = (short) Math.round(-3000 + (mixPos / 10.0) * (3000 + REVERB_AT_10_MB));
            refl = (short) Math.round(-3000 + (mixPos / 10.0) * 3000);
        } else {
            double up = (mixPos - 10) / 10.0;
            wet = (short) Math.round(REVERB_AT_10_MB + up * (REVERB_MAX_MB - REVERB_AT_10_MB));
            refl = (short) Math.round(up * REFLECTIONS_MAX_MB);
        }
        // { decay ms, retardo reflexiones ms, retardo cola ms, densidad, difusion, ratio HF }
        int[] p;
        switch (roomType) {
            case 2:  p = new int[]{ 900, 10, 15,  800,  800, 800}; break; // Habitacion
            case 3:  p = new int[]{3000, 45, 45,  900,  900, 600}; break; // Estadio
            case 4:  p = new int[]{2200, 25, 30, 1000, 1000, 700}; break; // Auditorio
            case 5:  p = new int[]{5000, 70, 70, 1000, 1000, 500}; break; // Catedral
            default: p = new int[]{1500,  5, 10,  700,  800, 750}; break; // Estudio
        }
        int roomOff = roomLevelMb[Math.max(1, Math.min(5, roomType)) - 1];
        wet = (short) Math.max(-9000, Math.min(2000, wet + roomOff));
        refl = (short) Math.max(-9000, Math.min(1000, refl + roomOff + (int) (surroundStrength * 0.2)));
        try {
            env.setRoomLevel((short) 0);
            env.setRoomHFLevel((short) 0);
            env.setReflectionsLevel(refl);
            env.setReverbLevel(wet);
            env.setDecayTime(p[0]);
            env.setDecayHFRatio((short) p[5]);
        } catch (Exception ignored) {}
        try {
            env.setReflectionsDelay(Math.min(300, p[1] + (int) (surroundStrength / 1000.0 * 20)));
            env.setReverbDelay(p[2]);
            env.setDensity((short) p[3]);
            env.setDiffusion((short) p[4]);
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
        boolean reverbModified = (ambienteStrength > 0);
        boolean virtualizerModified = (surroundStrength > 0);
        boolean clarityModified = (clarityStrength > 0);
        boolean loudnessModified = (dynamicBoostStrength > 0);
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

        obj.put("isAndroidGoDetected", isAndroidGoDetected);
        obj.put("hasEqualizerHardware", hasEqualizerHardware);
        obj.put("hasBassBoostHardware", hasBassBoostHardware);
        obj.put("hasVirtualizerHardware", hasVirtualizerHardware);
        obj.put("hasReverbHardware", hasReverbHardware);
        obj.put("hasLoudnessEnhancerHardware", hasLoudnessEnhancerHardware);
        obj.put("lastAudioFlingerError", lastAudioFlingerError != null ? lastAudioFlingerError : "");

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
            enginesArr.put("Librerías HAL soundfx no presentes (ROM Android Go recortada - Error -38 AudioFlinger)");
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
            ed.putInt("normalization", normalizationStrength);
            ed.putInt("roomType", roomType);
            ed.putString("roomLevels", roomLevelMb[0] + "," + roomLevelMb[1] + "," + roomLevelMb[2] + "," + roomLevelMb[3] + "," + roomLevelMb[4]);
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
            normalizationStrength = sp.getInt("normalization", 0);
            roomType = Math.max(1, Math.min(5, sp.getInt("roomType", 1)));
            String rl = sp.getString("roomLevels", null);
            if (rl != null) {
                String[] parts = rl.split(",");
                for (int i = 0; i < parts.length && i < 5; i++) {
                    try { roomLevelMb[i] = Integer.parseInt(parts[i].trim()); } catch (Exception ignored) {}
                }
            }

            for (short b = 0; b < UI_FREQUENCIES_HZ.length; b++) {
                if (sp.contains("ui_band_" + b)) {
                    uiBandLevels.put(b, (short) sp.getInt("ui_band_" + b, 0));
                }
            }
        } catch (Exception ignored) {}
    }

    public synchronized void release() {
        for (int sessionId : new HashSet<>(activeSessions)) {
            Equalizer eq = equalizers.remove(sessionId);
            if (eq != null) { try { eq.setEnabled(false); eq.release(); } catch (Exception ignored) {} }

            BassBoost bb = bassBoosts.remove(sessionId);
            if (bb != null) { try { bb.setEnabled(false); bb.release(); } catch (Exception ignored) {} }

            LoudnessEnhancer le = loudnessEnhancers.remove(sessionId);
            if (le != null) { try { le.setEnabled(false); le.release(); } catch (Exception ignored) {} }

            EnvironmentalReverb env = envReverbs.remove(sessionId);
            if (env != null) { try { env.setEnabled(false); env.release(); } catch (Exception ignored) {} }

            PresetReverb r = presetReverbs.remove(sessionId);
            if (r != null) { try { r.setEnabled(false); r.release(); } catch (Exception ignored) {} }

            Virtualizer v = virtualizers.remove(sessionId);
            if (v != null) { try { v.setEnabled(false); v.release(); } catch (Exception ignored) {} }
        }
        activeSessions.clear();
        equalizers.clear();
        bassBoosts.clear();
        loudnessEnhancers.clear();
        envReverbs.clear();
        presetReverbs.clear();
        virtualizers.clear();
    }
}
