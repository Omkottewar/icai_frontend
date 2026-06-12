// One-shot PWA icon generator. Takes the CA India brand mark and produces
// the icon sizes a PWA needs:
//
//   192x192, 512x512   — standard manifest icons (any-purpose)
//   512x512 maskable    — Android adaptive icon with a safe zone padded by 20%
//   180x180             — apple-touch-icon
//   favicon.ico (32x32) — browser tab
//
// The source logo is wider than it is tall, so we letter-box it onto a square
// brand-blue background, padding by ~20% so it reads on small launchers.
//
// Run: node scripts/gen-pwa-icons.mjs
//
// Re-run after any logo change. The output lands in /public so Vite serves
// it from the site root.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../src/assets/CA India Logo.png');
const OUT = resolve(__dirname, '../public');

// Brand blue used in the site header — also our PWA theme_color. Keep in
// sync with --primary in src/styles/index.css.
const BRAND_BG = { r: 30, g: 64, b: 175, alpha: 1 };

async function makeIcon(size, { padPct = 0.18, mask = false, bg = BRAND_BG } = {}) {
  const inner = Math.round(size * (1 - padPct * 2));
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((size - inner) / 2);
  const filename = mask ? `pwa-${size}-maskable.png` : `pwa-${size}.png`;

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(resolve(OUT, filename));

  return filename;
}

async function makeAppleTouchIcon() {
  // Apple home-screen — no maskable safe zone, slightly less padding.
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: BRAND_BG },
  })
    .composite([{
      input: await sharp(SRC).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      top: 20, left: 20,
    }])
    .png()
    .toFile(resolve(OUT, 'apple-touch-icon.png'));
  return 'apple-touch-icon.png';
}

async function makeFavicon() {
  // 32x32 favicon for the browser tab. PNG is fine — modern browsers accept it.
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: BRAND_BG },
  })
    .composite([{
      input: await sharp(SRC).resize(26, 26, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      top: 3, left: 3,
    }])
    .png()
    .toFile(resolve(OUT, 'favicon.png'));
  return 'favicon.png';
}

const written = [];
written.push(await makeIcon(192));
written.push(await makeIcon(512));
// Maskable variant uses larger padding (20%) so the safe zone covers the
// circle/squircle launchers crop into.
written.push(await makeIcon(512, { padPct: 0.20, mask: true }));
written.push(await makeAppleTouchIcon());
written.push(await makeFavicon());

console.log('Wrote:', written.join(', '));
