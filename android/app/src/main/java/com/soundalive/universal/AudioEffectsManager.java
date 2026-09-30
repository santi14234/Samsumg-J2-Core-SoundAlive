package com.soundalive.universal;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.EnvironmentalReverb;
import android.media.audiofx.PresetReverb;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class AudioEffectsManager {
    private static final String TAG = "SoundAliveEffects";
    private static final String PREFS_NAME = "SoundAliveAudioPrefs";
    private static final int EFFECT_PRIORITY = 1000; // High priority so games & other apps don't override
    private static AudioEffectsManager instance;

    // Frequencies of the UI bands
    public static final int[] UI_FREQUENCIES_HZ = {63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};

    private final Set<Integer> activeSessions = new HashSet<>();
    private final Map<Integer, Equalizer> equalizers = new HashMap<>();
    private final Map<Integer, BassBoost> bassBoosts = new HashMap<>();
    private final Map<Integer, PresetReverb> presetReverbs = new HashMap<>();
    private final Map<Integer, EnvironmentalReverb> envReverbs = new HashMap<>();

    private boolean masterEnabled = true;
    private short bassBoostStrength = 0; // 0 - 1000

    // Dual Samsung Dials values (-100 to +100)
    private int dialBassTreble = 0; // -100 (Bass) to +100 (Treble)
    private int dialVocalInstrument = 0; // -100 (Instrumental) to +100 (Vocal)
    private boolean isBasicMode = true;

    private short reverbPreset = PresetReverb.PRESET_NONE;
    private boolean concertHallEnabled = false;

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

            // 1. Attach to session 0 (Global audio output mix)
            attachSession(0);

            // 2. Android 8.0+ (Oreo / API 26+) System-wide Playback Interceptor:
            // Intercepts active audio sessions of ALL running apps, including GAMES!
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
                                        int sessionId = config.getClientAudioSessionId();
                                        if (sessionId > 0) {
                                            Log.d(TAG, "AudioPlayback detected active session: " + sessionId);
                                            attachSession(sessionId);
                                        }
                                    } catch (Exception ignored) {}
                                }
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
            Log.d(TAG, "Equalizer attached to session: " + sessionId);
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

        // 3. EnvironmentalReverb (Pure acoustic reverb, NO 3D Virtualizer)
        try {
            EnvironmentalReverb env = new EnvironmentalReverb(EFFECT_PRIORITY, sessionId);
            configureEnvironmentalReverb(env);
            env.setEnabled(masterEnabled && concertHallEnabled);
            envReverbs.put(sessionId, env);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init EnvironmentalReverb on session " + sessionId + ": " + e.getMessage());
        }

        // 4. PresetReverb (System auxiliary reverb)
        try {
            PresetReverb rev = new PresetReverb(EFFECT_PRIORITY, sessionId);
            rev.setEnabled(masterEnabled && concertHallEnabled);
            rev.setPreset(reverbPreset != 0 ? reverbPreset : PresetReverb.PRESET_LARGEHALL);
            presetReverbs.put(sessionId, rev);
        } catch (Exception e) {
            Log.w(TAG, "Cannot init PresetReverb on session " + sessionId + ": " + e.getMessage());
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
            try { env.setEnabled(enabled && concertHallEnabled); } catch (Exception ignored) {}
        }
        for (PresetReverb r : presetReverbs.values()) {
            try { r.setEnabled(enabled && concertHallEnabled); } catch (Exception ignored) {}
        }
        savePreferences();
    }

    /**
     * Samsung Dual Dials adjustment (Basic Mode):
     * dialBassTreble: -100 (Bass) to +100 (Treble)
     * dialVocalInstrument: -100 (Instrument) to +100 (Vocal)
     */
    public synchronized void setSamsungDials(int bassTreble, int vocalInstrument) {
        this.isBasicMode = true;
        this.dialBassTreble = Math.max(-100, Math.min(100, bassTreble));
        this.dialVocalInstrument = Math.max(-100, Math.min(100, vocalInstrument));

        double btNorm = this.dialBassTreble / 100.0;
        double viNorm = this.dialVocalInstrument / 100.0;

        short bassLevel = (short) Math.round(-btNorm * 700);
        short trebleLevel = (short) Math.round(btNorm * 700);
        short vocalLevel = (short) Math.round(viNorm * 700);
        short instLevel = (short) Math.round(-viNorm * 500);

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
            this.bassBoostStrength = (short) Math.round(-btNorm * 800);
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

    private void applyAllBandsToEqualizer(Equalizer eq) {
        if (eq == null) return;
        try {
            short numPhysicalBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange();
            short minLvl = range[0];
            short maxLvl = range[1];

            if (numPhysicalBands >= 9) {
                for (short b = 0; b < numPhysicalBands && b < UI_FREQUENCIES_HZ.length; b++) {
                    Short val = uiBandLevels.get(b);
                    short lvl = (val != null) ? val : 0;
                    short clamped = (short) Math.max(minLvl, Math.min(maxLvl, lvl));
                    eq.setBandLevel(b, clamped);
                }
            } else {
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

                        if (uiFreq >= minSpanHz && uiFreq <= maxSpanHz) {
                            double dist = Math.abs(Math.log(Math.max(1, uiFreq)) - Math.log(Math.max(1, centerFreqHz)));
                            double weight = 1.0 / (1.0 + dist * 2.0);
                            weightedSum += val * weight;
                            totalWeight += weight;
                        }
                    }

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

    public synchronized void setConcertHall(boolean enabled) {
        this.concertHallEnabled = enabled;
        this.reverbPreset = enabled ? PresetReverb.PRESET_LARGEHALL : PresetReverb.PRESET_NONE;

        for (EnvironmentalReverb env : envReverbs.values()) {
            try {
                env.setEnabled(masterEnabled && concertHallEnabled);
                if (concertHallEnabled) {
                    configureEnvironmentalReverb(env);
                }
            } catch (Exception ignored) {}
        }

        for (PresetReverb r : presetReverbs.values()) {
            try {
                r.setEnabled(masterEnabled && concertHallEnabled);
                if (concertHallEnabled) {
                    r.setPreset(PresetReverb.PRESET_LARGEHALL);
                }
            } catch (Exception ignored) {}
        }
        savePreferences();
    }

    private void configureEnvironmentalReverb(EnvironmentalReverb env) {
        if (env == null) return;
        try {
            env.setRoomLevel((short) -200);
            env.setRoomHFLevel((short) -300);
            env.setReflectionsLevel((short) -400);
            env.setReverbLevel((short) 600);
            env.setDecayTime(3800);
            env.setDecayHFRatio((short) 850);
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
            ed.putBoolean("concertHall", concertHallEnabled);
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
            concertHallEnabled = sp.getBoolean("concertHall", false);
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
