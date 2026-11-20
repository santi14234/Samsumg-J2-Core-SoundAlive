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

        // Automatización Root única en el arranque para permisos y despertar sesión 0 multimedia
        setupRootPermissionsOnce();

        AudioEffectsManager.getInstance().init(this);

        // Servicio en primer plano: mantiene los efectos vivos aunque cierres la pantalla
        try {
            Intent svc = new Intent(this, SoundAliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Exception e) {
            Log.d(TAG, "No se pudo iniciar el servicio: " + e.getMessage());
        }

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
    public void onDestroy() {
        // Ya NO se liberan los efectos ni se mata el proceso: el servicio en primer plano
        // los mantiene vivos al cerrar la pantalla (antes aqui se apagaba todo).
        mWebAppInterface = null;
        super.onDestroy();
    }
}
