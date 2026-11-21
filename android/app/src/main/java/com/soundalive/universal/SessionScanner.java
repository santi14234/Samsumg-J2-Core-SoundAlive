package com.soundalive.universal;

import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Log;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * Busca (con root) las sesiones de audio de musica que estan en uso y les pone los efectos.
 * Sirve para apps que no avisan su sesion (YouTube, emuladores, etc.).
 *
 * Usa una sola consola "su" abierta y lee "dumpsys media.audio_flinger" cada pocos segundos.
 */
public final class SessionScanner {
    private static final String TAG = "SoundAliveScanner";
    private static final String END_MARK = "__SA_END__";

    private static final long POLL_PLAYING_MS = 2500L;  // mientras suena algo
    private static final long POLL_IDLE_MS = 6000L;     // si no suena nada
    private static final long SHELL_TIMEOUT_MS = 6000L; // si "su" se cuelga, se cierra
    private static final int MISSES_BEFORE_DETACH = 3;  // lecturas seguidas sin ver la sesion
    private static final int MAX_OWNED_SESSIONS = 6;    // limite para no llenar el telefono de efectos
    private static final int STREAM_MUSIC = 3;

    private static SessionScanner instance;

    public static synchronized SessionScanner getInstance() {
        if (instance == null) instance = new SessionScanner();
        return instance;
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<Integer, Integer> owned = new HashMap<>(); // sesion -> lecturas sin verla

    private HandlerThread thread;
    private Handler handler;
    private boolean running = false;

    private Process shell;
    private BufferedWriter shellIn;
    private BufferedReader shellOut;

    private SessionScanner() {}

    public synchronized void start() {
        if (running) return;
        running = true;
        thread = new HandlerThread("SoundAliveScanner");
        thread.start();
        handler = new Handler(thread.getLooper());
        handler.post(pollTask);
        Log.d(TAG, "Escaner de sesiones iniciado");
    }

    public void stop() {
        HandlerThread t;
        synchronized (this) {
            if (!running) return;
            running = false;
            if (handler != null) handler.removeCallbacksAndMessages(null);
            t = thread;
            thread = null;
            handler = null;
            AudioEffectsManager mgr = AudioEffectsManager.getInstance();
            for (Integer s : owned.keySet()) {
                try { mgr.detachSession(s); } catch (Throwable ignored) {}
            }
            owned.clear();
        }
        closeShell();
        if (t != null) t.quitSafely();
        Log.d(TAG, "Escaner de sesiones detenido");
    }

    private final Runnable pollTask = new Runnable() {
        @Override
        public void run() {
            long next = POLL_IDLE_MS;
            try {
                next = pollOnce();
            } catch (Throwable t) {
                Log.w(TAG, "Error en el escaner: " + t.getMessage());
            }
            synchronized (SessionScanner.this) {
                if (running && handler != null) handler.postDelayed(this, next);
            }
        }
    };

    private long pollOnce() {
        AudioEffectsManager mgr = AudioEffectsManager.getInstance();
        if (!mgr.isMasterEnabled()) return POLL_IDLE_MS;

        AudioDumpParser.Collector dump = readDump();
        if (dump == null) return POLL_IDLE_MS;

        Set<Integer> seen = new HashSet<>();
        boolean anyActive = false;
        for (AudioDumpParser.Track t : dump.tracks()) {
            if (t.session <= 0 || t.streamType != STREAM_MUSIC) continue;
            seen.add(t.session);
            if (t.active) anyActive = true;
        }

        synchronized (this) {
            if (!running) return POLL_IDLE_MS;

            for (Integer s : seen) {
                if (owned.containsKey(s)) {
                    owned.put(s, 0);
                    continue;
                }
                // Si el reproductor ya avisó su sesion, la maneja el receiver, no el escaner
                if (mgr.isSessionAttached(s)) continue;
                if (owned.size() >= MAX_OWNED_SESSIONS) continue;
                Log.d(TAG, "Sesion de musica detectada: " + s);
                mgr.attachSession(s);
                owned.put(s, 0);
            }

            Iterator<Map.Entry<Integer, Integer>> it = owned.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<Integer, Integer> e = it.next();
                if (seen.contains(e.getKey())) continue;
                int misses = e.getValue() + 1;
                if (misses >= MISSES_BEFORE_DETACH) {
                    Log.d(TAG, "Sesion terminada: " + e.getKey());
                    mgr.detachSession(e.getKey());
                    it.remove();
                } else {
                    e.setValue(misses);
                }
            }
        }
        return anyActive ? POLL_PLAYING_MS : POLL_IDLE_MS;
    }

    // ---------------------------------------------------------------- consola root

    private boolean ensureShell() {
        if (shell != null) return true;
        try {
            ProcessBuilder pb = new ProcessBuilder("su");
            pb.redirectErrorStream(true);
            shell = pb.start();
            shellIn = new BufferedWriter(new OutputStreamWriter(shell.getOutputStream()));
            shellOut = new BufferedReader(new InputStreamReader(shell.getInputStream()));
            return true;
        } catch (Exception e) {
            Log.w(TAG, "No se pudo abrir la consola root: " + e.getMessage());
            closeShell();
            return false;
        }
    }

    private AudioDumpParser.Collector readDump() {
        if (!ensureShell()) return null;
        final Process p = shell;
        final Runnable watchdog = new Runnable() {
            @Override
            public void run() {
                try { p.destroy(); } catch (Exception ignored) {}
            }
        };
        mainHandler.postDelayed(watchdog, SHELL_TIMEOUT_MS);
        try {
            shellIn.write("dumpsys media.audio_flinger\necho " + END_MARK + "\n");
            shellIn.flush();
            AudioDumpParser.Collector collector = new AudioDumpParser.Collector();
            String line;
            while ((line = shellOut.readLine()) != null) {
                if (line.contains(END_MARK)) {
                    mainHandler.removeCallbacks(watchdog);
                    return collector;
                }
                collector.accept(line);
            }
            throw new IOException("La consola root se cerro");
        } catch (Exception e) {
            mainHandler.removeCallbacks(watchdog);
            Log.w(TAG, "Fallo leyendo el dump: " + e.getMessage());
            closeShell();
            return null;
        }
    }

    private void closeShell() {
        try { if (shellIn != null) shellIn.close(); } catch (Exception ignored) {}
        try { if (shellOut != null) shellOut.close(); } catch (Exception ignored) {}
        try { if (shell != null) shell.destroy(); } catch (Exception ignored) {}
        shell = null;
        shellIn = null;
        shellOut = null;
    }
}
