# SoundAlive Pro (Samsung Galaxy J2 Core)

Ecualizador de 9 bandas con Bass Boost, Claridad, Surround 3D, Atmósfera de Sala, Volumen Maestro y Limitador.
Interfaz web (React + Vite) dentro de una app Android (Capacitor) con el motor de audio en Java.

## Estructura

- `src/` — interfaz (React). `src/utils/nativeBridge.ts` es el puente hacia Android.
- `android/app/src/main/java/com/soundalive/universal/`
  - `SoundAlivePlugin.java` — recibe las órdenes de la interfaz (`updateControl`, `setBypass`, `setGlobalOutputOnly`, perfiles).
  - `AudioEffectsManager.java` — motor: Equalizer, BassBoost, LoudnessEnhancer y EnvironmentalReverb.
  - `AudioEffectReceiver.java` — recibe las sesiones de audio que anuncian los reproductores.
  - `SoundAliveService.java`, `BootReceiver.java`, `MainActivity.java` — servicio en segundo plano, arranque y actividad.
- `.github/workflows/build-apk.yml` — compila el APK en GitHub Actions (pestaña **Actions**, artefacto `SoundAlive-Pro`).

## Cómo funciona

- **Global Output (only)** (menú ⋮, activado por defecto): aplica los efectos a la mezcla global de audio
  (sesión 0, igual que Eqfy), así que afecta a todas las apps. Si se desactiva, solo se procesan los reproductores
  que pidan el ecualizador. Junto al título aparece "activo" o "sin control" según si el sistema aceptó el efecto.
- **Surround 3D** no usa el Virtualizer: suma ganancia al reverb (hasta +10 dB en la sala y +15 dB en la cola).
- **Claridad** realza 8k y 16k sin mover tus sliders del EQ.
- **Limitador** reserva margen de volumen según cuánto realces el EQ, para evitar saturación.

## Si no se escucha nada

Con el celular conectado por USB: `adb logcat -s SoundAliveEffects` muestra si cada efecto se creó
("Equalizer OK on session 0") o por qué falló.
