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

        // Configure WebView for reliable local asset loading (fixes black screen on Galaxy J2 Core)
        try {
            android.webkit.WebView webView = getBridge().getWebView();
            if (webView != null) {
                android.webkit.WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccessFromFileURLs(true);
                settings.setAllowUniversalAccessFromFileURLs(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                }

                // Inject Direct JavascriptInterface Bridge for zero-latency Root audio control
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
