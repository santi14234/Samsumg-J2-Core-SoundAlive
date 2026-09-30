import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  Github,
  PlayCircle,
  PackageCheck,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Settings2,
  ShieldCheck,
  RefreshCw,
  Power,
} from 'lucide-react';
import {
  isNativeAndroidApp,
  openWriteSettingsScreen,
  startNativeBackgroundService,
} from '../utils/nativeBridge';

interface J2CoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const J2CoreInfoModal: React.FC<J2CoreInfoModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'github' | 'permissions'>('pwa');
  const [copied, setCopied] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenSettings = async () => {
    await openWriteSettingsScreen();
  };

  const handleStartService = async () => {
    await startNativeBackgroundService();
    setServiceStatus('¡Servicio en segundo plano iniciado!');
    setTimeout(() => setServiceStatus(null), 3500);
  };

  const githubSteps = [
    {
      title: '1. Sube este código a tu cuenta de GitHub',
      desc: 'Crea un repositorio en GitHub y sube los archivos de este proyecto (incluyendo la carpeta .github/workflows/build-apk.yml y capacitor.config.json que ya dejamos listos).',
    },
    {
      title: '2. Ve a la pestaña "Actions"',
      desc: 'En tu repositorio de GitHub, haz clic en la pestaña "Actions" en la parte superior.',
    },
    {
      title: '3. Ejecuta la compilación (Run workflow)',
      desc: 'Selecciona "Compilar APK SoundAlive con GitHub Actions" y pulsa el botón "Run workflow". Los servidores de GitHub descargarán el SDK de Android, Java 17 y compilarán el archivo app-debug.apk en unos 3 minutos completamente gratis.',
    },
    {
      title: '4. Descarga tu archivo APK listo para instalar',
      desc: 'Al terminar, haz clic en la ejecución completada y en la sección "Artifacts" descarga "SoundAlive-Galaxy-J2-Core-APK". Descomprime el ZIP y pásalo a tu Samsung Galaxy J2 Core.',
    },
  ];

  const handleCopyWorkflow = () => {
    const yamlContent = `name: Compilar APK SoundAlive con GitHub Actions

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-android-apk:
    runs-on: ubuntu-latest

    steps:
      - name: Descargar código del repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js 22 (LTS)
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Instalar dependencias
        run: npm install --legacy-peer-deps

      - name: Compilar aplicación web
        run: npm run build

      - name: Sincronizar proyecto Android con Capacitor
        run: npx cap sync android

      - name: Configurar Java JDK 21 (LTS)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Aceptar licencias de Android SDK
        run: yes | sdkmanager --licenses || true

      - name: Otorgar permisos de ejecución a Gradle
        run: chmod +x android/gradlew

      - name: Compilar APK con Gradle
        run: |
          cd android
          ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Subir archivo APK como artefacto
        uses: actions/upload-artifact@v4
        with:
          name: SoundAlive-Galaxy-J2-Core-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk`;

    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121826] border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Galaxy J2 Core & Compilación APK
            </h3>
            <p className="text-xs text-slate-400">Solución a los cierres y compilación en GitHub</p>
          </div>
        </div>

        {/* Technical Diagnosis */}
        <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-800/40 mb-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-300">¿Por qué el APK original de Samsung se cierra?</h4>
              <p className="text-[11px] text-rose-200/80 mt-1 leading-relaxed">
                El Galaxy J2 Core tiene <strong>Android Go Edition</strong> (versión reducida). Samsung eliminó las librerías propietarias de TouchWiz/OneUI (<code>sec_framework.jar</code>) y los módulos DSP de audio. Al faltar estas piezas del sistema, el APK oficial de SoundAlive crashea al instante.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-[#0b0f19] p-1 border border-slate-800 mb-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'pwa'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            PWA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'github'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            Compilar APK
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'permissions'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Ajustes & 2do Plano
          </button>
        </div>

        {activeTab === 'pwa' ? (
          <div>
            <div className="p-3.5 rounded-2xl bg-blue-950/25 border border-blue-800/40 mb-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200/90 leading-relaxed">
                  <strong>Recomendado para el J2 Core:</strong> No consume los escasos 1 GB de RAM del teléfono y no requiere compilar nada.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Abre la app en tu teléfono</span>
                  <span className="text-slate-400">
                    Ingresa con Chrome o Samsung Internet desde tu Galaxy J2 Core.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Toca los 3 puntos (⋮) de Chrome</span>
                  <span className="text-slate-400">
                    Selecciona <strong>«Añadir a la pantalla de inicio»</strong> o <strong>«Instalar aplicación»</strong>.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">¡Listo! Funciona como app independiente</span>
                  <span className="text-slate-400">
                    Aparecerá el icono de SoundAlive en tu cajón de aplicaciones y abrirá a pantalla completa.
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'github' ? (
          <div>
            {/* Direct GitHub Repo Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700/60 mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Repositorio Vinculado</span>
                <span className="text-xs font-mono font-bold text-sky-400 truncate block">santi14234/Samsumg-J2-Core-SoundAlive</span>
              </div>
              <a
                href="https://github.com/santi14234/Samsumg-J2-Core-SoundAlive/actions"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              >
                Abrir Actions
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Quick Download ZIP Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-blue-950/40 border border-emerald-700/50 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Descargar Código Listo para GitHub (.ZIP)
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Incluye todo el código fuente, la configuración de Capacitor y el flujo de GitHub Actions.
                </p>
              </div>
              <a
                href="/SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                download="SoundAlive-Galaxy-J2-Core-Proyecto.zip"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/30 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar .ZIP
              </a>
            </div>

            <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-800/40 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs text-blue-200">
                  Archivo listo: <code>build-apk.yml</code> (Node 22 LTS)
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <a
                  href="/build-apk.yml"
                  download="build-apk.yml"
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shrink-0"
                >
                  <Download className="w-3 h-3" />
                  Descargar archivo .yml
                </a>
                <button
                  type="button"
                  onClick={handleCopyWorkflow}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-700 text-white hover:bg-slate-600 font-medium shrink-0"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {githubSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#161f33] border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-slate-200 block">{step.title}</span>
                    <span className="text-slate-400 mt-0.5 block leading-relaxed">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Permissions & Background Service Tab */
          <div>
            <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-800/40 mb-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-purple-200">
                    Permisos de Sistema & 2do Plano Configurados
                  </h4>
                  <p className="text-[11px] text-purple-300/80 mt-1 leading-relaxed">
                    Hemos integrado en el <code>AndroidManifest.xml</code> y en el código nativo de Android los permisos y servicios requeridos para Samsung Galaxy J2 Core.
                  </p>
                </div>
              </div>
            </div>

            {serviceStatus && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-medium mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                {serviceStatus}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {/* Permission 1: WRITE_SETTINGS */}
              <div className="p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Settings2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Modificar ajustes del sistema (WRITE_SETTINGS)
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                        Permite a SoundAlive controlar los ajustes globales de audio y sonido. En tu J2 Core aparece en: <em>Ajustes → Aplicaciones → Acceso especial → Modificar ajustes de sistema</em>.
                      </span>
                    </div>
                  </div>
                  {isNativeAndroidApp() && (
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="px-2.5 py-1 text-[11px] rounded bg-purple-600 hover:bg-purple-500 text-white font-medium shrink-0"
                    >
                      Abrir Ajustes
                    </button>
                  )}
                </div>
              </div>

              {/* Permission 2: FOREGROUND_SERVICE */}
              <div className="p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Power className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Ejecución en segundo plano persistente
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                        Configurado con <code>SoundAliveService</code> (Foreground Service de Audio). No se cerrará cuando cambies de app o apagues la pantalla.
                      </span>
                    </div>
                  </div>
                  {isNativeAndroidApp() && (
                    <button
                      type="button"
                      onClick={handleStartService}
                      className="px-2.5 py-1 text-[11px] rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0"
                    >
                      Iniciar Servicio
                    </button>
                  )}
                </div>
              </div>

              {/* Permission 3: BOOT_COMPLETED */}
              <div className="p-3 rounded-xl bg-[#161f33] border border-slate-800">
                <div className="flex items-start gap-2.5">
                  <RefreshCw className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Iniciar al reiniciar el celular (BOOT_COMPLETED)
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                      Se programó el receptor nativo <code>BootReceiver</code> para revivir el servicio en cuanto el Samsung Galaxy J2 Core encienda o reinicie.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-lg shadow-cyan-600/30 transition-colors cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
