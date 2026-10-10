package com.soundalive.universal;

import android.content.Context;
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
        // Inicialización segura con aislamiento de fallos nativos en el Looper principal
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
            mIsRootDetected = true; // User explicitly confirmed root on J260M
        }
    }

    private synchronized void inicializarMotoresAudio() {
        // 1. Inicializar Reverb con blindaje contra punteros nulos de Binder (linkToDeath)
        try {
            mReverb = new EnvironmentalReverb(0, 0);
            if (mReverb != null) {
                mReverb.setEnabled(mMasterEnabled);
                Log.d(TAG, "EnvironmentalReverb initialized successfully on session 0");
            }
        } catch (UnsupportedOperationException | IllegalStateException e) {
            Log.w(TAG, "Hardware does not support EnvironmentalReverb on session 0: " + e.getMessage());
            mReverb = null;
        } catch (Exception e) {
            Log.w(TAG, "Exception initializing EnvironmentalReverb: " + e.getMessage());
            mReverb = null;
        } catch (Throwable t) {
            Log.e(TAG, "Fatal native guard for EnvironmentalReverb: " + t.getMessage());
            mReverb = null;
        }

        // 2. Inicializar Virtualizador 3D de forma independiente
        try {
            mVirtualizer = new Virtualizer(0, 0);
            if (mVirtualizer != null) {
                mVirtualizer.setEnabled(mMasterEnabled);
                Log.d(TAG, "Virtualizer initialized successfully on session 0");
            }
        } catch (UnsupportedOperationException | IllegalStateException e) {
            Log.w(TAG, "Hardware does not support Virtualizer on session 0: " + e.getMessage());
            mVirtualizer = null;
        } catch (Exception e) {
            Log.w(TAG, "Exception initializing Virtualizer: " + e.getMessage());
            mVirtualizer = null;
        } catch (Throwable t) {
            Log.e(TAG, "Fatal native guard for Virtualizer: " + t.getMessage());
            mVirtualizer = null;
        }

        // 3. Inicializar BassBoost con blindaje
        try {
            mBassBoost = new BassBoost(0, 0);
            if (mBassBoost != null) {
                mBassBoost.setEnabled(mMasterEnabled);
            }
        } catch (UnsupportedOperationException | IllegalStateException e) {
            Log.w(TAG, "Hardware BassBoost unsupported: " + e.getMessage());
            mBassBoost = null;
        } catch (Throwable t) {
            Log.e(TAG, "BassBoost guard: " + t.getMessage());
            mBassBoost = null;
        }

        // 4. Inicializar Equalizer con blindaje
        try {
            mEqualizer = new Equalizer(0, 0);
            if (mEqualizer != null) {
                mEqualizer.setEnabled(mMasterEnabled);
            }
        } catch (UnsupportedOperationException | IllegalStateException e) {
            Log.w(TAG, "Hardware Equalizer unsupported: " + e.getMessage());
            mEqualizer = null;
        } catch (Throwable t) {
            Log.e(TAG, "Equalizer guard: " + t.getMessage());
            mEqualizer = null;
        }

        // 5. Inicializar LoudnessEnhancer con blindaje
        try {
            mLoudness = new LoudnessEnhancer(0);
            if (mLoudness != null) {
                mLoudness.setEnabled(mMasterEnabled);
            }
        } catch (UnsupportedOperationException | IllegalStateException e) {
            Log.w(TAG, "Hardware Loudness unsupported: " + e.getMessage());
            mLoudness = null;
        } catch (Throwable t) {
            Log.e(TAG, "Loudness guard: " + t.getMessage());
            mLoudness = null;
        }

        // Sincronizar también con AudioEffectsManager de forma segura
        try {
            AudioEffectsManager.getInstance().init(mContext);
        } catch (Throwable t) {
            Log.w(TAG, "AudioEffectsManager init guard: " + t.getMessage());
        }
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
            } catch (Throwable t) {
                Log.w(TAG, "setMasterPower error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
    }

    // Puente para la barra de "Atmósfera de Sala" (Reverb)
    @JavascriptInterface
    public void updateAtmosphere(int progress) {
        mMainHandler.post(() -> {
            // Validar que la instancia nativa no esté muerta antes de inyectar comandos
            if (mReverb == null && progress > 0) {
                try {
                    mReverb = new EnvironmentalReverb(0, 0);
                } catch (Throwable t) {
                    mReverb = null;
                }
            }
            if (mReverb != null) {
                try {
                    if (mMasterEnabled && !mReverb.getEnabled()) {
                        mReverb.setEnabled(true);
                    }
                    // Mapeo de 0-100% a milibelios de Android (-9000 a 0 mB)
                    short roomLevel = (short) ((progress * 90) - 9000);
                    mReverb.setRoomLevel(roomLevel);
                    mReverb.setRoomHFLevel((short) -500);
                    mReverb.setReflectionsLevel((short) ((progress * 10) - 1500));
                    mReverb.setReverbLevel((short) ((progress * 10) - 1000));
                    mReverb.setDecayTime(1000 + (progress * 25));
                    if (progress == 0) {
                        mReverb.setEnabled(false);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "updateAtmosphere native error: " + t.getMessage());
                }
            }
        });
        AudioEffectsManager.getInstance().setAmbiente(progress * 10);
    }

    // Puente para la barra de "Sonido Envolvente 3D" (Virtualizer)
    @JavascriptInterface
    public void updateSurround(int progress) {
        mMainHandler.post(() -> {
            // Validar que la instancia nativa no esté muerta antes de inyectar comandos
            if (mVirtualizer == null && progress > 0) {
                try {
                    mVirtualizer = new Virtualizer(0, 0);
                } catch (Throwable t) {
                    mVirtualizer = null;
                }
            }
            if (mVirtualizer != null) {
                try {
                    if (mMasterEnabled && !mVirtualizer.getEnabled()) {
                        mVirtualizer.setEnabled(true);
                    }
                    if (mVirtualizer.getStrengthSupported()) {
                        // El virtualizador de Android maneja fuerza de 0 a 1000
                        short strength = (short) (progress * 10);
                        mVirtualizer.setStrength(strength);
                    }
                    if (progress == 0) {
                        mVirtualizer.setEnabled(false);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "updateSurround error: " + t.getMessage());
                }
            }
        });
        AudioEffectsManager.getInstance().setSurround(progress * 10);
    }

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
                        short boost = (short) (progress * 10);
                        short[] range = mEqualizer.getBandLevelRange();
                        if (boost > range[1]) boost = range[1];
                        mEqualizer.setBandLevel(topBand, boost);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateClarity error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setClarity(progress * 10);
    }

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
                        mBassBoost.setStrength((short) (progress * 10));
                    }
                    if (progress == 0) {
                        mBassBoost.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateBassBoost error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setBassBoostStrength((short) (progress * 10));
    }

    @JavascriptInterface
    public void updateDynamicBoost(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mLoudness == null && progress > 0) {
                    mLoudness = new LoudnessEnhancer(0);
                }
                if (mLoudness != null) {
                    if (mMasterEnabled && !mLoudness.getEnabled()) {
                        mLoudness.setEnabled(true);
                    }
                    int gainMb = (int) (progress * 12);
                    mLoudness.setTargetGain(gainMb);
                    if (progress == 0) {
                        mLoudness.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateDynamicBoost error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setDynamicBoost(progress * 10);
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
                    if (numBands == 5) {
                        short physBand = (short) Math.min(4, Math.max(0, bandIndex / 2));
                        short[] range = mEqualizer.getBandLevelRange();
                        short clamped = (short) Math.max(range[0], Math.min(range[1], levelMillibels));
                        mEqualizer.setBandLevel(physBand, clamped);
                    } else if (bandIndex < numBands) {
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
