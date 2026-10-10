package com.soundalive.universal;

import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.os.Build;
import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SoundAlivePlugin.class);
        super.onCreate(savedInstanceState);

        AudioEffectsManager.getInstance().init(this);

        // Inject Direct JavascriptInterface Bridge for zero-latency Root audio control
        try {
            android.webkit.WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.getSettings().setJavaScriptEnabled(true);
                webView.addJavascriptInterface(new WebAppInterface(this), "AndroidAudio");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Check if opened from an external music player with a specific audio session
        handleIntent(getIntent());

        try {
            Intent serviceIntent = new Intent(this, SoundAliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
        if (sessionId != AudioEffect.ERROR_BAD_VALUE) {
            AudioEffectsManager.getInstance().attachSession(sessionId);
        }
    }
}
