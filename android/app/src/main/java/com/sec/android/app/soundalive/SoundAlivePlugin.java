package com.sec.android.app.soundalive;

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
    public void getStatus(PluginCall call) {
        try {
            JSObject ret = AudioEffectsManager.getInstance().getStatus();
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error getting status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setMasterEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        AudioEffectsManager.getInstance().setMasterEnabled(enabled);
        call.resolve();
    }

    @PluginMethod
    public void setBandLevel(PluginCall call) {
        int band = call.getInt("band", 0);
        int level = call.getInt("level", 0);
        AudioEffectsManager.getInstance().setBandLevel((short) band, (short) level);
        call.resolve();
    }

    @PluginMethod
    public void setBassBoost(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setBassBoostStrength((short) strength);
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
    public void setClarity(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setClarity(strength);
        call.resolve();
    }

    @PluginMethod
    public void setDynamicBoost(PluginCall call) {
        int strength = call.getInt("strength", 0);
        AudioEffectsManager.getInstance().setDynamicBoost(strength);
        call.resolve();
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
        JSObject ret = new JSObject();
        ret.put("started", false);
        call.resolve(ret);
    }
}
