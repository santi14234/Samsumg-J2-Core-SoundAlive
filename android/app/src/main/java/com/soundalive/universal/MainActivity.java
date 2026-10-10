package com.soundalive.universal;

import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WebAppInterface mWebAppInterface;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SoundAlivePlugin.class);
        super.onCreate(savedInstanceState);

        AudioEffectsManager.getInstance().init(this);

        // Configure WebView for reliable local asset loading (fixes black screen on Galaxy J2 Core)
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccessFromFileURLs(true);
                settings.setAllowUniversalAccessFromFileURLs(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                }

                // Optimización de Arranque Instantáneo para Android Go (1GB RAM)
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

                // Inject Direct JavascriptInterface Bridge for zero-latency Root audio control
                mWebAppInterface = new WebAppInterface(this);
                webView.addJavascriptInterface(mWebAppInterface, "AndroidAudio");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Check if opened from an external music player with a specific audio session
        handleIntent(getIntent());
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

    @Override
    public void onDestroy() {
        // 1. Liberación absoluta de todos los efectos nativos al cerrar la app
        try {
            if (mWebAppInterface != null) {
                mWebAppInterface.release();
                mWebAppInterface = null;
            }
            AudioEffectsManager.getInstance().release();
        } catch (Throwable ignored) {}

        super.onDestroy();

        // 2. Matar el proceso y liberar toda la memoria RAM de inmediato
        try {
            android.os.Process.killProcess(android.os.Process.myPid());
        } catch (Throwable ignored) {
            System.exit(0);
        }
    }
}
