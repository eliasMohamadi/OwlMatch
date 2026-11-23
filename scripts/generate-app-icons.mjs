// Generates the home-screen app icon(s) from the OwlMatch mark.
// Usage: node scripts/generate-app-icons.mjs   (re-run if the logo changes; commit the PNGs)
//
// iOS needs a PNG (it ignores SVG touch icons) and rounds the corners itself, so the
// icon is a full-bleed square: rounded or transparent corners would show as black gaps.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

/** Same mark as public/owlmatch-icon.svg and LogoMark, on a square (not rounded) black tile. */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="#000"/>
  <circle cx="18.5" cy="25" r="8.5" fill="none" stroke="#FFC629" stroke-width="4"/>
  <circle cx="29.5" cy="25" r="8.5" fill="none" stroke="#fff" stroke-width="4"/>
  <circle cx="18.5" cy="25" r="2.6" fill="#FFC629"/>
  <circle cx="29.5" cy="25" r="2.6" fill="#fff"/>
  <path d="M21 12.5 24 15.5 27 12.5" fill="none" stroke="#FFC629" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ICONS = [
  // iPhone/iPad home screen ("Add to Home Screen"). 180×180 is Apple's current size.
  { file: 'public/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of ICONS) {
  // Render the SVG at the target pixel size (density is DPI; the viewBox is 48 units at 72 DPI).
  const png = await sharp(Buffer.from(ICON_SVG), { density: (size / 48) * 72 })
    .resize(size, size)
    .flatten({ background: '#000000' }) // no alpha channel: iOS shows transparency as black anyway
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(file, png);
  console.log(`wrote ${file} (${size}×${size})`);
}
