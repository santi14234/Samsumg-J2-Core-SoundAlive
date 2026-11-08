package com.soundalive.universal;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SoundAliveSystem")
public class SoundAlivePlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        AudioEffectsManager.getInstance().init(getContext());
    }

    @PluginMethod
    public void setMasterEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
        call.resolve();
    }

    @PluginMethod
    public void setSamsungDials(PluginCall call) {
        int bassTreble = call.getInt("bassTreble", 0);
        int vocalInstrument = call.getInt("vocalInstrument", 0);
        AudioEffectsManager.getInstance().setSamsungDials(bassTreble, vocalInstrument);
        call.resolve();
    }

    @PluginMethod
    public void setConcertHall(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        AudioEffectsManager.getInstance().setConcertHall(enabled);
        call.resolve();
    }

    @PluginMethod
    public void setGain(PluginCall call) {
        int millibels = call.getInt("gain", 0);
        AudioEffectsManager.getInstance().setGain(millibels);
        call.resolve();
    }

    @PluginMethod
    public void setClarity(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setClarity(strength);
        call.resolve();
    }

    @PluginMethod
    public void setAmbiente(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setAmbiente(strength);
        call.resolve();
    }

    @PluginMethod
    public void setSurround(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setSurround(strength);
        call.resolve();
    }

    @PluginMethod
    public void setLimiter(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setLimiter(strength);
        call.resolve();
    }

    @PluginMethod
    public void setRoomType(PluginCall call) {
        int type = call.getInt("type", 1);
        AudioEffectsManager.getInstance().setRoomType(type);
        call.resolve();
    }

    /** Global Output (only): true = todas las apps (sesion 0), false = solo sesiones de reproductores. */
    @PluginMethod
    public void setGlobalOutputOnly(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        AudioEffectsManager.getInstance().setGlobalOutputOnly(enabled);
        JSObject ret = new JSObject();
        ret.put("globalOnly", AudioEffectsManager.getInstance().isGlobalOutputOnly());
        call.resolve(ret);
    }

    @PluginMethod
    public void setBypass(PluginCall call) {
        boolean bypass = call.getBoolean("bypass", false);
        AudioEffectsManager.getInstance().setMasterEnabled(!bypass);
        call.resolve();
    }

    /**
     * Puente unico que usa la interfaz: controlName + value.
     * band_0..band_8 (dB -10..10) | clarity, bassBoost, surround, roomMix, masterVolume, limiter (0..10) | room (1..5)
     */
    @PluginMethod
    public void updateControl(PluginCall call) {
        String name = call.getString("controlName", "");
        Double raw = call.getDouble("value", 0.0);
        double value = (raw == null) ? 0.0 : raw;
        AudioEffectsManager m = AudioEffectsManager.getInstance();
        int scaled = (int) Math.round(value * 100.0); // 0..10 -> 0..1000 ; dB -> milibelios

        if (name != null && name.startsWith("band_")) {
            try {
                int idx = Integer.parseInt(name.substring(5));
                m.setBandLevel((short) idx, (short) scaled);
            } catch (NumberFormatException ignored) {}
        } else if ("clarity".equals(name)) {
            m.setClarity(scaled);
        } else if ("bassBoost".equals(name)) {
            m.setBassBoostStrength((short) scaled);
        } else if ("surround".equals(name)) {
            m.setSurround(scaled);
        } else if ("roomMix".equals(name)) {
            m.setAmbiente(scaled);
        } else if ("room".equals(name)) {
            m.setRoomType((int) Math.round(value));
        } else if ("masterVolume".equals(name)) {
            m.setGain(scaled);
        } else if ("limiter".equals(name)) {
            m.setLimiter(scaled);
        }
        call.resolve();
    }

    @PluginMethod
    public void saveProfileSlot(PluginCall call) {
        int slot = call.getInt("slotIndex", 0);
        String data = call.getString("profileData", "");
        getContext().getSharedPreferences("SoundAliveProfiles", android.content.Context.MODE_PRIVATE)
                .edit().putString("slot_" + slot, data).apply();
        call.resolve();
    }

    @PluginMethod
    public void loadProfileSlot(PluginCall call) {
        int slot = call.getInt("slotIndex", 0);
        String data = getContext().getSharedPreferences("SoundAliveProfiles", android.content.Context.MODE_PRIVATE)
                .getString("slot_" + slot, "");
        JSObject ret = new JSObject();
        ret.put("profileData", data);
        call.resolve(ret);
    }

    @PluginMethod
    public void setAmbientSound(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        AudioEffectsManager.getInstance().setAmbientSound(enabled);
        call.resolve();
    }

    @PluginMethod
    public void setBandLevel(PluginCall call) {
        int band = call.getInt("band", 0);
        int level = call.getInt("level", 0); // in millibels, e.g. -1000 to 1000
        AudioEffectsManager.getInstance().setBandLevel((short) band, (short) level);
        call.resolve();
    }

    @PluginMethod
    public void setBassBoost(PluginCall call) {
        int strength = call.getInt("strength", 0); // 0 - 1000
        AudioEffectsManager.getInstance().setBassBoostStrength((short) strength);
        call.resolve();
    }

    @PluginMethod
    public void getEffectsStatus(PluginCall call) {
        JSObject status = AudioEffectsManager.getInstance().getStatus();
        call.resolve(status);
    }

    @PluginMethod
    public void canWriteSettings(PluginCall call) {
        boolean canWrite = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            canWrite = Settings.System.canWrite(getContext());
        }
        JSObject ret = new JSObject();
        ret.put("canWrite", canWrite);
        call.resolve(ret);
    }

    @PluginMethod
    public void openWriteSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error al abrir ajustes del sistema: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), SoundAliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al iniciar servicio: " + e.getMessage());
        }
    }
}
