package com.soundalive.universal;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lee la salida de "dumpsys media.audio_flinger" y extrae las pistas de audio
 * (sesion, proceso, tipo de stream). No usa nada de Android para poder probarse en una PC.
 *
 * Formato de la tabla (Android 8.1):
 *   T Name Active Client Session S  Flags   Format Chn mask  SRate ST  L dB ...
 *   S    0     no   3082     609 S  0x600 00000001 00000003  48000  2  -inf ...
 *        0    yes   7988      17 A  0x000 00000001 00000003  48000  3     0 ...
 */
final class AudioDumpParser {

    private AudioDumpParser() {}

    static final class Track {
        final int pid;
        final int session;
        final int streamType;
        final boolean active;

        Track(int pid, int session, int streamType, boolean active) {
            this.pid = pid;
            this.session = session;
            this.streamType = streamType;
            this.active = active;
        }

        @Override
        public String toString() {
            return "Track{pid=" + pid + ", session=" + session + ", stream=" + streamType
                    + ", active=" + active + "}";
        }
    }

    private static final String TABLE_HEADER = "T Name Active Client Session S";

    // [letra opcional] nombre activo pid sesion estado flags formato canales frecuencia stream ...
    private static final Pattern TRACK_LINE = Pattern.compile(
            "^\\s*(?:[A-Za-z]\\s+)?(\\d+)\\s+(yes|no)\\s+(\\d+)\\s+(\\d+)\\s+[A-Za-z]\\s+"
                    + "0x[0-9a-fA-F]+\\s+[0-9a-fA-F]{8}\\s+[0-9a-fA-F]{8}\\s+(\\d+)\\s+(\\d+)(?:\\s.*)?$");

    /** Procesa el dump linea por linea, sin guardar el texto completo. */
    static final class Collector {
        private boolean inTable = false;
        private final List<Track> tracks = new ArrayList<>();

        void accept(String line) {
            if (line == null) return;
            if (line.contains(TABLE_HEADER)) {
                inTable = true;
                return;
            }
            if (!inTable) return;
            Matcher m = TRACK_LINE.matcher(line);
            if (m.matches()) {
                int pid = Integer.parseInt(m.group(3));
                int session = Integer.parseInt(m.group(4));
                int stream = Integer.parseInt(m.group(6));
                boolean active = "yes".equals(m.group(2));
                tracks.add(new Track(pid, session, stream, active));
            } else {
                // La tabla termina en la primera linea que no es una pista ("N Effect Chains", etc.)
                inTable = false;
            }
        }

        List<Track> tracks() {
            return tracks;
        }
    }

    static List<Track> parseTracks(String dump) {
        Collector c = new Collector();
        if (dump != null) {
            for (String line : dump.split("\n")) {
                c.accept(line.replace("\r", ""));
            }
        }
        return c.tracks();
    }
}
