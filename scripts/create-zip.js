import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function buildZip() {
  const zip = new JSZip();

  // Root files
  zip.file('index.html', fs.readFileSync('index.html', 'utf8'));
  zip.file('vite.config.ts', fs.readFileSync('vite.config.ts', 'utf8'));
  zip.file('tsconfig.json', fs.readFileSync('tsconfig.json', 'utf8'));
  zip.file('capacitor.config.json', fs.readFileSync('capacitor.config.json', 'utf8'));
  zip.file('README.md', fs.readFileSync('README.md', 'utf8'));
  zip.file('.gitignore', fs.readFileSync('.gitignore', 'utf8'));
  if (fs.existsSync('package-lock.json')) {
    zip.file('package-lock.json', fs.readFileSync('package-lock.json', 'utf8'));
  }

  // Clean lightweight client package.json for building APK
  const clientPackageJson = {
    name: 'soundalive-samsung-web',
    private: true,
    version: '1.2.47',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^19.0.1',
      'react-dom': '^19.0.1',
      'lucide-react': '^0.546.0',
      '@tailwindcss/vite': '^4.3.3',
      tailwindcss: '^4.3.3',
      '@capacitor/core': '^7.0.1',
      '@capacitor/android': '^7.0.1',
    },
    devDependencies: {
      '@types/react': '^19.3.0',
      '@types/react-dom': '^19.3.0',
      '@types/node': '^22.14.0',
      '@vitejs/plugin-react': '^6.1.1',
      '@capacitor/cli': '^7.0.1',
      typescript: '^7.0.2',
      vite: '^8.3.0',
    },
  };
  zip.file('package.json', JSON.stringify(clientPackageJson, null, 2));

  // Workflows
  if (fs.existsSync('.github/workflows/build-apk.yml')) {
    zip.file('.github/workflows/build-apk.yml', fs.readFileSync('.github/workflows/build-apk.yml', 'utf8'));
  }

  // Recursively add directory, skipping heavy caches (.gradle, build, node_modules)
  function addDir(dirPath, zipFolder) {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      if (item === '.gradle' || item === 'build' || item === 'node_modules' || item === '.idea') {
        continue;
      }
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addDir(fullPath, zipFolder.folder(item));
      } else {
        zipFolder.file(item, fs.readFileSync(fullPath));
      }
    }
  }

  if (fs.existsSync('src')) {
    addDir('src', zip.folder('src'));
  }

  if (fs.existsSync('public')) {
    const pubItems = fs.readdirSync('public');
    const pubFolder = zip.folder('public');
    for (const item of pubItems) {
      if (!item.endsWith('.zip')) {
        const fullPath = path.join('public', item);
        if (fs.statSync(fullPath).isFile()) {
          pubFolder.file(item, fs.readFileSync(fullPath));
        }
      }
    }
  }

  if (fs.existsSync('android')) {
    addDir('android', zip.folder('android'));
  }

  fs.mkdirSync('public', { recursive: true });
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync('public/SoundAlive-Galaxy-J2-Core-Proyecto.zip', content);
  console.log('Successfully created public/SoundAlive-Galaxy-J2-Core-Proyecto.zip (' + content.length + ' bytes)');
}

buildZip().catch(console.error);
