import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const items = [
  ['dist/รูป', 'public/รูป'],
  ['dist/รูป_web', 'public/รูป_web']
];

const isWindows = process.platform === 'win32';

for (const [src, dest] of items) {
  const srcPath = path.resolve(src);
  const destPath = path.resolve(dest);
  if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
    try {
      if (isWindows) {
        const cmd = `xcopy "${srcPath}" "${destPath}\\" /E /I /Y > nul`;
        execSync(cmd, { shell: true });
      } else {
        // macOS / Linux
        fs.mkdirSync(destPath, { recursive: true });
        execSync(`cp -r "${srcPath}/." "${destPath}/"`, { shell: true });
      }
      console.log(`✅ Copied ${src} -> ${dest}`);
    } catch (e) {
      console.error(`⚠️ Failed to copy ${src}:`, e.message);
      console.error('   You may need to copy the image folders manually from dist/ to public/');
    }
  } else if (!fs.existsSync(srcPath)) {
    console.log(`ℹ️ Source folder not found: ${src} (skipping — images may already be in public/)`);
  } else {
    console.log(`ℹ️ ${dest} already exists (skipping copy)`);
  }
}
