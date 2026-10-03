export interface EqualizerPreset {
  id: string;
  name: string;
  description: string;
  bands: number[]; // 9 values in dB (-10 to +10)
  bassTreble: number; // -100 (Bass) to 100 (Treble)
  instrumentVocal: number; // -100 (Inst) to 100 (Voc)
}

export type ReverbSize = 'club' | 'auditorium' | 'cathedral';
export type SurroundLevel = 'low' | 'medium' | 'high';
export type AdaptSoundAge = 'off' | 'under30' | 'between30and60' | 'over60' | 'custom';

export interface SoundAliveState {
  enabled: boolean;
  mode: 'basic' | 'advanced';
  selectedPresetId: string;
  // 9-band EQ (-10dB to +10dB)
  bands: number[];
  // Dual Dials (-100 to 100)
  bassTreble: number;
  instrumentVocal: number;
  // SoundAlive Legendary Effects
  tubeAmp: boolean;
  tubeAmpDrive: number; // 0 to 1
  surround3D: boolean;
  surroundLevel: SurroundLevel;
  surroundAmount?: number; // 0 to 1000
  concertHall: boolean;
  concertHallSize: ReverbSize;
  concertHallAmount?: number; // 0 to 1000
  gainDb?: number; // -5 to +12 dB
  bassBoost: boolean;
  bassBoostLevel: number; // 0 to 10
  clarity: boolean;
  clarityLevel: number; // 0 to 10
  uhqUpscaler: boolean;
  // Adapt Sound
  adaptSound: AdaptSoundAge;
  adaptSoundCustomL: number[]; // 9 bands ear calibration
  adaptSoundCustomR: number[];
}

export const EQ_FREQUENCIES = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const SOUNDALIVE_PRESETS: EqualizerPreset[] = [
  {
    id: 'normal',
    name: 'Normal',
    description: 'Respuesta plana sin alteración de frecuencias',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassTreble: 0,
    instrumentVocal: 0,
  },
  {
    id: 'pop',
    name: 'Pop',
    description: 'Realce de voces y brillo superior con bajos controlados',
    bands: [-1, 1, 3, 4, 3, 2, 1, 2, 3],
    bassTreble: 15,
    instrumentVocal: 40,
  },
  {
    id: 'classic',
    name: 'Clásica',
    description: 'Mayor amplitud dinámica para cuerdas, vientos y orquestas',
    bands: [4, 3, 2, 1, -1, 1, 3, 4, 4],
    bassTreble: 0,
    instrumentVocal: -35,
  },
  {
    id: 'jazz',
    name: 'Jazz',
    description: 'Calidez en medios y agudos aterciopelados con contrabajo definido',
    bands: [3, 2, 1, 2, -1, 1, 2, 3, 3],
    bassTreble: 10,
    instrumentVocal: -15,
  },
  {
    id: 'rock',
    name: 'Rock',
    description: 'Graves potentes y agudos cortantes con medios en V para guitarras',
    bands: [5, 4, 2, -1, -2, 1, 3, 5, 6],
    bassTreble: 30,
    instrumentVocal: -40,
  },
  {
    id: 'dance',
    name: 'Baile / EDM',
    description: 'Sub-graves masivos y agudos hiper-definidos para música electrónica',
    bands: [7, 6, 3, 0, 0, 2, 4, 6, 5],
    bassTreble: -20,
    instrumentVocal: -20,
  },
  {
    id: 'vocal',
    name: 'Voz / Diálogo',
    description: 'Claridad frontal en frecuencias vocales y reducción de estruendos',
    bands: [-3, -2, 1, 4, 6, 5, 3, 1, -1],
    bassTreble: 10,
    instrumentVocal: 80,
  },
  {
    id: 'bass_heavy',
    name: 'Ultra Graves',
    description: 'Máximo empuje en bombos y líneas de bajo profundo',
    bands: [8, 7, 5, 2, 0, -1, 0, 1, 2],
    bassTreble: -75,
    instrumentVocal: -10,
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Curva ecualizada libremente por el usuario',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassTreble: 0,
    instrumentVocal: 0,
  },
];
