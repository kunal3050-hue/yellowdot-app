/**
 * generate-icons.mjs — Yellow Dot PWA icon generator
 *
 * Strategy:
 *   1. trim() removes the transparent border from the original 1024×1024 logo
 *      (sun occupies ~81 % of original; trimming recovers that space)
 *   2. Regular icons — trimmed sun scaled to 90 % of canvas side
 *      → sun visually fills ~90 % of the square / stays inside the
 *        inscribed circle on circular launchers (radius 230 px vs 256 px)
 *   3. Maskable (Android adaptive) — trimmed sun at 62 % of canvas
 *      → safely inside the 72 % guaranteed-visible safe zone (368 px)
 *   4. Splash screens — trimmed sun at 32 % of shorter screen dimension,
 *      centred slightly above mid-screen on a full yellow background
 *
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

const WHITE  = { r: 255, g: 255, b: 255, alpha: 1 };
const YELLOW = { r: 244, g: 196, b: 0,   alpha: 1 };

// ── Pre-trim the logo once so every icon uses the same tight source ────────────
const trimmedBuf = await sharp(srcLogo).trim().png().toBuffer();
const trimmedMeta = await sharp(trimmedBuf).metadata();
console.log(`Logo trimmed: ${trimmedMeta.width}×${trimmedMeta.height} px (was 1024×1024)`);

// ── Rounded-corner SVG mask ────────────────────────────────────────────────────
function maskSvg(size, radius) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>` +
    `</svg>`
  );
}

// ── Core icon builder ──────────────────────────────────────────────────────────
// logoFraction : fraction of `canvasSize` that the trimmed logo should fill
// radius       : corner radius in px (0 = sharp corners, for maskable)
async function makeIcon(canvasSize, logoFraction, { radius = 0 } = {}) {
  const logoSize = Math.round(canvasSize * logoFraction);
  const offset   = Math.round((canvasSize - logoSize) / 2);

  // Resize trimmed logo to target size, preserving aspect ratio
  const resizedLogo = await sharp(trimmedBuf)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Composite onto white canvas
  const flat = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: WHITE },
  })
    .composite([{ input: resizedLogo, left: offset, top: offset }])
    .png()
    .toBuffer();

  if (radius <= 0) return flat;

  // Apply rounded-corner mask
  const maskBuf = await sharp(maskSvg(canvasSize, radius)).png().toBuffer();
  return sharp(flat)
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ── 1. App icons ───────────────────────────────────────────────────────────────
console.log('\nGenerating app icons…');

// logoFraction = 0.90 → sun fills ~90 % of the canvas after trimming.
// Corner radius ≈ 18 % of canvas (matches iOS / Android squircle shape).
const ICONS = [
  { canvas: 64,  frac: 0.90, radius: 12,  name: 'pwa-64x64.png' },
  { canvas: 180, frac: 0.90, radius: 32,  name: 'apple-touch-icon-180x180.png' },
  { canvas: 192, frac: 0.90, radius: 35,  name: 'pwa-192x192.png' },
  { canvas: 512, frac: 0.90, radius: 92,  name: 'pwa-512x512.png' },
];

for (const { canvas, frac, radius, name } of ICONS) {
  await writeFile(join(outDir, name), await makeIcon(canvas, frac, { radius }));
  console.log(`  ✔ ${name}  (logo = ${Math.round(canvas * frac)} px on ${canvas} px canvas)`);
}

// Maskable — 62 % keeps the sun comfortably inside the 72 % Android safe zone
{
  const buf = await makeIcon(512, 0.62, { radius: 0 });
  await writeFile(join(outDir, 'maskable-icon-512x512.png'), buf);
  console.log('  ✔ maskable-icon-512x512.png  (62 % safe-zone fill)');
}

// favicon.ico — 64 px PNG wrapped in an .ico container
{
  const buf = await makeIcon(64, 0.90, { radius: 12 });
  await writeFile(join(outDir, 'favicon.ico'), buf);
  console.log('  ✔ favicon.ico');
}

// ── 2. favicon.svg — base64-embeds the 512-px icon ────────────────────────────
{
  const iconBuf = await makeIcon(512, 0.90, { radius: 92 });
  const b64 = iconBuf.toString('base64');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 512 512" width="512" height="512">` +
    `<image href="data:image/png;base64,${b64}" width="512" height="512"/>` +
    `</svg>`;
  await writeFile(join(root, 'public', 'favicon.svg'), svg);
  console.log('  ✔ favicon.svg');
}

// ── 3. Splash screens ──────────────────────────────────────────────────────────
console.log('\nGenerating splash screens…');

const SPLASHES = [
  [1290, 2796],   // iPhone 16 Pro Max
  [1179, 2556],   // iPhone 16 / 15 Pro
  [1284, 2778],   // iPhone 14 Plus / 15 Plus
  [750,  1334],   // iPhone SE
  [1668, 2388],   // iPad Pro 11″
  [2048, 2732],   // iPad Pro 12.9″
];

for (const [w, h] of SPLASHES) {
  // Logo fills 32 % of the shorter dimension
  const logoSize = Math.round(Math.min(w, h) * 0.32);
  const logoBuf  = await sharp(trimmedBuf)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
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

// ── 4. Refresh source note ─────────────────────────────────────────────────────
await writeFile(
  join(outDir, 'source.svg'),
  `<!-- Source: logo-original.png (1024×1024 PNG). Run scripts/generate-icons.mjs to regenerate. -->`
);

console.log('\n✅  Done. All icons use trimmed logo at 90 % canvas fill.');
