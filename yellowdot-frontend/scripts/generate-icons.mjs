/**
 * generate-icons.mjs
 * Generates ALL Yellow Dot PWA icons and splash screens from the real logo PNG.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir   = dirname(fileURLToPath(import.meta.url));
const root    = join(__dir, '..');
const outDir  = join(root, 'public', 'icons');
const srcLogo = join(outDir, 'logo-original.png');

await mkdir(outDir, { recursive: true });
await mkdir(join(outDir, 'splash'), { recursive: true });

// White background — the sun logo is yellow, so white gives maximum contrast
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
// Yellow for splash screens (full-bleed brand background)
const YELLOW = { r: 244, g: 196, b: 0, alpha: 1 };

// ─── Rounded-corner mask ──────────────────────────────────────────────────────
function roundedMaskSvg(size, radius) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>` +
    `</svg>`
  );
}

// ─── Helper: logo composited on white square, with rounded corners ────────────
// logoFraction: what fraction of canvasSize the logo occupies (0–1)
async function makeIcon(canvasSize, logoFraction, { radius = 0 } = {}) {
  const logoSize = Math.round(canvasSize * logoFraction);
  const offset   = Math.round((canvasSize - logoSize) / 2);

  // Step 1 — resize logo
  const logoBuf = await sharp(srcLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Step 2 — composite logo onto white square → intermediate PNG buffer
  const composite1 = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: WHITE },
  })
    .composite([{ input: logoBuf, left: offset, top: offset }])
    .png()
    .toBuffer();

  if (radius <= 0) return composite1;

  // Step 3 — apply rounded-corner mask via dest-in on the intermediate buffer
  const maskBuf = await sharp(roundedMaskSvg(canvasSize, radius)).png().toBuffer();

  return sharp(composite1)
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─── 1. App icons ─────────────────────────────────────────────────────────────
console.log('Generating app icons…');

const ICON_DEFS = [
  { canvas: 64,  frac: 0.88, name: 'pwa-64x64.png',               radius: 12 },
  { canvas: 180, frac: 0.88, name: 'apple-touch-icon-180x180.png', radius: 32 },
  { canvas: 192, frac: 0.88, name: 'pwa-192x192.png',              radius: 35 },
  { canvas: 512, frac: 0.88, name: 'pwa-512x512.png',              radius: 92 },
];

for (const { canvas, frac, name, radius } of ICON_DEFS) {
  const buf = await makeIcon(canvas, frac, { radius });
  await writeFile(join(outDir, name), buf);
  console.log(`  ✔ ${name}`);
}

// Maskable — logo in 60 % of canvas so it stays within the 80 % safe zone
{
  const buf = await makeIcon(512, 0.60, { radius: 0 });
  await writeFile(join(outDir, 'maskable-icon-512x512.png'), buf);
  console.log('  ✔ maskable-icon-512x512.png');
}

// favicon.ico — 64 px PNG (browsers accept PNG inside the .ico slot)
{
  const buf = await makeIcon(64, 0.88, { radius: 12 });
  await writeFile(join(outDir, 'favicon.ico'), buf);
  console.log('  ✔ favicon.ico');
}

// ─── 2. favicon.svg — embeds 512-px icon as base64 ───────────────────────────
{
  const iconBuf = await makeIcon(512, 0.88, { radius: 92 });
  const b64     = iconBuf.toString('base64');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 512 512" width="512" height="512">` +
    `<image href="data:image/png;base64,${b64}" width="512" height="512"/>` +
    `</svg>`;
  await writeFile(join(root, 'public', 'favicon.svg'), svg);
  console.log('  ✔ favicon.svg');
}

// ─── 3. Splash screens (yellow bg, logo centred, slightly above middle) ───────
console.log('Generating splash screens…');

const SPLASH_SIZES = [
  [1290, 2796],  // iPhone 16 Pro Max
  [1179, 2556],  // iPhone 16 / 15 Pro
  [1284, 2778],  // iPhone 14 Plus / 15 Plus
  [750,  1334],  // iPhone SE
  [1668, 2388],  // iPad Pro 11″
  [2048, 2732],  // iPad Pro 12.9″
];

for (const [w, h] of SPLASH_SIZES) {
  const logoSize = Math.round(Math.min(w, h) * 0.30);
  const logoBuf  = await sharp(srcLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const left = Math.round((w - logoSize) / 2);
  const top  = Math.round(h / 2 - logoSize / 2 - h * 0.04); // slightly above centre

  const fname = `apple-splash-${w}-${h}.png`;
  await sharp({ create: { width: w, height: h, channels: 4, background: YELLOW } })
    .composite([{ input: logoBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, 'splash', fname));

  console.log(`  ✔ ${fname}`);
}

// ─── 4. Update source reference ───────────────────────────────────────────────
// Keep source.svg as a note — actual source is logo-original.png
await writeFile(
  join(outDir, 'source.svg'),
  `<!-- Source icon is logo-original.png (1024×1024 PNG). Run scripts/generate-icons.mjs to regenerate. -->`
);

console.log('\n✅  All Yellow Dot icons generated from real logo.');
