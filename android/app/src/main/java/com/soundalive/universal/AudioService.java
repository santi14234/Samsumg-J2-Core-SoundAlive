package com.soundalive.universal;

/**
 * AudioService is a dedicated service alias that runs in the isolated process :audio_process.
 * This guarantees the DSP audio effects engine is isolated in its own RAM process on Android Go,
 * preventing low-memory kill when switching apps or locking the device.
 */
public class AudioService extends SoundAliveService {
}
