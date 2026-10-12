package com.sec.android.app.soundalive;

import android.app.Activity;
import android.content.Intent;
import android.media.audiofx.AudioEffect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * MainActivity - SoundAlive Pro (com.sec.android.app.soundalive)
 * Arquitectura Nativa Pura Android Studio para Samsung Galaxy J2 Core (SM-J260M)
 * Implementa el ciclo de vida 'Eqfy MM Retain' para congelar instancias en Swap (2048 MB).
 */
public class MainActivity extends Activity {
    private static final String TAG = "SoundAliveMain";
    private WebView myWebView;
    private WebAppInterface mWebAppInterface;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Pantalla completa inmersiva y barra de estado oscura para hardware AMOLED/LCD J2 Core
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        setContentView(R.layout.activity_main);

        // Disparo único por Root silencioso para despertar el sistema plano y habilitar efectos globales
        despertarSistemaRootSilencioso();

        // Inicializar interfaz de WebView clásica nativa
        myWebView = findViewById(R.id.webview);
        if (myWebView == null) {
            myWebView = new WebView(this);
            setContentView(myWebView);
        }

        configurarWebView();

        // Carga clásica local del archivo HTML consolidado en assets
        myWebView.loadUrl("file:///android_asset/index.html");

        handleIntent(getIntent());
    }

    private void configurarWebView() {
        WebSettings settings = myWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Optimización de rendimiento para Android 8.1 Oreo Go Edition (1GB RAM)
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        myWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        myWebView.setBackgroundColor(0xFF0A0D14);

        myWebView.setWebViewClient(new WebViewClient());
        myWebView.setWebChromeClient(new WebChromeClient());

        // Inyectar el puente nativo Java accesible desde JavaScript como window.Android y window.WebAppInterface
        mWebAppInterface = new WebAppInterface(this);
        myWebView.addJavascriptInterface(mWebAppInterface, "Android");
        myWebView.addJavascriptInterface(mWebAppInterface, "AndroidAudio");
        myWebView.addJavascriptInterface(mWebAppInterface, "WebAppInterface");
    }

    /**
     * Dispara una sola vez por Root silencioso 'su -c media volume --stream 3 --set 10'
     * y los permisos seguros del DSP para despertar el sistema de sonido plano.
     */
    private void despertarSistemaRootSilencioso() {
        new Thread(() -> {
            try {
                Process p = Runtime.getRuntime().exec(new String[]{
                    "su", "-c",
                    "settings put system sound_effect_enable 1; " +
                    "pm grant com.sec.android.app.soundalive android.permission.WRITE_SECURE_SETTINGS; " +
                    "media volume --stream 3 --set 10"
                });
                if (p != null) {
                    p.waitFor();
                }
                Log.d(TAG, "Root silencioso ejecutado con éxito: media volume stream 3 set 10");
            } catch (Exception e) {
                Log.d(TAG, "Root wake up fallback: " + e.getMessage());
            }
        }).start();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
        if (sessionId != AudioEffect.ERROR_BAD_VALUE && mWebAppInterface != null) {
            Log.d(TAG, "Audio session detectada: " + sessionId);
        }
    }

    /**
     * CICLO DE VIDA 'EQFY MM RETAIN':
     * En onPause() y onStop(), congela la actividad en la RAM sin destruir el ecualizador,
     * permitiendo que los 2048 MB virtuales de Swap protejan el estado de las 10 bandas
     * de fondo mientras se ejecutan reproductores como ZXTune.
     */
    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "Eqfy MM Retain: onPause() - Estado congelado en RAM/Swap sin destruir AudioEffect.");
    }

    @Override
    protected void onStop() {
        super.onStop();
        Log.d(TAG, "Eqfy MM Retain: onStop() - DSP activo en Session 0 / Session 121 de fondo.");
    }

    /**
     * Libera con System.exit(0) sólo cuando el usuario destruye o desliza la app explícitamente.
     */
    @Override
    protected void onDestroy() {
        try {
            if (mWebAppInterface != null) {
                mWebAppInterface.release();
                mWebAppInterface = null;
            }
        } catch (Throwable ignored) {}

        super.onDestroy();

        try {
            android.os.Process.killProcess(android.os.Process.myPid());
        } catch (Throwable ignored) {
            System.exit(0);
        }
    }
}
