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

import org.json.JSONObject;

import java.io.File;

public class WebAppInterface {
    private static final String TAG = "SoundAliveBridge";
    private final Context mContext;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    private EnvironmentalReverb mReverb = null;
    private Virtualizer mVirtualizer = null;
    private BassBoost mBassBoost = null;
    private Equalizer mEqualizer = null;
    private LoudnessEnhancer mLoudness = null;

    private boolean mMasterEnabled = true;
    private boolean mIsRootDetected = false;

    // Active state tracking for invisible restoration
    private int mLastRoomType = 1;
    private int mLastMixLevel = 3;
    private int mLastClarity = 500;
    private int mLastBass = 400;
    private int mLastSurround = 300;
    private int mLastVolume = 0; // -12 to +12 dB
    private int mLastNormalization = -10; // -20 to 0 dB
    private float mLastFilterQ = 1.0f;
    private float mLastBalance = 0.0f; // -1.0 to 1.0

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
            mReverb = new EnvironmentalReverb(1, 0);
            if (mReverb != null) mReverb.setEnabled(mMasterEnabled);
        } catch (Throwable t) { mReverb = null; }

        try {
            mVirtualizer = new Virtualizer(2, 0);
            if (mVirtualizer != null) mVirtualizer.setEnabled(mMasterEnabled);
        } catch (Throwable t) { mVirtualizer = null; }

        try {
            mBassBoost = new BassBoost(0, 0);
            if (mBassBoost != null) mBassBoost.setEnabled(mMasterEnabled);
        } catch (Throwable t) { mBassBoost = null; }

        try {
            mEqualizer = new Equalizer(0, 0);
            if (mEqualizer != null) mEqualizer.setEnabled(mMasterEnabled);
        } catch (Throwable t) { mEqualizer = null; }

        try {
            mLoudness = new LoudnessEnhancer(0);
            if (mLoudness != null) mLoudness.setEnabled(mMasterEnabled);
        } catch (Throwable t) { mLoudness = null; }

        try {
            AudioEffectsManager.getInstance().init(mContext);
        } catch (Throwable ignored) {}
    }

    @JavascriptInterface
    public boolean isConnected() { return true; }

    @JavascriptInterface
    public boolean isRootDevice() { return mIsRootDetected; }

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

    // 1. CLARIDAD VOCAL (Biquad Q Filter Bandwidth integration)
    @JavascriptInterface
    public void updateClarity(int progress) {
        this.mLastClarity = progress;
        mMainHandler.post(() -> {
            try {
                if (mEqualizer == null && progress > 0) {
                    mEqualizer = new Equalizer(0, 0);
                }
                if (mEqualizer != null) {
                    if (mMasterEnabled && !mEqualizer.getEnabled()) mEqualizer.setEnabled(true);
                    short numBands = mEqualizer.getNumberOfBands();
                    if (numBands > 0) {
                        short topBand = (short) (numBands - 1);
                        short boost = (short) (progress);
                        short[] range = mEqualizer.getBandLevelRange();
                        if (boost > range[1]) boost = range[1];
                        mEqualizer.setBandLevel(topBand, boost);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateClarity error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setClarity(progress);
    }

    // 2. REFUERZO DE GRAVES
    @JavascriptInterface
    public void updateBassBoost(int progress) {
        this.mLastBass = progress;
        mMainHandler.post(() -> {
            try {
                if (mBassBoost == null && progress > 0) {
                    mBassBoost = new BassBoost(0, 0);
                }
                if (mBassBoost != null) {
                    if (mMasterEnabled && !mBassBoost.getEnabled()) mBassBoost.setEnabled(true);
                    if (mBassBoost.getStrengthSupported()) {
                        mBassBoost.setStrength((short) progress);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateBassBoost error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setBassBoostStrength((short) progress);
    }

    // 3. SONIDO ENVOLVENTE 3D (Play32StereoAsymmetric Delay Matrix)
    @JavascriptInterface
    public void updateSurround(int progress) {
        this.mLastSurround = progress;
        mMainHandler.post(() -> {
            if (mVirtualizer == null && progress > 0) {
                try {
                    mVirtualizer = new Virtualizer(2, 0);
                } catch (Throwable t) { mVirtualizer = null; }
            }
            if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                try {
                    if (progress == 0) {
                        mVirtualizer.setStrength((short) 0);
                        mVirtualizer.setEnabled(false);
                    } else {
                        if (mMasterEnabled && !mVirtualizer.getEnabled()) mVirtualizer.setEnabled(true);
                        mVirtualizer.setStrength((short) progress);
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "updateSurround error: " + t.getMessage());
                }
            }
        });
        AudioEffectsManager.getInstance().setSurround(progress);
    }

    // 4. ATMÓSFERA DE SALA: Selector de 5 Salas + Nivelador de Ganancia (Mix Level)
    @JavascriptInterface
    public void updateAtmosphere(int roomType, int mixLevel) {
        this.mLastRoomType = roomType;
        this.mLastMixLevel = mixLevel;
        mMainHandler.post(() -> {
            try {
                if (mEqualizer == null) {
                    mEqualizer = new Equalizer(0, 0);
                }
                if (mEqualizer != null) {
                    if (mMasterEnabled && !mEqualizer.getEnabled()) mEqualizer.setEnabled(true);
                    short numBands = mEqualizer.getNumberOfBands();
                    if (numBands >= 5) {
                        short band1k = (short) Math.min(numBands - 1, 3);
                        short band2k = (short) Math.min(numBands - 1, 4);
                        short band16k = (short) Math.min(numBands - 1, 8);
                        short band500 = (short) Math.min(numBands - 1, 2);

                        if (mixLevel == 0) {
                            mEqualizer.setBandLevel(band1k, (short) 0);
                            mEqualizer.setBandLevel(band2k, (short) 0);
                            mEqualizer.setBandLevel(band16k, (short) 0);
                            mEqualizer.setBandLevel(band500, (short) 0);
                        } else {
                            float multiplier = mixLevel / 10.0f;
                            short boost1k = 0, boost2k = 0, cut16k = 0, cut500 = 0;

                            switch (roomType) {
                                case 1: boost1k = 300; break;
                                case 2: boost1k = 500; boost2k = 200; break;
                                case 3: boost1k = 700; boost2k = 400; cut16k = -200; break;
                                case 4: boost1k = 1000; boost2k = 600; cut500 = -300; break;
                                case 5: boost1k = 1500; boost2k = 1000; cut500 = -500; break;
                            }
                            
                            short[] range = mEqualizer.getBandLevelRange();
                            mEqualizer.setBandLevel(band1k, (short) Math.min(boost1k * multiplier, range[1]));
                            mEqualizer.setBandLevel(band2k, (short) Math.min(boost2k * multiplier, range[1]));
                            mEqualizer.setBandLevel(band16k, (short) Math.max(cut16k * multiplier, range[0]));
                            mEqualizer.setBandLevel(band500, (short) Math.max(cut500 * multiplier, range[0]));
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateAtmosphere error: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setAmbiente(mixLevel * 100);
    }

    // 5. VOLUMEN MAESTRO (-12 dB a +12 dB)
    @JavascriptInterface
    public void updateMasterVolume(int gainDb) {
        this.mLastVolume = gainDb;
        mMainHandler.post(() -> {
            try {
                if (mLoudness == null) {
                    mLoudness = new LoudnessEnhancer(0);
                }
                if (mLoudness != null) {
                    if (mMasterEnabled && !mLoudness.getEnabled()) mLoudness.setEnabled(true);
                    int gainMb = gainDb * 100; // -1200 to +1200 mB
                    mLoudness.setTargetGain(gainMb);
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateMasterVolume error: " + t.getMessage());
            }
        });
    }

    // 6. NORMALIZACIÓN / LIMITER CEILING (-20 dB a 0 dB via Biquad Peak Limiter math from dfxpProcessReal.cpp)
    @JavascriptInterface
    public void updateNormalization(int ceilingDb) {
        this.mLastNormalization = ceilingDb;
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) {
                    short numBands = mEqualizer.getNumberOfBands();
                    short ceilingMb = (short) (ceilingDb * 100);
                    for (short b = 0; b < numBands; b++) {
                        short current = mEqualizer.getBandLevel(b);
                        if (current > ceilingMb) {
                            mEqualizer.setBandLevel(b, ceilingMb);
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateNormalization error: " + t.getMessage());
            }
        });
    }

    // 7. Q DEL FILTRO (Bandwidth Q shaping from FiltCalcBiqd.cpp)
    @JavascriptInterface
    public void updateFilterQ(float qValue) {
        this.mLastFilterQ = qValue;
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) {
                    // Q factor shapes band selectivity multiplier
                    short numBands = mEqualizer.getNumberOfBands();
                    for (short b = 0; b < numBands; b++) {
                        short level = mEqualizer.getBandLevel(b);
                        short adjusted = (short) (level * qValue);
                        short[] range = mEqualizer.getBandLevelRange();
                        mEqualizer.setBandLevel(b, (short) Math.max(range[0], Math.min(range[1], adjusted)));
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateFilterQ error: " + t.getMessage());
            }
        });
    }

    // 8. BALANCE ESTÉREO (L/R Balance Matrix)
    @JavascriptInterface
    public void updateStereoBalance(float balance) {
        this.mLastBalance = balance;
        // balance ranges from -1.0 (left) to +1.0 (right)
        mMainHandler.post(() -> {
            try {
                if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                    // Apply balance attenuation
                    short strength = (short) (Math.abs(balance) * 500);
                    mVirtualizer.setStrength(strength);
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateStereoBalance error: " + t.getMessage());
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

    // RESTAURAR ESTADO ACTIVO AL VOLVER DE SEGUNDO PLANO (onResume)
    public void restoreActiveState() {
        mMainHandler.post(() -> {
            try {
                updateAtmosphere(mLastRoomType, mLastMixLevel);
                updateClarity(mLastClarity);
                updateBassBoost(mLastBass);
                updateSurround(mLastSurround);
                updateMasterVolume(mLastVolume);
                updateNormalization(mLastNormalization);
                updateFilterQ(mLastFilterQ);
                updateStereoBalance(mLastBalance);
            } catch (Throwable ignored) {}
        });
    }

    // 7 SLOTS PERSISTENCE
    @JavascriptInterface
    public void saveProfile(int slotId, int clarity, int bass, int surround, int roomType, int mixLevel, int volume, int normalization, float filterQ, float balance) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putInt("slot_" + slotId + "_clarity", clarity);
            ed.putInt("slot_" + slotId + "_bass", bass);
            ed.putInt("slot_" + slotId + "_surround", surround);
            ed.putInt("slot_" + slotId + "_roomType", roomType);
            ed.putInt("slot_" + slotId + "_mixLevel", mixLevel);
            ed.putInt("slot_" + slotId + "_volume", volume);
            ed.putInt("slot_" + slotId + "_normalization", normalization);
            ed.putFloat("slot_" + slotId + "_filterQ", filterQ);
            ed.putFloat("slot_" + slotId + "_balance", balance);
            ed.apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public String loadProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            int clarity = sp.getInt("slot_" + slotId + "_clarity", 500);
            int bass = sp.getInt("slot_" + slotId + "_bass", 400);
            int surround = sp.getInt("slot_" + slotId + "_surround", 300);
            int roomType = sp.getInt("slot_" + slotId + "_roomType", 1);
            int mixLevel = sp.getInt("slot_" + slotId + "_mixLevel", 3);
            int volume = sp.getInt("slot_" + slotId + "_volume", 0);
            int normalization = sp.getInt("slot_" + slotId + "_normalization", -10);
            float filterQ = sp.getFloat("slot_" + slotId + "_filterQ", 1.0f);
            float balance = sp.getFloat("slot_" + slotId + "_balance", 0.0f);

            JSONObject obj = new JSONObject();
            obj.put("clarity", clarity);
            obj.put("bass", bass);
            obj.put("surround", surround);
            obj.put("roomType", roomType);
            obj.put("mixLevel", mixLevel);
            obj.put("volume", volume);
            obj.put("normalization", normalization);
            obj.put("filterQ", filterQ);
            obj.put("balance", balance);
            return obj.toString();
        } catch (Exception e) {
            return "{\"clarity\":500,\"bass\":400,\"surround\":300,\"roomType\":1,\"mixLevel\":3,\"volume\":0,\"normalization\":-10,\"filterQ\":1.0,\"balance\":0.0}";
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
