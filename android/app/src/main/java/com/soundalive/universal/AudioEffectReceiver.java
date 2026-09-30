package com.soundalive.universal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.util.Log;

public class AudioEffectReceiver extends BroadcastReceiver {
    private static final String TAG = "SoundAliveReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);

        AudioEffectsManager manager = AudioEffectsManager.getInstance();
        manager.init(context);

        if (AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_PANEL.equals(action)) {
            Log.d(TAG, "Opened audio effect session: " + sessionId);
            if (sessionId != AudioEffect.ERROR_BAD_VALUE) {
                manager.attachSession(sessionId);
            }
        } else if (AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_PANEL.equals(action)) {
            Log.d(TAG, "Closed audio effect session: " + sessionId);
            if (sessionId != AudioEffect.ERROR_BAD_VALUE) {
                manager.detachSession(sessionId);
            }
        }
    }
}
