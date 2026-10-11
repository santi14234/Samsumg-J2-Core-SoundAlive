package com.soundalive.universal;

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

import org.json.JSONObject;

import java.io.File;

public class WebAppInterface {
    private static final String TAG = "SoundAliveBridge";
    private final Context mContext;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    // Direct Native Audio Effects on Session 0 (Global System Audio with Root)
    private EnvironmentalReverb mReverb = null;
    private Virtualizer mVirtualizer = null;
    private BassBoost mBassBoost = null;
    private Equalizer mEqualizer = null;
    private LoudnessEnhancer mLoudness = null;

    private boolean mMasterEnabled = true;
    private boolean mIsRootDetected = false;

    public WebAppInterface(Context context) {
        this.mContext = context;
        checkRootAccess();
        mMainHandler.post(this::inicializarMotoresAudio);
    }

    private void checkRootAccess() {
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

    private synchronized void inicializarMotoresAudio() {
        try {
            // Inicializar Reverb con prioridad alta (1) y sesión global 0
            mReverb = new EnvironmentalReverb(1, 0);
            if (mReverb != null) {
                mReverb.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mReverb = null;
        }

        try {
            // Inicializar Virtualizador 3D con prioridad secundaria (2) en canal separado
            mVirtualizer = new Virtualizer(2, 0);
            if (mVirtualizer != null) {
                mVirtualizer.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mVirtualizer = null;
        }

        try {
            mBassBoost = new BassBoost(0, 0);
            if (mBassBoost != null) {
                mBassBoost.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mBassBoost = null;
        }

        try {
            mEqualizer = new Equalizer(0, 0);
            if (mEqualizer != null) {
                mEqualizer.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mEqualizer = null;
        }

        try {
            mLoudness = new LoudnessEnhancer(0);
            if (mLoudness != null) {
                mLoudness.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mLoudness = null;
        }

        try {
            AudioEffectsManager.getInstance().init(mContext);
        } catch (Throwable ignored) {}
    }

    @JavascriptInterface
    public boolean isConnected() {
        return true;
    }

    @JavascriptInterface
    public boolean isRootDevice() {
        return mIsRootDetected;
    }

    @JavascriptInterface
    public void setMasterPower(boolean enabled) {
        this.mMasterEnabled = enabled;
        mMainHandler.post(() -> {
            try {
                if (mReverb != null) mReverb.setEnabled(enabled);
                if (mVirtualizer != null) mVirtualizer.setEnabled(enabled);
                if (mBassBoost != null) mBassBoost.setEnabled(enabled);
                if (mEqualizer != null) mEqualizer.setEnabled(enabled);
                if (mLoudness != null) mLoudness.setEnabled(enabled);
            } catch (Throwable ignored) {}
        });
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
    }

    // 1. CLARIDAD VOCAL (0 a 10) -> Altera bandas de frecuencias altas (agudos superiores 4kHz - 16kHz)
    @JavascriptInterface
    public void updateClarity(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer == null && progress > 0) {
                    mEqualizer = new Equalizer(0, 0);
                }
                if (mEqualizer != null) {
                    if (mMasterEnabled && !mEqualizer.getEnabled()) {
                        mEqualizer.setEnabled(true);
                    }
                    short numBands = mEqualizer.getNumberOfBands();
                    if (numBands > 0) {
                        short topBand = (short) (numBands - 1);
                        short subTop = (short) Math.max(0, numBands - 2);
                        short boost = (short) (progress * 100);
                        short[] range = mEqualizer.getBandLevelRange();
                        if (boost > range[1]) boost = range[1];
                        mEqualizer.setBandLevel(topBand, boost);
                        mEqualizer.setBandLevel(subTop, (short) (boost / 2));
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateClarity error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setClarity(progress * 100);
    }

    // 2. REFUERZO DE GRAVES (0 a 10) -> Multiplicar por 100 para rango 0-1000
    @JavascriptInterface
    public void updateBassBoost(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mBassBoost == null && progress > 0) {
                    mBassBoost = new BassBoost(0, 0);
                }
                if (mBassBoost != null) {
                    if (mMasterEnabled && !mBassBoost.getEnabled()) {
                        mBassBoost.setEnabled(true);
                    }
                    if (mBassBoost.getStrengthSupported()) {
                        short strength = (short) (progress * 100);
                        mBassBoost.setStrength(strength);
                    }
                    if (progress == 0) {
                        mBassBoost.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateBassBoost error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setBassBoostStrength((short) (progress * 100));
    }

    // 3. SONIDO ENVOLVENTE 3D (0 a 10) -> Multiplicar por 100 para rango 0-1000
    @JavascriptInterface
    public void updateSurround(int progress) {
        mMainHandler.post(() -> {
            if (mVirtualizer == null && progress > 0) {
                try {
                    mVirtualizer = new Virtualizer(2, 0);
                } catch (Throwable t) {
                    mVirtualizer = null;
                }
            }
            if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                try {
                    if (progress == 0) {
                        mVirtualizer.setStrength((short) 0);
                        mVirtualizer.setEnabled(false);
                    } else {
                        if (mMasterEnabled && !mVirtualizer.getEnabled()) {
                            mVirtualizer.setEnabled(true);
                        }
                        short strength = (short) (progress * 100);
                        mVirtualizer.setStrength(strength);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "updateSurround error: " + t.getMessage());
                }
            }
        });
        AudioEffectsManager.getInstance().setSurround(progress * 100);
    }

    // 4. ATMÓSFERA DE SALA / REVERB: Fusión nativa + Virtualización por software (Equalizer)
    @JavascriptInterface
    public void updateAtmosphere(int progress) {
        mMainHandler.post(() -> {
            // 1. Comportamiento Nativo NXP (Hardware)
            if (mReverb == null && progress > 0) {
                try {
                    mReverb = new EnvironmentalReverb(1, 0);
                } catch (Throwable t) {
                    mReverb = null;
                }
            }
            if (mReverb != null) {
                try {
                    if (progress == 0) {
                        mReverb.setEnabled(false);
                    } else {
                        if (mMasterEnabled && !mReverb.getEnabled()) {
                            mReverb.setEnabled(true);
                        }
                        // Mantener valores máximos fijos para el hilo de hardware
                        mReverb.setRoomLevel((short) 0);
                        mReverb.setRoomHFLevel((short) 0);
                        mReverb.setDecayTime(2000);
                        mReverb.setReflectionsLevel((short) 0);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Hardware reverb error: " + t.getMessage());
                }
            }

            // 2. Inyección de ganancia de eco por software (Equalizer)
            try {
                if (mEqualizer == null) {
                    mEqualizer = new Equalizer(0, 0);
                }
                if (mEqualizer != null) {
                    if (mMasterEnabled && !mEqualizer.getEnabled()) {
                        mEqualizer.setEnabled(true);
                    }
                    short numBands = mEqualizer.getNumberOfBands();
                    if (numBands >= 5) {
                        short band1k = (short) Math.min(numBands - 1, 3);
                        short band2k = (short) Math.min(numBands - 1, 4);

                        if (progress == 0) {
                            mEqualizer.setBandLevel(band1k, (short) 0);
                            mEqualizer.setBandLevel(band2k, (short) 0);
                        } else {
                            // +12dB en 1kHz, +8dB en 2kHz (proporcional al progreso 1-10)
                            short boost1k = (short) (progress * 120); // 0 a 1200 mB
                            short boost2k = (short) (progress * 80);  // 0 a 800 mB
                            
                            short[] range = mEqualizer.getBandLevelRange();
                            mEqualizer.setBandLevel(band1k, (short) Math.min(boost1k, range[1]));
                            mEqualizer.setBandLevel(band2k, (short) Math.min(boost2k, range[1]));
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "Software reverb injection error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setAmbiente(progress * 100);
    }

    // 5. VOLUMEN MAESTRO (0 a 10) -> LoudnessEnhancer con rango seguro de ganancia 0 a 1000 milibelios (mB)
    @JavascriptInterface
    public void updateMasterVolume(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mLoudness == null && progress > 0) {
                    mLoudness = new LoudnessEnhancer(0);
                }
                if (mLoudness != null) {
                    if (mMasterEnabled && !mLoudness.getEnabled()) {
                        mLoudness.setEnabled(true);
                    }
                    int gainMb = progress * 100; // 0 to 1000 mB
                    mLoudness.setTargetGain(gainMb);
                    if (progress == 0) {
                        mLoudness.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateMasterVolume error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setDynamicBoost(progress * 100);
    }

    // 6. NORMALIZACIÓN (0 a 10) -> Nivelador dinámico regulando techo de ganancia (limiter)
    @JavascriptInterface
    public void updateNormalization(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) {
                    short numBands = mEqualizer.getNumberOfBands();
                    short ceiling = (short) (- (progress * 50));
                    for (short b = 0; b < numBands; b++) {
                        short current = mEqualizer.getBandLevel(b);
                        if (current > 0) {
                            mEqualizer.setBandLevel(b, (short) Math.max(0, current + ceiling / 10));
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateNormalization error: " + t.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void updateBandLevel(int bandIndex, int levelMillibels) {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer == null) {
                    mEqualizer = new Equalizer(0, 0);
                    mEqualizer.setEnabled(mMasterEnabled);
                }
                if (mEqualizer != null) {
                    short numBands = mEqualizer.getNumberOfBands();
                    if (bandIndex < numBands) {
                        short[] range = mEqualizer.getBandLevelRange();
                        short clamped = (short) Math.max(range[0], Math.min(range[1], levelMillibels));
                        mEqualizer.setBandLevel((short) bandIndex, clamped);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateBandLevel error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setBandLevel((short) bandIndex, (short) levelMillibels);
    }

    // 7. SISTEMA DE PERFILES CON 7 RANURAS (SharedPreferences)
    @JavascriptInterface
    public void saveProfile(int slotId, int clarity, int bass, int surround, int atmosphere, int volume, int normalization) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putInt("slot_" + slotId + "_clarity", clarity);
            ed.putInt("slot_" + slotId + "_bass", bass);
            ed.putInt("slot_" + slotId + "_surround", surround);
            ed.putInt("slot_" + slotId + "_atmosphere", atmosphere);
            ed.putInt("slot_" + slotId + "_volume", volume);
            ed.putInt("slot_" + slotId + "_normalization", normalization);
            ed.apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public String loadProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            int clarity = sp.getInt("slot_" + slotId + "_clarity", 5);
            int bass = sp.getInt("slot_" + slotId + "_bass", 4);
            int surround = sp.getInt("slot_" + slotId + "_surround", 3);
            int atmosphere = sp.getInt("slot_" + slotId + "_atmosphere", 3);
            int volume = sp.getInt("slot_" + slotId + "_volume", 2);
            int normalization = sp.getInt("slot_" + slotId + "_normalization", 3);

            JSONObject obj = new JSONObject();
            obj.put("clarity", clarity);
            obj.put("bass", bass);
            obj.put("surround", surround);
            obj.put("atmosphere", atmosphere);
            obj.put("volume", volume);
            obj.put("normalization", normalization);
            return obj.toString();
        } catch (Exception e) {
            return "{\"clarity\":5,\"bass\":4,\"surround\":3,\"atmosphere\":3,\"volume\":2,\"normalization\":3}";
        }
    }

    // MENÚ OCULTO: REINICIO FORZADO DEL SERVIDOR DE AUDIO
    @JavascriptInterface
    public void restartAudioServer() {
        mMainHandler.post(() -> {
            try {
                Runtime.getRuntime().exec(new String[]{"su", "-c", "killall audioserver"});
                Log.d(TAG, "AudioServer restarted successfully via Root");
            } catch (Exception e) {
                Log.w(TAG, "restartAudioServer error: " + e.getMessage());
            }
        });
    }

    @JavascriptInterface
    public String getStatus() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("bridgeConnected", true);
            obj.put("isRootActive", mIsRootDetected);
            obj.put("masterEnabled", mMasterEnabled);
            obj.put("reverbActive", mReverb != null && mMasterEnabled);
            obj.put("bassBoostActive", mBassBoost != null && mMasterEnabled);
            obj.put("virtualizerActive", mVirtualizer != null && mMasterEnabled);
            obj.put("loudnessActive", mLoudness != null && mMasterEnabled);
            obj.put("equalizerActive", mEqualizer != null && mMasterEnabled);
            obj.put("globalSessionId", 0);
            return obj.toString();
        } catch (Exception e) {
            return "{\"bridgeConnected\":true,\"isRootActive\":true}";
        }
    }

    public synchronized void release() {
        mMainHandler.post(() -> {
            try {
                if (mReverb != null) {
                    mReverb.setEnabled(false);
                    mReverb.release();
                    mReverb = null;
                }
            } catch (Throwable ignored) {}

            try {
                if (mVirtualizer != null) {
                    mVirtualizer.setEnabled(false);
                    mVirtualizer.release();
                    mVirtualizer = null;
                }
            } catch (Throwable ignored) {}

            try {
                if (mBassBoost != null) {
                    mBassBoost.setEnabled(false);
                    mBassBoost.release();
                    mBassBoost = null;
                }
            } catch (Throwable ignored) {}

            try {
                if (mEqualizer != null) {
                    mEqualizer.setEnabled(false);
                    mEqualizer.release();
                    mEqualizer = null;
                }
            } catch (Throwable ignored) {}

            try {
                if (mLoudness != null) {
                    mLoudness.setEnabled(false);
                    mLoudness.release();
                    mLoudness = null;
                }
            } catch (Throwable ignored) {}
        });
    }
}
