// Turns the supplied artwork into the icon master. The source PNG already has
// transparent rounded corners, but its tile is not quite opaque (alpha 250–253,
// export noise), which would let whatever is behind an icon show through.
// Alpha is scaled by 255/250: the tile becomes opaque, the anti-aliased edge
// keeps its shape; colours are untouched. Run from the repository root, then:
//   node scripts/generate-icons.mjs && node userscript/build.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, root));
const ffmpeg = path('tools/ffmpeg/ffmpeg.exe');
const source = path('assets/branding/vatrix-icon-v3-source.png');
const master = path('assets/branding/vatrix-icon.png');
const size = 1024;

const rgba = execFileSync(ffmpeg, ['-v', 'error', '-i', source, '-vf', `scale=${size}:${size}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
  { maxBuffer: 1 << 26 });
let opaque = 0;
for (let i = 3; i < rgba.length; i += 4) {
  rgba[i] = Math.min(255, Math.round((rgba[i] * 255) / 250));
  if (rgba[i] === 255) opaque++;
}
execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${size}x${size}`, '-i', '-', '-frames:v', '1', master], { input: rgba });
console.log(`${opaque} of ${size * size} pixels opaque; wrote ${master}`);
