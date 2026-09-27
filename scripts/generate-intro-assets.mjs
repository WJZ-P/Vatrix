// Builds the images the desktop app draws into the one-second intro, as QOI
// (lossless, and small enough to decode in a few lines of Rust):
//   app/src-tauri/assets/intro-logo.qoi   the icon master at 384×384
//   app/src-tauri/assets/intro-title.qoi  "VeilCast" in white, cropped to its ink
// Run from the repository root after changing the icon master or the wordmark:
//   node scripts/generate-intro-assets.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, root));
const ffmpeg = path('tools/ffmpeg/ffmpeg.exe');
const out = path('app/src-tauri/assets/');
mkdirSync(out, { recursive: true });
const encode = (rgba, width, height, name) => execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
  '-s', `${width}x${height}`, '-i', '-', '-frames:v', '1', '-c:v', 'qoi', `${out}${name}`], { input: rgba });

const logo = 384;
const logoRgba = execFileSync(ffmpeg, ['-v', 'error', '-i', path('assets/branding/veilcast-icon.png'),
  '-vf', `scale=${logo}:${logo}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 24 });
encode(logoRgba, logo, logo, 'intro-logo.qoi');

// White text on black; the grey level becomes the alpha of a white image.
const canvas = [1600, 400];
const font = 'C\\:/Windows/Fonts/segoeuib.ttf';
const grey = execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${canvas[0]}x${canvas[1]}:d=1,format=gray,` +
  `drawtext=fontfile='${font}':text='VeilCast':fontcolor=white:fontsize=256:x=40:y=40`,
  '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 24 });
let [left, top, right, bottom] = [canvas[0], canvas[1], -1, -1];
for (let y = 0; y < canvas[1]; y++) {
  for (let x = 0; x < canvas[0]; x++) {
    if (grey[y * canvas[0] + x] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
}
const [width, height] = [right - left + 1, bottom - top + 1];
const title = Buffer.alloc(width * height * 4, 255);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) title[(y * width + x) * 4 + 3] = grey[(top + y) * canvas[0] + left + x];
}
encode(title, width, height, 'intro-title.qoi');
console.log(`intro-logo.qoi ${logo}x${logo}, intro-title.qoi ${width}x${height} in ${out}`);
