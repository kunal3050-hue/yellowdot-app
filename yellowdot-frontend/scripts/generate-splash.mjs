/**
 * generate-splash.mjs
 * Creates Apple PWA splash screens for common iPhone sizes.
 * Uses sharp (already installed as a transitive dep of @vite-pwa/assets-generator).
 *
 * Run: node scripts/generate-splash.mjs
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const out   = join(root, 'public', 'icons', 'splash');

await mkdir(out, { recursive: true });

// Sizes: [width, height] at physical pixels
const SIZES = [
  [1290, 2796],  // iPhone 16 Pro Max
  [1179, 2556],  // iPhone 16 / 15 Pro
  [1284, 2778],  // iPhone 14 Plus / 15 Plus
  [750,  1334],  // iPhone SE
];

// Yellow brand background
const BG = { r: 244, g: 196, b: 0, alpha: 1 };

// The bolt SVG we'll overlay — scaled to ~22% of the shorter dimension
const BOLT_FRACTION = 0.22;

for (const [w, h] of SIZES) {
  const boltSize = Math.round(Math.min(w, h) * BOLT_FRACTION);
  const cx = Math.round((w - boltSize) / 2);
  const cy = Math.round((h - boltSize) / 2);

  // Inline bolt SVG (same design as source.svg, square viewBox)
  const boltSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${boltSize}" height="${boltSize}" viewBox="0 0 512 512">
      <path d="M296,72 L184,272 H248 L212,440 L328,240 H264 Z" fill="#1E1B4B"/>
    </svg>
  `);

  const boltPng = await sharp(boltSvg).png().toBuffer();

  const filename = `apple-splash-${w}-${h}.png`;

  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: boltPng, left: cx, top: cy }])
    .png({ compressionLevel: 9 })
    .toFile(join(out, filename));

  console.log(`✔ ${filename}`);
}

console.log('✅ All splash screens generated.');
