/**
 * generate-icons.mjs
 * Generates ALL Yellow Dot PWA icons and splash screens from the master SVG.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/icons/favicon.ico           (16, 32, 48 multi-size)
 *   public/icons/pwa-64x64.png
 *   public/icons/pwa-192x192.png
 *   public/icons/pwa-512x512.png
 *   public/icons/maskable-icon-512x512.png  (extra padding for safe zone)
 *   public/icons/apple-touch-icon-180x180.png
 *   public/icons/splash/apple-splash-*.png  (4 iPhone sizes)
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = join(__dir, '..');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });
await mkdir(join(outDir, 'splash'), { recursive: true });

// ─── Brand colours ────────────────────────────────────────────────────────────
const YELLOW  = '#F4C400';
const NAVY    = '#1E1B4B';
const BG_RGBA = { r: 244, g: 196, b: 0, alpha: 1 };

// ─── Master icon SVG (512×512) ────────────────────────────────────────────────
// Yellow rounded-square background + bold navy lightning bolt.
// The bolt is deliberately wide so it stays legible at 16 px.
function masterIconSvg(size, { padding = 0, radius = null } = {}) {
  const rx = radius ?? Math.round(size * 0.18);  // ~18 % corner radius
  const p  = padding;                             // safe-zone inset for maskable

  // Bolt proportions relative to the drawable area
  const d  = size - p * 2;         // drawable square side
  const ox = p;                    // drawable origin x
  const oy = p;                    // drawable origin y

  // Bolt control points — designed to read well at 16 px and look bold at 512 px
  const pts = {
    // top-right tip
    tx: ox + d * 0.620, ty: oy + d * 0.085,
    // mid-left
    mlx: ox + d * 0.310, mly: oy + d * 0.525,
    // notch step-right (top half inner corner)
    nrx: ox + d * 0.495, nry: oy + d * 0.525,
    // bottom-left tip
    bx:  ox + d * 0.375, by:  oy + d * 0.930,
    // mid-right
    mrx: ox + d * 0.680, mry: oy + d * 0.480,
    // notch step-left (bottom half inner corner)
    nlx: ox + d * 0.500, nly: oy + d * 0.480,
  };

  const bolt = [
    `M${pts.tx},${pts.ty}`,
    `L${pts.mlx},${pts.mly}`,
    `H${pts.nrx}`,
    `L${pts.bx},${pts.by}`,
    `L${pts.mrx},${pts.mry}`,
    `H${pts.nlx}`,
    'Z',
  ].join(' ');

  return /* xml */`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${YELLOW}"/>
  <path d="${bolt}" fill="${NAVY}"/>
</svg>`.trim();
}

// Maskable icons need 20 % safe-zone padding on all sides
function maskableSvg(size) {
  return masterIconSvg(size, { padding: Math.round(size * 0.20), radius: 0 });
}

// Splash-screen bolt: transparent bg, just the bolt centred in a box
function splashBoltSvg(size) {
  const d   = size;
  const pts = {
    tx: d * 0.620, ty: d * 0.085,
    mlx: d * 0.310, mly: d * 0.525,
    nrx: d * 0.495, nry: d * 0.525,
    bx:  d * 0.375, by:  d * 0.930,
    mrx: d * 0.680, mry: d * 0.480,
    nlx: d * 0.500, nly: d * 0.480,
  };
  const bolt = [
    `M${pts.tx},${pts.ty}`,
    `L${pts.mlx},${pts.mly}`,
    `H${pts.nrx}`,
    `L${pts.bx},${pts.by}`,
    `L${pts.mrx},${pts.mry}`,
    `H${pts.nlx}`,
    'Z',
  ].join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}" width="${d}" height="${d}"><path d="${bolt}" fill="${NAVY}"/></svg>`;
}

async function svgToPng(svgString, size) {
  return sharp(Buffer.from(svgString))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─── 1. App icons ─────────────────────────────────────────────────────────────

console.log('Generating app icons…');

const ICON_SIZES = [64, 180, 192, 512];
for (const sz of ICON_SIZES) {
  const svg = masterIconSvg(sz);
  const buf = await svgToPng(svg, sz);
  const name =
    sz === 180  ? 'apple-touch-icon-180x180.png' :
    sz === 192  ? 'pwa-192x192.png' :
    sz === 512  ? 'pwa-512x512.png' :
                  `pwa-${sz}x${sz}.png`;
  await writeFile(join(outDir, name), buf);
  console.log(`  ✔ ${name}`);
}

// Maskable 512 (full-bleed, no radius, 20 % safe-zone padding)
{
  const svg = maskableSvg(512);
  const buf = await svgToPng(svg, 512);
  await writeFile(join(outDir, 'maskable-icon-512x512.png'), buf);
  console.log('  ✔ maskable-icon-512x512.png');
}

// ─── 2. Favicon ICO (multi-size: 16, 32, 48 px) ──────────────────────────────
// Sharp can't write .ico directly; we write a 48-px PNG at the ico path
// and rely on the SVG favicon for modern browsers. For max compat we write
// the PNG as .ico — browsers accept single-size PNGs in the ico slot.
{
  const svg = masterIconSvg(48);
  const buf = await svgToPng(svg, 48);
  await writeFile(join(outDir, 'favicon.ico'), buf);
  console.log('  ✔ favicon.ico (48 px PNG-inside-ICO)');
}

// ─── 3. Splash screens ───────────────────────────────────────────────────────

console.log('Generating splash screens…');

// [width, height] at physical pixels
const SPLASH_SIZES = [
  [1290, 2796],   // iPhone 16 Pro Max
  [1179, 2556],   // iPhone 16 / 15 Pro
  [1284, 2778],   // iPhone 14 Plus / 15 Plus
  [750,  1334],   // iPhone SE
  [1668, 2388],   // iPad Pro 11″
  [2048, 2732],   // iPad Pro 12.9″
];

for (const [w, h] of SPLASH_SIZES) {
  // Bolt sized at 22 % of the shorter dimension
  const boltSize = Math.round(Math.min(w, h) * 0.22);
  const cx = Math.round((w - boltSize) / 2);
  const cy = Math.round((h - boltSize) / 2);

  const boltBuf = await sharp(Buffer.from(splashBoltSvg(boltSize)))
    .resize(boltSize, boltSize)
    .png()
    .toBuffer();

  const fname = `apple-splash-${w}-${h}.png`;
  await sharp({ create: { width: w, height: h, channels: 4, background: BG_RGBA } })
    .composite([{ input: boltBuf, left: cx, top: cy }])
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, 'splash', fname));

  console.log(`  ✔ ${fname}`);
}

// ─── 4. Update source.svg ─────────────────────────────────────────────────────
await writeFile(join(outDir, 'source.svg'), masterIconSvg(512));
console.log('  ✔ source.svg (updated master)');

console.log('\n✅  All Yellow Dot icons generated successfully.');
