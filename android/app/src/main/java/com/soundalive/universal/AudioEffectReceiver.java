package com.soundalive.universal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.util.Log;

public class AudioEffectReceiver extends BroadcastReceiver {
    private static final String TAG = "SoundAliveReceiver";

    public static final String ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION = "android.media.action.OPEN_AUDIO_EFFECT_CONTROL_SESSION";
    public static final String ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION = "android.media.action.CLOSE_AUDIO_EFFECT_CONTROL_SESSION";
    public static final String ACTION_OPEN_AUDIO_EFFECT_CONTROL_PANEL = "android.media.action.OPEN_AUDIO_EFFECT_CONTROL_PANEL";
    public static final String ACTION_CLOSE_AUDIO_EFFECT_CONTROL_PANEL = "android.media.action.CLOSE_AUDIO_EFFECT_CONTROL_PANEL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);

        AudioEffectsManager manager = AudioEffectsManager.getInstance();
        manager.init(context);

        if (ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION.equals(action) ||
            ACTION_OPEN_AUDIO_EFFECT_CONTROL_PANEL.equals(action)) {
            Log.d(TAG, "Opened audio effect session: " + sessionId);
            if (sessionId != AudioEffect.ERROR_BAD_VALUE) {
                manager.attachSession(sessionId);
            }
        } else if (ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION.equals(action) ||
                   ACTION_CLOSE_AUDIO_EFFECT_CONTROL_PANEL.equals(action)) {
            Log.d(TAG, "Closed audio effect session: " + sessionId);
            if (sessionId != AudioEffect.ERROR_BAD_VALUE) {
                manager.detachSession(sessionId);
            }
        }
    }
}
