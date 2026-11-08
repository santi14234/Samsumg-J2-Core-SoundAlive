import { useState } from 'react';
import { 
  Sliders, 
  Bookmark, 
  Sun, 
  Volume2, 
  Globe, 
  Sparkles, 
  Zap, 
  Activity, 
  RotateCw, 
  Power, 
  MoreVertical,
  Check
} from 'lucide-react';
import { nativeBridge } from './utils/nativeBridge';

export default function App() {
  const [isActive, setIsActive] = useState(true);
  const [activeSlot, setActiveSlot] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 9 EQ Bands (63Hz to 16kHz) range -10 to +10 dB
  const [bands, setBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const freqs = ["63", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

  // Presets
  const presets: { [key: string]: number[] } = {
    "Plano": [0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Graves": [5, 4, 3, 1, 0, 0, 0, 0, 0],
    "Vocal": [-2, -1, 1, 3, 4, 3, 1, 0, -1],
    "Rock / V": [5, 3, 1, -1, -2, 0, 2, 4, 5],
    "Agudos": [-1, 0, 0, 0, 1, 2, 3, 5, 6]
  };

  const applyPreset = (presetName: string) => {
    if (presets[presetName]) {
      const newBands = [...presets[presetName]];
      setBands(newBands);
      newBands.forEach((val, idx) => {
        nativeBridge.updateControl(`band_${idx}`, val);
      });
      flashMessage(`Preset ${presetName} aplicado`);
    }
  };

  // FXSound Pro Sliders (0 - 10)
  const [clarity, setClarity] = useState(5);
  const [bassBoost, setBassBoost] = useState(4);
  const [surround, setSurround] = useState(3);
  const [room, setRoom] = useState("Sala 1: Estudio");
  const [roomMix, setRoomMix] = useState(3);
  const [masterVolume, setMasterVolume] = useState(3);
  const [limiter, setLimiter] = useState(3);

  // 7 Profiles storage
  const [profiles, setProfiles] = useState<{ [key: number]: any }>({
    1: { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0], clarity: 5, bassBoost: 4, surround: 3, room: "Sala 1: Estudio", roomMix: 3, masterVolume: 3, limiter: 3 }
  });

  const flashMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleBandChange = (index: number, value: number) => {
    const updated = [...bands];
    updated[index] = value;
    setBands(updated);
    nativeBridge.updateControl(`band_${index}`, value);
  };

  const handleSliderChange = (setter: (v: number) => void, controlName: string, value: number) => {
    setter(value);
    nativeBridge.updateControl(controlName, value);
  };

  const handleSaveSlot = (slotNum: number) => {
    const stateToSave = {
      bands,
      clarity,
      bassBoost,
      surround,
      room,
      roomMix,
      masterVolume,
      limiter
    };
    setProfiles(prev => ({ ...prev, [slotNum]: stateToSave }));
    nativeBridge.saveProfileSlot(slotNum - 1, stateToSave);
    flashMessage(`¡Configuración guardada en Slot #${slotNum}!`);
  };

  const handleLoadSlot = (slotNum: number) => {
    setActiveSlot(slotNum);
    const saved = profiles[slotNum] || nativeBridge.loadProfileSlot(slotNum - 1);
    if (saved) {
      if (saved.bands) setBands(saved.bands);
      if (saved.clarity !== undefined) setClarity(saved.clarity);
      if (saved.bassBoost !== undefined) setBassBoost(saved.bassBoost);
      if (saved.surround !== undefined) setSurround(saved.surround);
      if (saved.room !== undefined) setRoom(saved.room);
      if (saved.roomMix !== undefined) setRoomMix(saved.roomMix);
      if (saved.masterVolume !== undefined) setMasterVolume(saved.masterVolume);
      if (saved.limiter !== undefined) setLimiter(saved.limiter);
      flashMessage(`Slot #${slotNum} cargado`);
    } else {
      flashMessage(`Slot #${slotNum} activado`);
    }
  };

  const handleAudioServerRestart = () => {
    setShowMenu(false);
    nativeBridge.forceAudioServerRestart();
    flashMessage("Comando: su -c killall audioserver ejecutado");
  };

  const togglePower = () => {
    const nextState = !isActive;
    setIsActive(nextState);
    nativeBridge.setBypass(!nextState);
  };

  return (
    <div className="min-h-screen bg-[#0d0f11] text-gray-200 font-sans p-3 sm:p-5 select-none pb-12">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#00e676] text-black px-4 py-2 rounded-full font-bold text-xs shadow-lg shadow-[#00e676]/30 flex items-center gap-1.5 animate-bounce">
          <Check size={14} />
          {statusMessage}
        </div>
      )}

      {/* HEADER */}
      <header className="relative flex justify-between items-center bg-[#151719] px-4 py-3 rounded-2xl border border-[#23272a] shadow-lg mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00e676] text-black font-extrabold flex items-center justify-center text-lg shadow-md shadow-[#00e676]/20">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-wide">SoundAlive Pro</h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#004d40] text-[#00e676] uppercase tracking-wider">
                FXSOUND
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Motor Samsung J2 Core (Root Global)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Power Button */}
          <button
            onClick={togglePower}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${
              isActive 
                ? 'bg-[#00e676] text-black shadow-[#00e676]/30 hover:bg-[#00c853]' 
                : 'bg-[#2a2d31] text-gray-400 hover:text-white'
            }`}
          >
            <Power size={13} strokeWidth={2.5} />
            <span>{isActive ? 'ACTIVO' : 'INACTIVO'}</span>
          </button>

          {/* 3 dots menu button */}
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="w-8 h-8 rounded-full bg-[#202326] text-gray-300 hover:text-white flex items-center justify-center transition"
            >
              <MoreVertical size={16} />
            </button>

            {/* Menu Dropdown Popup */}
            {showMenu && (
              <div className="absolute right-0 top-10 z-50 w-60 bg-[#1b1e22] border border-[#2e3338] rounded-xl shadow-2xl p-1.5 text-xs animate-in fade-in zoom-in-95">
                <button
                  onClick={handleAudioServerRestart}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#252a2f] text-gray-200 transition text-left"
                >
                  <RotateCw size={14} className="text-[#00e676]" />
                  <span>Reinicio Forzado AudioServer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PANEL 1: RANURAS DE PERFILES (1 - 7) */}
      <section className="bg-[#151719] p-4 rounded-2xl border border-[#23272a] shadow-lg mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5 text-gray-300 font-semibold text-xs tracking-wider">
            <Bookmark size={14} className="text-[#00e676]" />
            <span>RANURAS DE PERFILES (1 - 7)</span>
          </div>
          <span className="text-[11px] font-bold text-[#00e676]">
            Slot Activo: #{activeSlot}
          </span>
        </div>

        {/* 7 Slots Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((num) => {
            const isSelected = activeSlot === num;
            return (
              <button
                key={num}
                onClick={() => handleLoadSlot(num)}
                onDoubleClick={() => handleSaveSlot(num)}
                className={`py-2 rounded-xl text-xs font-bold transition-all text-center ${
                  isSelected
                    ? 'bg-[#00e676] text-black shadow-md shadow-[#00e676]/30 scale-[1.02]'
                    : 'bg-[#222529] text-gray-300 hover:bg-[#2c3036] hover:text-white'
                }`}
              >
                #{num}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px]">
          <span className="text-gray-500 italic">
            Doble clic en un número guarda tu configuración actual.
          </span>
          <button
            onClick={() => handleSaveSlot(activeSlot)}
            className="bg-[#00e676] hover:bg-[#00c853] text-black font-extrabold px-3 py-1.5 rounded-lg text-[11px] transition shadow"
          >
            Guardar Slot #{activeSlot}
          </button>
        </div>
      </section>

      {/* PANEL 2: ECUALIZADOR (9 BANDAS) */}
      <section className="bg-[#151719] p-4 rounded-2xl border border-[#23272a] shadow-lg mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-gray-300 font-semibold text-xs tracking-wider">
            <Sliders size={14} className="text-[#00e676]" />
            <span>ECUALIZADOR (9 BANDAS)</span>
          </div>
          <span className="text-[11px] font-mono text-gray-500">±10 dB</span>
        </div>

        {/* Preset Caps buttons */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {["Plano", "Graves", "Vocal", "Rock / V", "Agudos"].map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className="px-3 py-1 bg-[#222529] hover:bg-[#2d3238] text-gray-300 hover:text-white rounded-lg text-[10px] font-semibold transition"
            >
              {name}
            </button>
          ))}
        </div>

        {/* 9 Vertical Faders Row */}
        <div className="bg-[#121315] p-3 rounded-xl border border-[#1e2023] flex justify-between items-center gap-1 sm:gap-2">
          {bands.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              {/* dB value on top */}
              <span className={`text-[10px] font-mono mb-2 ${val !== 0 ? 'text-[#00e676] font-bold' : 'text-gray-400'}`}>
                {val > 0 ? `+${val}` : val}
              </span>

              {/* Fader slider container */}
              <div className="relative h-32 flex items-center justify-center">
                <input
                  type="range"
                  orient="vertical"
                  min="-10"
                  max="10"
                  step="1"
                  value={val}
                  onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                  className="h-28 w-2 accent-[#00e676] cursor-pointer appearance-none bg-[#2a2d31] rounded-full"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
              </div>

              {/* Frequency label at bottom */}
              <span className="text-[9px] font-medium text-gray-400 mt-2">
                {freqs[idx]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* PANEL 3: PROCESAMIENTO FXSOUND PRO */}
      <section className="bg-[#151719] p-4 rounded-2xl border border-[#23272a] shadow-lg mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-gray-300 font-semibold text-xs tracking-wider">
            <Sliders size={14} className="text-[#00e676]" />
            <span>PROCESAMIENTO FXSOUND PRO</span>
          </div>
          <span className="text-[11px] font-mono text-gray-500">Escala Real 0 - 10</span>
        </div>

        <div className="space-y-4">
          {/* Claridad Vocal */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Sun size={13} className="text-[#00e676]" /> Claridad Vocal (Clarity)
              </span>
              <span className="text-xs font-mono font-bold text-[#00e676]">{clarity}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={clarity}
              onChange={(e) => handleSliderChange(setClarity, 'clarity', Number(e.target.value))}
              className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
            />
          </div>

          {/* Refuerzo de Graves */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Volume2 size={13} className="text-[#00e676]" /> Refuerzo de Graves (Bass Boost)
              </span>
              <span className="text-xs font-mono font-bold text-[#00e676]">{bassBoost}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={bassBoost}
              onChange={(e) => handleSliderChange(setBassBoost, 'bassBoost', Number(e.target.value))}
              className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
            />
          </div>

          {/* Sonido Envolvente 3D */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Globe size={13} className="text-[#00e676]" /> Sonido Envolvente 3D (Surround)
              </span>
              <span className="text-xs font-mono font-bold text-[#00e676]">{surround}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={surround}
              onChange={(e) => handleSliderChange(setSurround, 'surround', Number(e.target.value))}
              className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
            />
          </div>

          {/* Subpanel: Atmósfera de Sala */}
          <div className="bg-[#191c1f] p-3 rounded-xl border border-[#262a2e] space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
              <Sparkles size={13} className="text-[#00e676]" />
              <span>Atmósfera de Sala</span>
            </div>

            <select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                nativeBridge.updateControl('room', e.target.selectedIndex + 1);
              }}
              className="w-full bg-[#23272c] border border-[#33383f] text-gray-200 text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="Sala 1: Estudio">Sala 1: Estudio</option>
              <option value="Sala 2: Habitación">Sala 2: Habitación</option>
              <option value="Sala 3: Estudio Pro">Sala 3: Estudio Pro</option>
              <option value="Sala 4: Auditorio">Sala 4: Auditorio</option>
              <option value="Sala 5: Catedral/Arena">Sala 5: Catedral/Arena</option>
            </select>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-400 text-[11px]">Nivel de Ganancia (Mix)</span>
                <span className="text-xs font-mono font-bold text-[#00e676]">{roomMix}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={roomMix}
                onChange={(e) => handleSliderChange(setRoomMix, 'roomMix', Number(e.target.value))}
                className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
              />
            </div>
          </div>

          {/* Volumen Maestro */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Volume2 size={13} className="text-[#00e676]" /> Volumen Maestro (Master Volume)
              </span>
              <span className="text-xs font-mono font-bold text-[#00e676]">{masterVolume}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={masterVolume}
              onChange={(e) => handleSliderChange(setMasterVolume, 'masterVolume', Number(e.target.value))}
              className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
            />
          </div>

          {/* Normalización Dinámica */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Zap size={13} className="text-[#00e676]" /> Normalización Dinámica (Limiter)
              </span>
              <span className="text-xs font-mono font-bold text-[#00e676]">{limiter}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={limiter}
              onChange={(e) => handleSliderChange(setLimiter, 'limiter', Number(e.target.value))}
              className="w-full h-1.5 bg-[#25282d] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
            />
          </div>
        </div>
      </section>

      {/* FOOTER: ESTADO DEL MOTOR NATIVO */}
      <footer className="bg-[#151719] p-4 rounded-2xl border border-[#23272a] shadow-lg mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300 tracking-wider">
            <Activity size={14} className="text-[#00e676]" />
            <span>ESTADO DEL MOTOR NATIVO</span>
          </div>
          <span className="px-2 py-0.5 rounded-full border border-[#00e676] text-[#00e676] text-[10px] font-bold tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676]"></span>
            ROOT GLOBAL
          </span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Puente JavascriptInterface:</span>
          <span className="font-mono text-[#00e676] font-semibold text-[11px]">
            window.AndroidAudio Conectado
          </span>
        </div>
      </footer>

      {/* Copyright branding */}
      <div className="text-center text-[10px] text-gray-600 font-mono tracking-tight">
        SoundAlive Pro — FxSound Architecture with Root Access for Samsung J2 Core
      </div>
    </div>
  );
}
