package com.soundalive.universal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class SoundAliveService extends Service {
    public static final String CHANNEL_ID = "soundalive_service_channel";
    public static final int NOTIFICATION_ID = 1001;

    // Desde Android 8 los broadcasts implicitos NO llegan a receivers del manifest:
    // hay que registrar el receiver en tiempo de ejecucion, dentro del servicio.
    private final AudioEffectReceiver sessionReceiver = new AudioEffectReceiver();
    private boolean receiverRegistered = false;

    @Override
    public void onCreate() {
        super.onCreate();
        // Initialize effects manager in foreground service
        AudioEffectsManager.getInstance().init(this);

        createNotificationChannel();
        Notification notification = createNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(AudioEffectReceiver.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION);
            filter.addAction(AudioEffectReceiver.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION);
            filter.addAction(AudioEffectReceiver.ACTION_OPEN_AUDIO_EFFECT_CONTROL_PANEL);
            filter.addAction(AudioEffectReceiver.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_PANEL);
            registerReceiver(sessionReceiver, filter);
            receiverRegistered = true;
        } catch (Exception ignored) {}

        // Busca con root las sesiones de apps que no avisan (YouTube, emuladores...)
        SessionScanner.getInstance().start();
    }

    @Override
    public void onDestroy() {
        SessionScanner.getInstance().stop();
        if (receiverRegistered) {
            try { unregisterReceiver(sessionReceiver); } catch (Exception ignored) {}
            receiverRegistered = false;
        }
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        AudioEffectsManager.getInstance().init(this);
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SoundAlive Lite",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Servicio de efectos de audio en segundo plano");
            channel.setShowBadge(false);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SoundAlive Lite")
            .setContentText("Efectos de audio y ecualizador activos")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
