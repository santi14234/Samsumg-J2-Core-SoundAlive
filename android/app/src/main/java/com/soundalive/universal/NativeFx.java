package com.soundalive.universal;

import android.media.audiofx.AudioEffect;
import android.os.SystemClock;
import android.util.Log;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Control del efecto nativo "SoundAlive FX" (libsoundalivefx.so, instalada con el modulo de Magisk).
 * Si el modulo no esta instalado, isAvailable() devuelve false y la app usa los efectos de Android.
 */
final class NativeFx {
    private static final String TAG = "SoundAliveNativeFx";

    // Deben coincidir con native/src/sa_effect.cpp
    static final UUID TYPE_UUID = UUID.fromString("38a1fa16-28f5-4722-854c-6ec84e47cd75");
    static final UUID IMPL_UUID = UUID.fromString("ef230063-a7ba-4053-9693-fa277d87535a");

    static final int P_EQ_BAND = 1;       // {1, banda 0..9}  mB
    static final int P_EQ_ENABLE = 2;     // 0/1
    static final int P_SURROUND = 3;      // 0..1000
    static final int P_WET_MB = 4;        // mB, <= -9000 apaga el ambiente
    static final int P_ROOM = 5;          // 1..5
    static final int P_POST_GAIN_MB = 6;  // mB
    static final int P_LIMITER = 7;       // 0/1
    static final int P_MODULATION = 8;    // 0..1000
    static final int P_WIDTH = 9;         // 0..1000

    private static Boolean available = null;
    private static long lastCheck = 0;

    /** Revisa si Android tiene registrado el efecto (se repite cada 30 s mientras no exista). */
    static synchronized boolean isAvailable() {
        long now = SystemClock.elapsedRealtime();
        if (available != null && (available || now - lastCheck < 30000L)) return available;
        lastCheck = now;
        boolean found = false;
        try {
            AudioEffect.Descriptor[] list = AudioEffect.queryEffects();
            if (list != null) {
                for (AudioEffect.Descriptor d : list) {
                    if (d != null && IMPL_UUID.equals(d.uuid)) { found = true; break; }
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "queryEffects fallo: " + t.getMessage());
        }
        available = found;
        Log.d(TAG, found ? "SoundAlive FX disponible" : "SoundAlive FX NO instalado (se usan efectos de Android)");
        return found;
    }

    static NativeFx create(int sessionId) {
        try {
            AudioEffect fx = new AudioEffect(TYPE_UUID, IMPL_UUID, Integer.MAX_VALUE, sessionId);
            return new NativeFx(fx, sessionId);
        } catch (Throwable t) {
            Log.w(TAG, "No se pudo crear SoundAlive FX en la sesion " + sessionId + ": " + t.getMessage());
            return null;
        }
    }

    private final AudioEffect fx;
    private final int sessionId;
    private final Map<Long, Integer> sent = new HashMap<>();

    private NativeFx(AudioEffect fx, int sessionId) {
        this.fx = fx;
        this.sessionId = sessionId;
    }

    /** Envia un parametro solo si cambio desde la ultima vez. */
    boolean set(int id, int index, int value) {
        long key = (((long) id) << 32) | (index & 0xffffffffL);
        Integer prev = sent.get(key);
        if (prev != null && prev == value) return true;
        try {
            int r = fx.setParameter(new int[]{id, index}, new int[]{value});
            if (r == AudioEffect.SUCCESS) {
                sent.put(key, value);
                return true;
            }
            Log.w(TAG, "setParameter(" + id + "," + index + ")=" + value + " -> " + r + " (sesion " + sessionId + ")");
        } catch (Throwable t) {
            Log.w(TAG, "setParameter error: " + t.getMessage());
        }
        return false;
    }

    void setEnabled(boolean enabled) {
        try { fx.setEnabled(enabled); } catch (Throwable t) { Log.w(TAG, "setEnabled error: " + t.getMessage()); }
    }

    void release() {
        try { fx.setEnabled(false); } catch (Throwable ignored) {}
        try { fx.release(); } catch (Throwable ignored) {}
    }
}
