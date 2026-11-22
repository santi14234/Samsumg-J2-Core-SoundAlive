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
        // Un solo dueno de los efectos: AudioEffectsManager (antes habia un segundo juego
        // de Equalizer/BassBoost/Virtualizer/Reverb/Loudness en sesion 0 que se pisaba con este).
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
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
    }

    private int mLastRoomType = 1;
    private int mLastReverbMix = 3;

    // 1. CLARIDAD VOCAL (0 a 10)
    @JavascriptInterface
    public void updateClarity(int progress) {
        AudioEffectsManager.getInstance().setClarity(progress * 100);
    }

    // 2. REFUERZO DE GRAVES (0 a 10)
    @JavascriptInterface
    public void updateBassBoost(int progress) {
        AudioEffectsManager.getInstance().setBassBoostStrength((short) (progress * 100));
    }

    // 3. SONIDO ENVOLVENTE 3D (0 a 10)
    @JavascriptInterface
    public void updateSurround(int progress) {
        AudioEffectsManager.getInstance().setSurround(progress * 100);
    }

    // 4. ATMOSFERA DE SALA (sala 1-5) + MIX del reverb (0 a 10)
    @JavascriptInterface
    public void updateAtmosphere(int roomType, int reverbMix) {
        mLastRoomType = roomType;
        mLastReverbMix = reverbMix;
        AudioEffectsManager.getInstance().setAmbiente(reverbMix * 100, roomType);
    }

    // La app llama a updateAtmosphere con 1 solo argumento al encender (App.tsx); sin esta
    // version el WebView lanzaba error y se saltaba el volumen y la normalizacion.
    @JavascriptInterface
    public void updateAtmosphere(int roomType) {
        updateAtmosphere(roomType, mLastReverbMix);
    }

    // 5. VOLUMEN MAESTRO (0 a 10) -> ganancia general
    @JavascriptInterface
    public void updateMasterVolume(int progress) {
        AudioEffectsManager.getInstance().setDynamicBoost(progress * 100);
    }

    // 6. NORMALIZACION DINAMICA (0 a 10) -> sube la ganancia de TODO (efectos incluidos)
    @JavascriptInterface
    public void updateNormalization(int progress) {
        AudioEffectsManager.getInstance().setNormalization(progress * 100);
    }

    // 7. NIVEL EN dB DE CADA SALA DEL REVERB (sala 1-5, -12 a +12 dB)
    @JavascriptInterface
    public void updateRoomLevel(int room, int db) {
        AudioEffectsManager.getInstance().setRoomLevelDb(room, db);
    }

    @JavascriptInterface
    public void updateBandLevel(int bandIndex, int levelMillibels) {
        AudioEffectsManager.getInstance().setBandLevel((short) bandIndex, (short) levelMillibels);
    }

    // 7. SISTEMA DE PERFILES CON 7 RANURAS (SharedPreferences)
    @JavascriptInterface
    public void saveProfile(int slotId, int clarity, int bass, int surround, int roomType, int mixLevel, int volume, int normalization) {
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
            int roomType = sp.getInt("slot_" + slotId + "_roomType", 1);
            int mixLevel = sp.getInt("slot_" + slotId + "_mixLevel", 3);
            int volume = sp.getInt("slot_" + slotId + "_volume", 2);
            int normalization = sp.getInt("slot_" + slotId + "_normalization", 3);

            JSONObject obj = new JSONObject();
            obj.put("clarity", clarity);
            obj.put("bass", bass);
            obj.put("surround", surround);
            obj.put("roomType", roomType);
            obj.put("mixLevel", mixLevel);
            obj.put("volume", volume);
            obj.put("normalization", normalization);
            return obj.toString();
        } catch (Exception e) {
            return "{\"clarity\":5,\"bass\":4,\"surround\":3,\"roomType\":1,\"mixLevel\":3,\"volume\":2,\"normalization\":3}";
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
            obj.put("reverbActive", mMasterEnabled);
            obj.put("bassBoostActive", mMasterEnabled);
            obj.put("virtualizerActive", mMasterEnabled);
            obj.put("loudnessActive", mMasterEnabled);
            obj.put("equalizerActive", mMasterEnabled);
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
