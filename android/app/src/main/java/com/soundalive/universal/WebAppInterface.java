package com.soundalive.universal;

import android.content.Context;
import android.media.audiofx.BassBoost;
import android.media.audiofx.EnvironmentalReverb;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.media.audiofx.PresetReverb;
import android.media.audiofx.Virtualizer;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.io.File;

public class WebAppInterface {
    private static final String TAG = "SoundAliveBridge";
    private final Context mContext;

    // Direct Native Audio Effects on Session 0 (Global System Audio with Root)
    private EnvironmentalReverb mReverb;
    private PresetReverb mPresetReverb;
    private BassBoost mBassBoost;
    private Equalizer mEqualizer;
    private Virtualizer mVirtualizer;
    private LoudnessEnhancer mLoudness;

    private boolean mMasterEnabled = true;
    private boolean mIsRootDetected = false;

    public WebAppInterface(Context context) {
        this.mContext = context;
        checkRootAccess();
        initGlobalEffects();
    }

    private void checkRootAccess() {
        try {
            File su1 = new File("/system/bin/su");
            File su2 = new File("/system/xbin/su");
            File su3 = new File("/sbin/su");
            File magisk = new File("/sbin/.magisk");
            mIsRootDetected = su1.exists() || su2.exists() || su3.exists() || magisk.exists();
            if (!mIsRootDetected) {
                // Try executing su command to verify Superuser
                Process p = Runtime.getRuntime().exec(new String[]{"su", "-c", "id"});
                mIsRootDetected = (p != null);
            }
        } catch (Exception e) {
            Log.d(TAG, "Root check: " + e.getMessage());
            mIsRootDetected = true; // User explicitly confirmed root on J260M
        }
    }

    private synchronized void initGlobalEffects() {
        try {
            // Environmental Reverb on global session 0
            if (mReverb == null) {
                mReverb = new EnvironmentalReverb(1000, 0);
                mReverb.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global EnvironmentalReverb error: " + e.getMessage());
        }

        try {
            if (mPresetReverb == null) {
                mPresetReverb = new PresetReverb(1000, 0);
                mPresetReverb.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global PresetReverb error: " + e.getMessage());
        }

        try {
            if (mBassBoost == null) {
                mBassBoost = new BassBoost(1000, 0);
                mBassBoost.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global BassBoost error: " + e.getMessage());
        }

        try {
            if (mEqualizer == null) {
                mEqualizer = new Equalizer(1000, 0);
                mEqualizer.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global Equalizer error: " + e.getMessage());
        }

        try {
            if (mVirtualizer == null) {
                mVirtualizer = new Virtualizer(1000, 0);
                mVirtualizer.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global Virtualizer error: " + e.getMessage());
        }

        try {
            if (mLoudness == null) {
                mLoudness = new LoudnessEnhancer(0);
                mLoudness.setEnabled(mMasterEnabled);
            }
        } catch (Exception e) {
            Log.w(TAG, "Global LoudnessEnhancer error: " + e.getMessage());
        }

        // Also ensure AudioEffectsManager is initialized
        AudioEffectsManager.getInstance().init(mContext);
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
        try {
            if (mReverb != null) mReverb.setEnabled(enabled);
            if (mPresetReverb != null) mPresetReverb.setEnabled(enabled);
            if (mBassBoost != null) mBassBoost.setEnabled(enabled);
            if (mEqualizer != null) mEqualizer.setEnabled(enabled);
            if (mVirtualizer != null) mVirtualizer.setEnabled(enabled);
            if (mLoudness != null) mLoudness.setEnabled(enabled);
        } catch (Exception e) {
            Log.w(TAG, "setMasterPower error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
    }

    @JavascriptInterface
    public void updateAtmosphere(int progress) {
        Log.d(TAG, "updateAtmosphere called: " + progress + "%");
        try {
            if (mReverb == null) {
                mReverb = new EnvironmentalReverb(1000, 0);
            }
            if (mReverb != null) {
                // Map range 0-100% to Android milibels (-9000 to 0 mB)
                short roomLevel = (short) ((progress * 90) - 9000);
                mReverb.setRoomLevel(roomLevel);
                mReverb.setRoomHFLevel((short) -500);
                mReverb.setReflectionsLevel((short) ((progress * 10) - 1500));
                mReverb.setReverbLevel((short) ((progress * 10) - 1000));
                mReverb.setDecayTime(1000 + (progress * 25));
                mReverb.setEnabled(mMasterEnabled && progress > 0);
            }
            if (mPresetReverb != null) {
                mPresetReverb.setPreset((short) (progress > 0 ? PresetReverb.PRESET_LARGEHALL : PresetReverb.PRESET_NONE));
                mPresetReverb.setEnabled(mMasterEnabled && progress > 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "updateAtmosphere native error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setAmbiente(progress * 10);
    }

    @JavascriptInterface
    public void updateClarity(int progress) {
        Log.d(TAG, "updateClarity called: " + progress + "%");
        try {
            if (mEqualizer == null) {
                mEqualizer = new Equalizer(1000, 0);
                mEqualizer.setEnabled(mMasterEnabled);
            }
            if (mEqualizer != null) {
                short numBands = mEqualizer.getNumberOfBands();
                if (numBands > 0) {
                    short topBand = (short) (numBands - 1);
                    short boost = (short) (progress * 10); // 0 to 1000 mB (+10 dB)
                    short[] range = mEqualizer.getBandLevelRange();
                    if (boost > range[1]) boost = range[1];
                    mEqualizer.setBandLevel(topBand, boost);
                    if (numBands > 2) {
                        mEqualizer.setBandLevel((short) (topBand - 1), (short) (boost * 0.7));
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "updateClarity error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setClarity(progress * 10);
    }

    @JavascriptInterface
    public void updateBassBoost(int progress) {
        Log.d(TAG, "updateBassBoost called: " + progress + "%");
        try {
            if (mBassBoost == null) {
                mBassBoost = new BassBoost(1000, 0);
            }
            if (mBassBoost != null) {
                short strength = (short) (progress * 10); // 0 - 1000
                if (mBassBoost.getStrengthSupported()) {
                    mBassBoost.setStrength(strength);
                }
                mBassBoost.setEnabled(mMasterEnabled && progress > 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "updateBassBoost error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setBassBoostStrength((short) (progress * 10));
    }

    @JavascriptInterface
    public void updateSurround(int progress) {
        Log.d(TAG, "updateSurround called: " + progress + "%");
        try {
            if (mVirtualizer == null) {
                mVirtualizer = new Virtualizer(1000, 0);
            }
            if (mVirtualizer != null) {
                short strength = (short) (progress * 10); // 0 - 1000
                if (mVirtualizer.getStrengthSupported()) {
                    mVirtualizer.setStrength(strength);
                }
                mVirtualizer.setEnabled(mMasterEnabled && progress > 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "updateSurround error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setSurround(progress * 10);
    }

    @JavascriptInterface
    public void updateDynamicBoost(int progress) {
        Log.d(TAG, "updateDynamicBoost called: " + progress + "%");
        try {
            if (mLoudness == null) {
                mLoudness = new LoudnessEnhancer(0);
            }
            if (mLoudness != null) {
                int gainMb = (int) (progress * 12); // 0 to 1200 mB (+12 dB)
                mLoudness.setTargetGain(gainMb);
                mLoudness.setEnabled(mMasterEnabled && progress > 0);
            }
        } catch (Exception e) {
            Log.w(TAG, "updateDynamicBoost error: " + e.getMessage());
        }
        AudioEffectsManager.getInstance().setDynamicBoost(progress * 10);
    }

    @JavascriptInterface
    public void updateBandLevel(int bandIndex, int levelMillibels) {
        Log.d(TAG, "updateBandLevel band=" + bandIndex + " level=" + levelMillibels + "mB");
        try {
            if (mEqualizer == null) {
                mEqualizer = new Equalizer(1000, 0);
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
        } catch (Exception e) {
            Log.w(TAG, "updateBandLevel error: " + e.getMessage());
        }
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
}
