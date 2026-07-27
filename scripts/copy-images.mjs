import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const items = [
  ['dist/รูป', 'public/รูป'],
  ['dist/รูป_web', 'public/รูป_web']
];

for (const [src, dest] of items) {
  const srcPath = path.resolve(src);
  const destPath = path.resolve(dest);
  if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
    const cmd = `xcopy "${srcPath}" "${destPath}\\" /E /I /Y > nul`;
    try {
      execSync(cmd, { shell: true });
      console.log(`Copied ${src} -> ${dest}`);
    } catch (e) {
      console.error(`Failed to copy ${src}:`, e.message);
    }
  }
}
