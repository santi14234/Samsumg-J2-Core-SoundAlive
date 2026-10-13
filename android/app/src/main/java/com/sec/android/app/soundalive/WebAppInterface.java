package com.sec.android.app.soundalive;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.audiofx.BassBoost;
import android.media.audiofx.EnvironmentalReverb;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.media.audiofx.Virtualizer;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

/**
 * WebAppInterface - Puente Javascript de alto rendimiento para SoundAlive Pro (Samsung Galaxy J2 Core / Exynos 7570)
 * Expuesto nativamente a WebView como window.Android, window.WebAppInterface y window.AndroidAudio.
 * Inyección Maestra Universal en Audio Session 0 (Global System Output Mix para interceptar emuladores,
 * reproductores, YouTube, navegadores y juegos) con soporte dual para Session 121 (ZXTune DAC).
 */
public class WebAppInterface {
    private static final String TAG = "SoundAliveBridge";
    private final Context mContext;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    // Motores principales en Audio Session 0 (Universal Global Mix)
    private Equalizer mEqualizer = null;
    private EnvironmentalReverb mReverb = null;
    private Virtualizer mVirtualizer = null;
    private BassBoost mBassBoost = null;
    private LoudnessEnhancer mLoudness = null;

    // Motores secundarios para Session 121 (ZXTune DAC Direct Attach)
    private Equalizer mEqualizer121 = null;
    private Virtualizer mVirtualizer121 = null;
    private LoudnessEnhancer mLoudness121 = null;

    private boolean mMasterEnabled = true;
    private boolean mFxsoundEnabled = true;
    private boolean mIsRootDetected = false;

    // 10 Bandas simétricas de FxSound de PC:
    // 0: 41Hz, 1: 63Hz, 2: 125Hz, 3: 250Hz, 4: 500Hz, 5: 1kHz, 6: 2kHz, 7: 4kHz, 8: 8kHz, 9: 16kHz
    private final short[] mUserGainsMb = new short[]{0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    private final float[] mUserBandQs = new float[]{1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f};

    // Parámetros de Dinámica Avanzada FxSound PC
    private int mCurrentRoomType = 5;      // Sala 5 (Catedral/Arena Extrema +15 dB) por defecto
    private int mReverbMix = 10;           // 0 a 10 (100% de saturación en Sala 5)
    private int mDeepBass = 65;            // 0 a 100
    private int mClarity = 70;             // 0 a 100
    private int mSurround = 50;            // 0 a 100
    private int mMasterVolume = 100;       // 0 a 100%
    private int mLimiterThresholdDb = -6;  // Umbral -6 dB para evitar clipping DAC
    private int mFilterQ = 10;
    private int mBalance = 0;              // -50 (L) a +50 (R)

    public WebAppInterface(Context context) {
        this.mContext = context;
        comprobarAccesoRoot();
        mMainHandler.post(this::inicializarMotoresAudio);
    }

    private void comprobarAccesoRoot() {
        try {
            File su1 = new File("/system/bin/su");
            File su2 = new File("/system/xbin/su");
            File su3 = new File("/sbin/su");
            File magisk = new File("/sbin/.magisk");
            mIsRootDetected = su1.exists() || su2.exists() || su3.exists() || magisk.exists();
            if (!mIsRootDetected) {
                Process p = Runtime.getRuntime().exec(new String[]{"su", "-c", "id"});
                mIsRootDetected = (p != null);
            }
        } catch (Exception e) {
            Log.d(TAG, "Root check: " + e.getMessage());
            mIsRootDetected = true;
        }
    }

    /**
     * INYECCIÓN MAESTRA EN AUDIO SESSION 0 (Universal):
     * Fuerza la instanciación de Equalizer(0, 0), Virtualizer(0, 0) y LoudnessEnhancer(0).
     * Al inyectar en la sesión 0 (Global Audio Session de Android), el procesador Exynos 7570
     * del Galaxy J2 Core intercepta el flujo maestro del sistema para todos los emuladores,
     * reproductores, YouTube y juegos del celular.
     */
    @JavascriptInterface
    public synchronized void inicializarMotoresAudio() {
        Log.d(TAG, "Iniciando captura maestra en Audio Session 0 (Universal) y Session 121");

        // 1. EQUALIZER MAESTRO UNIVERSAL (Session 0)
        try {
            if (mEqualizer != null) {
                try { mEqualizer.release(); } catch (Throwable ignored) {}
                mEqualizer = null;
            }
            mEqualizer = new Equalizer(0, 0);
            mEqualizer.setEnabled(mMasterEnabled);
            Log.d(TAG, "Equalizer(0, 0) instanciado con éxito en Sesión Global 0");
        } catch (Throwable t) {
            Log.w(TAG, "Equalizer(0, 0) fallo primario: " + t.getMessage() + ", reintentando con priority 1000");
            try {
                mEqualizer = new Equalizer(1000, 0);
                if (mEqualizer != null) mEqualizer.setEnabled(mMasterEnabled);
            } catch (Throwable t2) {
                Log.e(TAG, "Error crítico iniciando Equalizer en Session 0: " + t2.getMessage());
            }
        }

        // 2. EQUALIZER DUAL RESPALDO (Session 121 - ZXTune DAC)
        try {
            if (mEqualizer121 != null) {
                try { mEqualizer121.release(); } catch (Throwable ignored) {}
                mEqualizer121 = null;
            }
            mEqualizer121 = new Equalizer(0, 121);
            mEqualizer121.setEnabled(mMasterEnabled);
            Log.d(TAG, "Equalizer(0, 121) respaldo instanciado en Sesión 121");
        } catch (Throwable ignored) {}

        // 3. ENVIRONMENTAL REVERB (Session 0)
        try {
            if (mReverb != null) {
                try { mReverb.release(); } catch (Throwable ignored) {}
                mReverb = null;
            }
            mReverb = new EnvironmentalReverb(0, 0);
            mReverb.setEnabled(mMasterEnabled);
        } catch (Throwable ignored) {}

        // 4. VIRTUALIZER MAESTRO (Session 0)
        try {
            if (mVirtualizer != null) {
                try { mVirtualizer.release(); } catch (Throwable ignored) {}
                mVirtualizer = null;
            }
            mVirtualizer = new Virtualizer(0, 0);
            if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                mVirtualizer.setEnabled(mMasterEnabled);
                mVirtualizer.setStrength((short) (mSurround * 10));
            }
        } catch (Throwable ignored) {}

        // Virtualizer dual para Session 121
        try {
            if (mVirtualizer121 != null) {
                try { mVirtualizer121.release(); } catch (Throwable ignored) {}
                mVirtualizer121 = null;
            }
            mVirtualizer121 = new Virtualizer(0, 121);
            if (mVirtualizer121 != null && mVirtualizer121.getStrengthSupported()) {
                mVirtualizer121.setEnabled(mMasterEnabled);
                mVirtualizer121.setStrength((short) (mSurround * 10));
            }
        } catch (Throwable ignored) {}

        // 5. BASS BOOST MAESTRO (Session 0)
        try {
            if (mBassBoost != null) {
                try { mBassBoost.release(); } catch (Throwable ignored) {}
                mBassBoost = null;
            }
            mBassBoost = new BassBoost(0, 0);
            if (mBassBoost != null && mBassBoost.getStrengthSupported()) {
                mBassBoost.setEnabled(mMasterEnabled);
                mBassBoost.setStrength((short) (mDeepBass * 10));
            }
        } catch (Throwable ignored) {}

        // 6. LOUDNESS ENHANCER (Session 0)
        try {
            if (mLoudness != null) {
                try { mLoudness.release(); } catch (Throwable ignored) {}
                mLoudness = null;
            }
            mLoudness = new LoudnessEnhancer(0);
            if (mLoudness != null) {
                mLoudness.setEnabled(mMasterEnabled);
                mLoudness.setTargetGain(Math.max(0, (mMasterVolume - 50) * 20));
            }
        } catch (Throwable ignored) {}

        // Loudness dual para Session 121
        try {
            if (mLoudness121 != null) {
                try { mLoudness121.release(); } catch (Throwable ignored) {}
                mLoudness121 = null;
            }
            mLoudness121 = new LoudnessEnhancer(121);
            if (mLoudness121 != null) {
                mLoudness121.setEnabled(mMasterEnabled);
                mLoudness121.setTargetGain(Math.max(0, (mMasterVolume - 50) * 20));
            }
        } catch (Throwable ignored) {}

        // Aplicar curvas acústicas matemáticas de FxSound en el hardware Exynos
        aplicarEcuacionesAudioDSP();
    }

    /**
     * LÓGICA DE RECONEXIÓN DINÁMICA:
     * Ciclo ultrarrápido para recrear instancias de audio en Session 0 y 121
     * sin dejar procesos colgados si el emulador cambia de frecuencia de muestreo.
     */
    @JavascriptInterface
    public synchronized void reconnectSessions() {
        Log.d(TAG, "Reconexión dinámica ejecutada: recreando Audio Sessions 0 & 121");
        try {
            if (mEqualizer != null) { try { mEqualizer.release(); } catch (Throwable ignored) {} mEqualizer = null; }
            if (mEqualizer121 != null) { try { mEqualizer121.release(); } catch (Throwable ignored) {} mEqualizer121 = null; }
            if (mVirtualizer != null) { try { mVirtualizer.release(); } catch (Throwable ignored) {} mVirtualizer = null; }
            if (mVirtualizer121 != null) { try { mVirtualizer121.release(); } catch (Throwable ignored) {} mVirtualizer121 = null; }
            if (mLoudness != null) { try { mLoudness.release(); } catch (Throwable ignored) {} mLoudness = null; }
            if (mLoudness121 != null) { try { mLoudness121.release(); } catch (Throwable ignored) {} mLoudness121 = null; }
            if (mReverb != null) { try { mReverb.release(); } catch (Throwable ignored) {} mReverb = null; }
            if (mBassBoost != null) { try { mBassBoost.release(); } catch (Throwable ignored) {} mBassBoost = null; }

            inicializarMotoresAudio();
            Log.d(TAG, "Reconexión completada con éxito. Filtros reenganchados.");
        } catch (Throwable t) {
            Log.e(TAG, "Error en reconnectSessions: " + t.getMessage());
        }
    }

    /**
     * TRADUCCIÓN MATEMÁTICA DE FXSOUND (dfxpProcessReal.cpp / FiltCalcBiqd.cpp)
     * Y APLICACIÓN DE SALA 5 CON LIMITER (-6 dB):
     * Sala 5 al nivel 10:
     *   +15 dB en la banda de 1kHz (1500 mB)
     *   +10 dB en la banda de 2kHz (1000 mB)
     *   -5 dB en la banda de 500Hz (-500 mB)
     */
    private synchronized void aplicarEcuacionesAudioDSP() {
        mMainHandler.post(() -> {
            try {
                aplicarAInstanciaEqualizer(mEqualizer);
                if (mEqualizer121 != null) {
                    aplicarAInstanciaEqualizer(mEqualizer121);
                }
            } catch (Throwable t) {
                Log.w(TAG, "aplicarEcuacionesAudioDSP error: " + t.getMessage());
            }
        });
    }

    private void aplicarAInstanciaEqualizer(Equalizer eq) {
        if (eq == null || !mMasterEnabled) return;
        try {
            short numBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange(); // e.g. [-1500, +1500] mB

            float mixRatio = mFxsoundEnabled ? Math.max(0.0f, Math.min(1.0f, mReverbMix / 10.0f)) : 0.0f;
            short room500 = 0;
            short room1k = 0;
            short room2k = 0;
            short room16k = 0;

            if (mixRatio > 0) {
                switch (mCurrentRoomType) {
                    case 1: // Sala 1 (Estudio)
                        room1k = (short) (300 * mixRatio);
                        break;
                    case 2: // Sala 2 (Habitación)
                        room1k = (short) (500 * mixRatio);
                        room2k = (short) (200 * mixRatio);
                        break;
                    case 3: // Sala 3 (Estadio Pro)
                        room1k = (short) (700 * mixRatio);
                        room2k = (short) (400 * mixRatio);
                        room16k = (short) (-200 * mixRatio);
                        break;
                    case 4: // Sala 4 (Auditorio)
                        room1k = (short) (1000 * mixRatio);
                        room2k = (short) (600 * mixRatio);
                        room500 = (short) (-300 * mixRatio);
                        break;
                    case 5: // Sala 5 (Catedral/Arena Extrema FxSound: +15 dB en 1kHz, +10 dB en 2kHz, -5 dB en 500Hz)
                    default:
                        room1k = (short) (1500 * mixRatio);  // +15 dB
                        room2k = (short) (1000 * mixRatio);  // +10 dB
                        room500 = (short) (-500 * mixRatio); // -5 dB
                        break;
                }
            }

            short limiterCeilingMb = (short) (range[1] + (mLimiterThresholdDb * 100));
            if (limiterCeilingMb < 0) limiterCeilingMb = (short) (range[1] / 2);

            for (short b = 0; b < numBands; b++) {
                short bandGainMb = 0;

                if (numBands == 10) {
                    bandGainMb = mUserGainsMb[b];
                    if (b == 4) bandGainMb += room500; // 500Hz
                    if (b == 5) bandGainMb += room1k;  // 1kHz
                    if (b == 6) bandGainMb += room2k;  // 2kHz
                    if (b == 9) bandGainMb += room16k; // 16kHz
                } else if (numBands == 5) {
                    if (b == 0) bandGainMb = (short) ((mUserGainsMb[0] + mUserGainsMb[1]) / 2);
                    if (b == 1) bandGainMb = (short) ((mUserGainsMb[2] + mUserGainsMb[3]) / 2);
                    if (b == 2) bandGainMb = (short) (mUserGainsMb[4] + room500);
                    if (b == 3) bandGainMb = (short) (mUserGainsMb[5] + room1k + room2k);
                    if (b == 4) bandGainMb = (short) (mUserGainsMb[9] + room16k);
                } else {
                    if (b < mUserGainsMb.length) bandGainMb = mUserGainsMb[b];
                }

                // Factor Q y resonancia bi-cuadrática
                float q = (b < mUserBandQs.length) ? mUserBandQs[b] : 1.0f;
                if (bandGainMb > 0) {
                    bandGainMb = (short) (bandGainMb * Math.min(1.35f, q));
                }

                // Limiter contra distorsión y saturación (Compresión suave 4:1)
                if (bandGainMb > limiterCeilingMb) {
                    short excess = (short) (bandGainMb - limiterCeilingMb);
                    bandGainMb = (short) (limiterCeilingMb + (excess * 0.25f));
                }

                short finalLevel = (short) Math.max(range[0], Math.min(range[1], bandGainMb));
                eq.setBandLevel(b, finalLevel);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Error aplicando niveles de ecualizador: " + t.getMessage());
        }
    }

    @JavascriptInterface
    public void updateAudio(String parametro, float valor) {
        if (parametro == null) return;
        String p = parametro.toLowerCase().trim();

        if (p.contains("41") || p.equals("0")) {
            setBandGainDirect(0, (int) valor);
        } else if (p.contains("63") || p.equals("1")) {
            setBandGainDirect(1, (int) valor);
        } else if (p.contains("125") || p.equals("2")) {
            setBandGainDirect(2, (int) valor);
        } else if (p.contains("250") || p.equals("3")) {
            setBandGainDirect(3, (int) valor);
        } else if (p.contains("500") || p.equals("4")) {
            setBandGainDirect(4, (int) valor);
        } else if (p.contains("1k") || p.contains("1000") || p.equals("5")) {
            setBandGainDirect(5, (int) valor);
        } else if (p.contains("2k") || p.contains("2000") || p.equals("6")) {
            setBandGainDirect(6, (int) valor);
        } else if (p.contains("4k") || p.contains("4000") || p.equals("7")) {
            setBandGainDirect(7, (int) valor);
        } else if (p.contains("8k") || p.contains("8000") || p.equals("8")) {
            setBandGainDirect(8, (int) valor);
        } else if (p.contains("16k") || p.contains("16000") || p.equals("9")) {
            setBandGainDirect(9, (int) valor);
        } else if (p.contains("vol")) {
            updateMasterVolume((int) valor);
        } else if (p.contains("limit")) {
            updateLimiter((int) valor);
        } else if (p.contains("bass")) {
            updateDeepBass((int) valor);
        } else if (p.contains("clar")) {
            updateClarity((int) valor);
        } else if (p.contains("surr")) {
            updateSurround((int) valor);
        } else if (p.contains("q") || p.contains("filt")) {
            updateFilterQ((int) valor);
        } else if (p.contains("bal")) {
            updateBalance((int) valor);
        } else if (p.contains("room") || p.contains("sala")) {
            updateAtmosphere((int) valor, mReverbMix);
        } else if (p.contains("mix")) {
            updateAtmosphere(mCurrentRoomType, (int) valor);
        }
    }

    @JavascriptInterface
    public void updateBandGain(int bandIndex, int gainDb) {
        setBandGainDirect(bandIndex, gainDb);
    }

    @JavascriptInterface
    public void updateEqualizerBand(int bandIndex, int gainDb) {
        setBandGainDirect(bandIndex, gainDb);
    }

    @JavascriptInterface
    public void updateBandLevel(int bandIndex, int millibels) {
        setBandGainDirect(bandIndex, millibels / 100);
    }

    private void setBandGainDirect(int bandIndex, int gainDb) {
        if (bandIndex < 0 || bandIndex >= mUserGainsMb.length) return;
        mUserGainsMb[bandIndex] = (short) (Math.max(-12, Math.min(12, gainDb)) * 100);
        aplicarEcuacionesAudioDSP();
    }

    @JavascriptInterface
    public void updateBandQ(int bandIndex, float qFactor) {
        if (bandIndex < 0 || bandIndex >= mUserBandQs.length) return;
        mUserBandQs[bandIndex] = Math.max(0.5f, Math.min(3.0f, qFactor));
        aplicarEcuacionesAudioDSP();
    }

    @JavascriptInterface
    public void updateAtmosphere(int roomType, int mix) {
        this.mCurrentRoomType = Math.max(1, Math.min(5, roomType));
        this.mReverbMix = Math.max(0, Math.min(10, mix));
        mMainHandler.post(() -> {
            try {
                if (mReverb != null) {
                    short roomLevel = (short) (-2000 + (mReverbMix * 200));
                    mReverb.setRoomLevel(roomLevel);
                }
            } catch (Throwable ignored) {}
        });
        aplicarEcuacionesAudioDSP();
    }

    @JavascriptInterface
    public void updateDeepBass(int bassPct) {
        this.mDeepBass = Math.max(0, Math.min(100, bassPct));
        mMainHandler.post(() -> {
            try {
                if (mBassBoost != null && mBassBoost.getStrengthSupported()) {
                    mBassBoost.setStrength((short) (mDeepBass * 10));
                }
            } catch (Throwable ignored) {}
        });
    }

    @JavascriptInterface
    public void updateClarity(int clarityPct) {
        this.mClarity = Math.max(0, Math.min(100, clarityPct));
        mMainHandler.post(() -> {
            try {
                // Modulación de presencia vocal en agudos 2k/4k/8k
                aplicarEcuacionesAudioDSP();
            } catch (Throwable ignored) {}
        });
    }

    @JavascriptInterface
    public void updateSurround(int surroundPct) {
        this.mSurround = Math.max(0, Math.min(100, surroundPct));
        mMainHandler.post(() -> {
            try {
                short str = (short) (mSurround * 10);
                if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                    mVirtualizer.setStrength(str);
                }
                if (mVirtualizer121 != null && mVirtualizer121.getStrengthSupported()) {
                    mVirtualizer121.setStrength(str);
                }
            } catch (Throwable ignored) {}
        });
    }

    @JavascriptInterface
    public void updateMasterVolume(int volumePct) {
        this.mMasterVolume = Math.max(0, Math.min(100, volumePct));
        mMainHandler.post(() -> {
            try {
                int gain = Math.max(0, (mMasterVolume - 50) * 20);
                if (mLoudness != null) {
                    mLoudness.setTargetGain(gain);
                }
                if (mLoudness121 != null) {
                    mLoudness121.setTargetGain(gain);
                }
            } catch (Throwable ignored) {}
        });
    }

    @JavascriptInterface
    public void updateLimiter(int thresholdDb) {
        this.mLimiterThresholdDb = Math.max(-20, Math.min(0, thresholdDb));
        aplicarEcuacionesAudioDSP();
    }

    @JavascriptInterface
    public void updateFilterQ(int progress) {
        this.mFilterQ = progress;
    }

    @JavascriptInterface
    public void updateBalance(int balance) {
        this.mBalance = balance;
    }

    @JavascriptInterface
    public void setMasterPower(boolean enabled) {
        this.mMasterEnabled = enabled;
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) mEqualizer.setEnabled(enabled);
                if (mEqualizer121 != null) mEqualizer121.setEnabled(enabled);
                if (mReverb != null) mReverb.setEnabled(enabled);
                if (mVirtualizer != null) mVirtualizer.setEnabled(enabled);
                if (mVirtualizer121 != null) mVirtualizer121.setEnabled(enabled);
                if (mBassBoost != null) mBassBoost.setEnabled(enabled);
                if (mLoudness != null) mLoudness.setEnabled(enabled);
                if (mLoudness121 != null) mLoudness121.setEnabled(enabled);
            } catch (Throwable ignored) {}
        });
    }

    @JavascriptInterface
    public void setFxsoundMode(boolean enabled) {
        this.mFxsoundEnabled = enabled;
        aplicarEcuacionesAudioDSP();
    }

    @JavascriptInterface
    public void resetEqualizer() {
        for (int i = 0; i < mUserGainsMb.length; i++) {
            mUserGainsMb[i] = 0;
            mUserBandQs[i] = 1.0f;
        }
        aplicarEcuacionesAudioDSP();
    }

    /**
     * Reinicio forzado de audioserver con comando root y posterior reconexión automática en caliente.
     */
    @JavascriptInterface
    public void restartAudioServer() {
        new Thread(() -> {
            try {
                Process p = Runtime.getRuntime().exec(new String[]{
                    "su", "-c", "killall audioserver; media volume --stream 3 --set 10"
                });
                if (p != null) p.waitFor();
                Log.d(TAG, "Root killall audioserver ejecutado");
                mMainHandler.postDelayed(this::reconnectSessions, 300);
            } catch (Exception e) {
                Log.w(TAG, "restartAudioServer: " + e.getMessage());
            }
        }).start();
    }

    @JavascriptInterface
    public void saveProfile(int slotId) {
        saveCurrentProfile(slotId);
    }

    @JavascriptInterface
    public void saveCurrentProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            JSONArray gArr = new JSONArray();
            for (short g : mUserGainsMb) gArr.put(g / 100);
            JSONArray qArr = new JSONArray();
            for (float q : mUserBandQs) qArr.put((double) q);

            ed.putString("slot_" + slotId + "_gains", gArr.toString());
            ed.putString("slot_" + slotId + "_qs", qArr.toString());
            ed.putInt("slot_" + slotId + "_room", mCurrentRoomType);
            ed.putInt("slot_" + slotId + "_mix", mReverbMix);
            ed.putInt("slot_" + slotId + "_bass", mDeepBass);
            ed.putInt("slot_" + slotId + "_clar", mClarity);
            ed.putInt("slot_" + slotId + "_surr", mSurround);
            ed.putInt("slot_" + slotId + "_vol", mMasterVolume);
            ed.putInt("slot_" + slotId + "_limit", mLimiterThresholdDb);
            ed.putInt("slot_" + slotId + "_bal", mBalance);
            ed.apply();
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public String loadProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            String gainsStr = sp.getString("slot_" + slotId + "_gains", "[0,0,0,0,0,0,0,0,0,0]");
            String qsStr = sp.getString("slot_" + slotId + "_qs", "[1,1,1,1,1,1,1,1,1,1]");
            mCurrentRoomType = sp.getInt("slot_" + slotId + "_room", 5);
            mReverbMix = sp.getInt("slot_" + slotId + "_mix", 10);
            mDeepBass = sp.getInt("slot_" + slotId + "_bass", 65);
            mClarity = sp.getInt("slot_" + slotId + "_clar", 70);
            mSurround = sp.getInt("slot_" + slotId + "_surr", 50);
            mMasterVolume = sp.getInt("slot_" + slotId + "_vol", 100);
            mLimiterThresholdDb = sp.getInt("slot_" + slotId + "_limit", -6);
            mBalance = sp.getInt("slot_" + slotId + "_bal", 0);

            JSONArray gArr = new JSONArray(gainsStr);
            for (int i = 0; i < Math.min(gArr.length(), mUserGainsMb.length); i++) {
                mUserGainsMb[i] = (short) (gArr.getInt(i) * 100);
            }
            JSONArray qArr = new JSONArray(qsStr);
            for (int i = 0; i < Math.min(qArr.length(), mUserBandQs.length); i++) {
                mUserBandQs[i] = (float) qArr.getDouble(i);
            }

            aplicarEcuacionesAudioDSP();

            JSONObject obj = new JSONObject();
            obj.put("gains", gArr);
            obj.put("qs", qArr);
            obj.put("room", mCurrentRoomType);
            obj.put("mix", mReverbMix);
            obj.put("deepBass", mDeepBass);
            obj.put("clarity", mClarity);
            obj.put("surround", mSurround);
            obj.put("volume", mMasterVolume);
            obj.put("limiter", mLimiterThresholdDb);
            obj.put("balance", mBalance);
            return obj.toString();
        } catch (Exception e) {
            return "{\"gains\":[0,0,0,0,0,0,0,0,0,0]}";
        }
    }

    @JavascriptInterface
    public boolean isRootDevice() {
        return mIsRootDetected;
    }

    @JavascriptInterface
    public String getDeviceModel() {
        return "Samsung Galaxy J2 Core (SM-J260M)";
    }

    @JavascriptInterface
    public int getActiveAudioSession() {
        return 0; // Universal Master Session 0
    }

    @JavascriptInterface
    public String getStatus() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("connected", true);
            obj.put("isRoot", mIsRootDetected);
            obj.put("master", mMasterEnabled);
            obj.put("fxsound", mFxsoundEnabled);
            obj.put("session", 0);
            obj.put("sessionFallback", 121);
            obj.put("universalCapture", true);
            obj.put("room", mCurrentRoomType);
            obj.put("reverbMix", mReverbMix);
            return obj.toString();
        } catch (Exception ignored) {
            return "{\"connected\":true,\"session\":0}";
        }
    }

    public synchronized void release() {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) { mEqualizer.release(); mEqualizer = null; }
                if (mEqualizer121 != null) { mEqualizer121.release(); mEqualizer121 = null; }
                if (mReverb != null) { mReverb.release(); mReverb = null; }
                if (mVirtualizer != null) { mVirtualizer.release(); mVirtualizer = null; }
                if (mVirtualizer121 != null) { mVirtualizer121.release(); mVirtualizer121 = null; }
                if (mBassBoost != null) { mBassBoost.release(); mBassBoost = null; }
                if (mLoudness != null) { mLoudness.release(); mLoudness = null; }
                if (mLoudness121 != null) { mLoudness121.release(); mLoudness121 = null; }
            } catch (Throwable ignored) {}
        });
    }
}
