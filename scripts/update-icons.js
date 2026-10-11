import fs from 'fs';
import path from 'path';

const sourceIcon = 'src/assets/images/app_icon_1791681014849.jpg';
const mipmapDirs = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi'
];

if (fs.existsSync(sourceIcon)) {
  const iconBuffer = fs.readFileSync(sourceIcon);
  for (const dir of mipmapDirs) {
    if (fs.existsSync(dir)) {
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), iconBuffer);
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), iconBuffer);
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), iconBuffer);
      console.log('Updated launcher icons in ' + dir);
    }
  }
} else {
  console.error('Source icon not found!');
}
