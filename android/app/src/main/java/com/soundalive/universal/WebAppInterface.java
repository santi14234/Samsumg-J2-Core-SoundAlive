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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

public class WebAppInterface {
    private static final String TAG = "SoundAliveBridge";
    private final Context mContext;
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    // Native Audio Effects on Global Sessions (Session 0 & 121 for DAC/ZXTune & System)
    private EnvironmentalReverb mReverb = null;
    private Virtualizer mVirtualizer = null;
    private BassBoost mBassBoost = null;
    private Equalizer mEqualizer = null;
    private LoudnessEnhancer mLoudness = null;

    private boolean mMasterEnabled = true;
    private boolean mIsRootDetected = false;

    // Track user gains separately from acoustic room offsets
    private final short[] mUserGainsMb = new short[]{0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    private final float[] mUserBandQs = new float[]{1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f};

    // State variables
    private int mCurrentRoomType = 4; // Default to Arena/Catedral for high impact
    private int mReverbMix = 5; // 0 to 10
    private int mMasterVolumeGainMb = 0; // Loudness mb
    private int mLimiterThresholdDb = -3; // -20 to 0
    private int mFilterQ = 10;
    private int mBalance = 0;

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
            mEqualizer = new Equalizer(1000, 0); // High priority on Session 0
            if (mEqualizer != null) {
                mEqualizer.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            try {
                mEqualizer = new Equalizer(0, 0);
                if (mEqualizer != null) mEqualizer.setEnabled(mMasterEnabled);
            } catch (Throwable ignored) {
                mEqualizer = null;
            }
        }

        try {
            mReverb = new EnvironmentalReverb(1000, 0);
            if (mReverb != null) {
                mReverb.setEnabled(mMasterEnabled);
            }
        } catch (Throwable t) {
            mReverb = null;
        }

        try {
            mVirtualizer = new Virtualizer(1000, 0);
            if (mVirtualizer != null) {
                mVirtualizer.setEnabled(mMasterEnabled);
                if (mVirtualizer.getStrengthSupported()) {
                    mVirtualizer.setStrength((short) 500);
                }
            }
        } catch (Throwable t) {
            mVirtualizer = null;
        }

        try {
            mBassBoost = new BassBoost(1000, 0);
            if (mBassBoost != null) {
                mBassBoost.setEnabled(mMasterEnabled);
                if (mBassBoost.getStrengthSupported()) {
                    mBassBoost.setStrength((short) 650);
                }
            }
        } catch (Throwable t) {
            mBassBoost = null;
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

        // Apply initial acoustic room & user gains
        applyAllBands();
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
    public String getDeviceModel() {
        return "Samsung Galaxy J2 Core (SM-J260M)";
    }

    @JavascriptInterface
    public int getActiveAudioSession() {
        return 121;
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

    @JavascriptInterface
    public void setFxsoundMode(boolean enabled) {
        // Boost warmth and clarity harmonics
        if (enabled) {
            updateClarity(70);
            updateBassBoost(65);
            updateSurround(50);
        }
    }

    /**
     * 10-Band Equalizer updates with exact millibels (-1200 to +1200 mB)
     */
    @JavascriptInterface
    public void updateEqualizerBand(int bandIndex, int gainDb) {
        if (bandIndex >= 0 && bandIndex < mUserGainsMb.length) {
            mUserGainsMb[bandIndex] = (short) (gainDb * 100);
        }
        applyAllBands();
        AudioEffectsManager.getInstance().setBandLevel((short) bandIndex, (short) (gainDb * 100));
    }

    @JavascriptInterface
    public void updateBandLevel(int bandIndex, int levelMillibels) {
        if (bandIndex >= 0 && bandIndex < mUserGainsMb.length) {
            mUserGainsMb[bandIndex] = (short) levelMillibels;
        }
        applyAllBands();
        AudioEffectsManager.getInstance().setBandLevel((short) bandIndex, (short) levelMillibels);
    }

    @JavascriptInterface
    public void updateBandQ(int bandIndex, float qValue) {
        if (bandIndex >= 0 && bandIndex < mUserBandQs.length) {
            mUserBandQs[bandIndex] = qValue;
        }
        Log.d(TAG, "Band " + bandIndex + " Q updated to: " + qValue + "x");
    }

    @JavascriptInterface
    public void resetEqualizer() {
        for (int i = 0; i < mUserGainsMb.length; i++) {
            mUserGainsMb[i] = 0;
            mUserBandQs[i] = 1.0f;
        }
        applyAllBands();
    }

    /**
     * ATMOSPHERE & HARDWARE EQUALIZER REVERB INJECTION:
     * Directly injects Room Acoustic Profiles onto the Equalizer hardware classes
     * for Session 0 & Session 121 (ZXTune DAC).
     *
     * Room Types (0 to 4 or 1 to 5):
     *  - Sala 1 (Estudio): 1kHz +3 dB (300 mB)
     *  - Sala 2 (Habitación): 1kHz +5 dB (500 mB), 2kHz +2 dB (200 mB)
     *  - Sala 3 (Estadio Pro): 1kHz +7 dB (700 mB), 2kHz +4 dB (400 mB), 16kHz -2 dB (-200 mB)
     *  - Sala 4 (Auditorio): 1kHz +10 dB (1000 mB), 2kHz +6 dB (600 mB), 500Hz -3 dB (-300 mB)
     *  - Sala 5 (Catedral/Arena): 1kHz +15 dB (1500 mB), 2kHz +10 dB (1000 mB), 500Hz -5 dB (-500 mB)
     *
     * Multiplied by reverbMix (0 to 10 or 0 to 100).
     */
    @JavascriptInterface
    public void updateAtmosphere(int roomType, int reverbMix) {
        this.mCurrentRoomType = roomType;
        // Normalize reverbMix to 0-10 if passed as 0-100
        if (reverbMix > 10) {
            this.mReverbMix = Math.round(reverbMix / 10.0f);
        } else {
            this.mReverbMix = reverbMix;
        }

        applyAllBands();

        // Also drive the EnvironmentalReverb hardware layer if active
        mMainHandler.post(() -> {
            try {
                if (mReverb != null) {
                    if (mReverbMix > 0 && mMasterEnabled) {
                        mReverb.setEnabled(true);
                        // Scale room and decay
                        mReverb.setRoomLevel((short) (-3800 + (mReverbMix * 380)));
                        mReverb.setRoomHFLevel((short) (-2000 + (mReverbMix * 200)));
                        mReverb.setDecayTime((int) (1000 + (mReverbMix * 400)));
                        mReverb.setDecayHFRatio((short) (500 + (mCurrentRoomType * 150)));
                        mReverb.setReverbLevel((short) (-2500 + (mReverbMix * 250)));
                    } else {
                        mReverb.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "Hardware Reverb: " + t.getMessage());
            }
        });

        AudioEffectsManager.getInstance().setAmbiente(this.mReverbMix * 100);
    }

    @JavascriptInterface
    public void updateAtmosphere(int progress) {
        updateAtmosphere(mCurrentRoomType, progress);
    }

    /**
     * Compute compound band levels: User Gain + Room Acoustic Gain (scaled by mix)
     */
    private synchronized void applyAllBands() {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer == null) {
                    try {
                        mEqualizer = new Equalizer(1000, 0);
                        mEqualizer.setEnabled(mMasterEnabled);
                    } catch (Throwable t) {
                        mEqualizer = new Equalizer(0, 0);
                        mEqualizer.setEnabled(mMasterEnabled);
                    }
                }

                if (mEqualizer != null) {
                    if (mMasterEnabled && !mEqualizer.getEnabled()) {
                        mEqualizer.setEnabled(true);
                    }

                    short numBands = mEqualizer.getNumberOfBands();
                    short[] range = mEqualizer.getBandLevelRange(); // e.g. [-1500, 1500]

                    // Calculate Room Acoustic Offsets
                    float mixRatio = Math.max(0.0f, Math.min(1.0f, mReverbMix / 10.0f));
                    short room1k = 0;
                    short room2k = 0;
                    short room16k = 0;
                    short room500 = 0;

                    // Support 0-indexed (0 to 4) or 1-indexed (1 to 5)
                    int room = (mCurrentRoomType >= 0 && mCurrentRoomType <= 4) ? (mCurrentRoomType + 1) : mCurrentRoomType;

                    if (mixRatio > 0) {
                        switch (room) {
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
                            case 5: // Sala 5 (Catedral/Arena) - Saturación armónica extrema
                            default:
                                room1k = (short) (1500 * mixRatio); // +15 dB (1500 mB)
                                room2k = (short) (1000 * mixRatio); // +10 dB (1000 mB)
                                room500 = (short) (-500 * mixRatio); // -5 dB (-500 mB)
                                break;
                        }
                    }

                    // Map 10 bands or clamp to available hardware bands
                    // Typically: 0=60Hz, 1=230Hz, 2=910Hz (~1kHz), 3=3.6kHz (~2k-4k), 4=14kHz (~16k)
                    // Or for 10 bands: 0:41Hz, 1:63Hz, 2:125Hz, 3:250Hz, 4:500Hz, 5:1kHz, 6:2kHz, 7:4kHz, 8:8kHz, 9:16kHz
                    for (short b = 0; b < numBands; b++) {
                        short totalMb = 0;
                        if (numBands == 10) {
                            totalMb = mUserGainsMb[b];
                            if (b == 4) totalMb += room500;
                            if (b == 5) totalMb += room1k;
                            if (b == 6) totalMb += room2k;
                            if (b == 9) totalMb += room16k;
                        } else if (numBands == 5) {
                            // Standard 5-band Equalizer on Exynos / NXP
                            if (b == 0) totalMb = (short) ((mUserGainsMb[0] + mUserGainsMb[1]) / 2);
                            if (b == 1) totalMb = (short) ((mUserGainsMb[2] + mUserGainsMb[3]) / 2);
                            if (b == 2) totalMb = (short) (mUserGainsMb[4] + room500); // ~500Hz
                            if (b == 3) totalMb = (short) (mUserGainsMb[5] + room1k + room2k); // 1k-2k
                            if (b == 4) totalMb = (short) (mUserGainsMb[9] + room16k); // Treble
                        } else {
                            if (b < mUserGainsMb.length) {
                                totalMb = mUserGainsMb[b];
                            }
                        }

                        // Apply Q factor shaping if amplified
                        float q = (b < mUserBandQs.length) ? mUserBandQs[b] : 1.0f;
                        if (totalMb > 0) {
                            totalMb = (short) (totalMb * Math.min(1.3f, q));
                        }

                        // Clamp strictly to range supported by DSP
                        short clamped = (short) Math.max(range[0], Math.min(range[1], totalMb));
                        mEqualizer.setBandLevel(b, clamped);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "applyAllBands: " + t.getMessage());
            }
        });
    }

    /**
     * Master Volume (Loudness Enhancement / Digital Preamp)
     */
    @JavascriptInterface
    public void updateMasterVolume(int volumeDbOrPercent) {
        // Can be passed as -12 to +12 dB or 0 to 100%
        int gainMb = 0;
        if (volumeDbOrPercent >= -12 && volumeDbOrPercent <= 12) {
            gainMb = Math.max(0, volumeDbOrPercent * 100);
        } else {
            gainMb = volumeDbOrPercent * 20; // 0-100 -> 0-2000 mB
        }
        this.mMasterVolumeGainMb = gainMb;

        final int targetMb = gainMb;
        mMainHandler.post(() -> {
            try {
                if (mLoudness == null && targetMb > 0) {
                    mLoudness = new LoudnessEnhancer(0);
                }
                if (mLoudness != null) {
                    if (mMasterEnabled && !mLoudness.getEnabled()) {
                        mLoudness.setEnabled(true);
                    }
                    mLoudness.setTargetGain(targetMb);
                    if (targetMb == 0) {
                        mLoudness.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateMasterVolume: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setDynamicBoost(volumeDbOrPercent);
    }

    /**
     * Peak Limiter / Dynamic Normalization Threshold (-20 dB to 0 dB)
     */
    @JavascriptInterface
    public void updateLimiter(int thresholdDb) {
        this.mLimiterThresholdDb = thresholdDb;
        updateNormalization(Math.abs(thresholdDb));
    }

    @JavascriptInterface
    public void updateNormalization(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null) {
                    // Soft compression curve on excess peaks
                    short[] range = mEqualizer.getBandLevelRange();
                    short maxPeak = (short) (range[1] - (progress * 40));
                    short numBands = mEqualizer.getNumberOfBands();
                    for (short b = 0; b < numBands; b++) {
                        short lvl = mEqualizer.getBandLevel(b);
                        if (lvl > maxPeak) {
                            mEqualizer.setBandLevel(b, maxPeak);
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateNormalization: " + t.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void updateDeepBass(int progress) {
        updateBassBoost(progress);
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
                        short strength = (short) (progress * 10); // 0-100 -> 0-1000
                        mBassBoost.setStrength(strength);
                    }
                    if (progress == 0) {
                        mBassBoost.setEnabled(false);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateBassBoost: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setBassBoostStrength((short) (progress * 10));
    }

    @JavascriptInterface
    public void updateClarity(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mEqualizer != null && mMasterEnabled) {
                    short numBands = mEqualizer.getNumberOfBands();
                    if (numBands > 0) {
                        short topBand = (short) (numBands - 1);
                        short boost = (short) (progress * 8); // +0 to +800 mB
                        short[] range = mEqualizer.getBandLevelRange();
                        boost = (short) Math.min(range[1], boost);
                        mEqualizer.setBandLevel(topBand, boost);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateClarity: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setClarity(progress);
    }

    @JavascriptInterface
    public void updateSurround(int progress) {
        mMainHandler.post(() -> {
            try {
                if (mVirtualizer == null && progress > 0) {
                    mVirtualizer = new Virtualizer(0, 0);
                }
                if (mVirtualizer != null && mVirtualizer.getStrengthSupported()) {
                    if (progress == 0) {
                        mVirtualizer.setStrength((short) 0);
                        mVirtualizer.setEnabled(false);
                    } else {
                        if (mMasterEnabled && !mVirtualizer.getEnabled()) {
                            mVirtualizer.setEnabled(true);
                        }
                        short strength = (short) (progress * 10);
                        mVirtualizer.setStrength(strength);
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "updateSurround: " + t.getMessage());
            }
        });
        AudioEffectsManager.getInstance().setSurround(progress);
    }

    @JavascriptInterface
    public void updateFilterQ(int progress) {
        this.mFilterQ = progress;
    }

    @JavascriptInterface
    public void updateBalance(int progress) {
        this.mBalance = progress;
    }

    /**
     * Persistent Profile Storage (P1 to P7) in SharedPreferences
     */
    @JavascriptInterface
    public void saveProfile(int slotId, int clarity, int bass, int surround, int roomType, int mixLevel, int volume, int normalization, String bandQsJson) {
        saveCurrentProfile(slotId);
    }

    @JavascriptInterface
    public void saveCurrentProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();

            JSONArray gainsArr = new JSONArray();
            for (short g : mUserGainsMb) {
                gainsArr.put(g / 100); // in dB
            }
            JSONArray qsArr = new JSONArray();
            for (float q : mUserBandQs) {
                qsArr.put((double) q);
            }

            ed.putString("slot_" + slotId + "_gains", gainsArr.toString());
            ed.putString("slot_" + slotId + "_qs", qsArr.toString());
            ed.putInt("slot_" + slotId + "_roomType", mCurrentRoomType);
            ed.putInt("slot_" + slotId + "_mixLevel", mReverbMix);
            ed.putInt("slot_" + slotId + "_volume", mMasterVolumeGainMb / 100);
            ed.putInt("slot_" + slotId + "_limiter", mLimiterThresholdDb);
            ed.putInt("slot_" + slotId + "_balance", mBalance);
            ed.apply();

            Log.d(TAG, "Profile P" + slotId + " successfully persisted to SharedPreferences");
        } catch (Exception e) {
            Log.e(TAG, "saveCurrentProfile: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public String loadProfile(int slotId) {
        try {
            SharedPreferences sp = mContext.getSharedPreferences("SoundAliveSlots", Context.MODE_PRIVATE);
            String gainsStr = sp.getString("slot_" + slotId + "_gains", "[0,0,0,0,0,0,0,0,0,0]");
            String qsStr = sp.getString("slot_" + slotId + "_qs", "[1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0]");
            int roomType = sp.getInt("slot_" + slotId + "_roomType", 4);
            int mixLevel = sp.getInt("slot_" + slotId + "_mixLevel", 5);
            int volume = sp.getInt("slot_" + slotId + "_volume", 0);
            int limiter = sp.getInt("slot_" + slotId + "_limiter", -3);
            int balance = sp.getInt("slot_" + slotId + "_balance", 0);

            // Restore in-memory values
            JSONArray gArr = new JSONArray(gainsStr);
            for (int i = 0; i < Math.min(gArr.length(), mUserGainsMb.length); i++) {
                mUserGainsMb[i] = (short) (gArr.getInt(i) * 100);
            }
            JSONArray qArr = new JSONArray(qsStr);
            for (int i = 0; i < Math.min(qArr.length(), mUserBandQs.length); i++) {
                mUserBandQs[i] = (float) qArr.getDouble(i);
            }
            mCurrentRoomType = roomType;
            mReverbMix = mixLevel;
            mMasterVolumeGainMb = volume * 100;
            mLimiterThresholdDb = limiter;
            mBalance = balance;

            applyAllBands();

            JSONObject obj = new JSONObject();
            obj.put("gains", gArr);
            obj.put("qValues", qArr);
            obj.put("roomType", roomType);
            obj.put("mixLevel", mixLevel);
            obj.put("volume", volume);
            obj.put("limiter", limiter);
            obj.put("balance", balance);
            return obj.toString();
        } catch (Exception e) {
            return "{\"gains\":[0,0,0,0,0,0,0,0,0,0],\"roomType\":4,\"mixLevel\":5}";
        }
    }

    @JavascriptInterface
    public void restartAudioServer() {
        mMainHandler.post(() -> {
            try {
                Runtime.getRuntime().exec(new String[]{"su", "-c", "killall audioserver; media volume --stream 3 --set 10"});
                Log.d(TAG, "AudioServer restarted via Root");
            } catch (Exception e) {
                Log.w(TAG, "restartAudioServer: " + e.getMessage());
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
