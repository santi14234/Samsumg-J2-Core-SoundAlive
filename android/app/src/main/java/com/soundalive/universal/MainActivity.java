package com.soundalive.universal;

import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "SoundAliveMain";
    private WebAppInterface mWebAppInterface;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SoundAlivePlugin.class);
        super.onCreate(savedInstanceState);

        // Single Root automation on startup for permissions and audio session 0 wake up
        setupRootPermissionsOnce();

        AudioEffectsManager.getInstance().init(this);

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

                // Instant Startup optimization for Android Go (1GB RAM)
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

                // Inject Direct JavascriptInterface Bridge under both AndroidAudio and WebAppInterface
                mWebAppInterface = new WebAppInterface(this);
                webView.addJavascriptInterface(mWebAppInterface, "AndroidAudio");
                webView.addJavascriptInterface(mWebAppInterface, "WebAppInterface");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        handleIntent(getIntent());
    }

    private void setupRootPermissionsOnce() {
        try {
            Process p = Runtime.getRuntime().exec(new String[]{
                "su", "-c", 
                "settings put system sound_effect_enable 1; pm grant com.soundalive.universal android.permission.WRITE_SECURE_SETTINGS; media volume --stream 3 --set 10"
            });
            if (p != null) {
                p.waitFor();
            }
        } catch (Exception e) {
            Log.d(TAG, "Root permissions setup: " + e.getMessage());
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

    @Override
    protected void onPause() {
        super.onPause();
        // Keep instances alive in RAM (Eqfy MM Retain) - do NOT release on background minimize
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Keep active in swap memory
    }

    @Override
    public void onDestroy() {
        // Release only when explicitly swiped away from recent apps list
        try {
            if (mWebAppInterface != null) {
                mWebAppInterface.release();
                mWebAppInterface = null;
            }
            AudioEffectsManager.getInstance().release();
        } catch (Throwable ignored) {}

        super.onDestroy();

        try {
            android.os.Process.killProcess(android.os.Process.myPid());
        } catch (Throwable ignored) {
            System.exit(0);
        }
    }
}
