// One-off generator: renders the "F" brand mark (same design as the inline
// splash in index.html and public/favicon.svg) into every PNG icon the PWA
// manifest and iOS need. Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'

const F_PATH = 'M30 32h40v8H38v12h28v8H38v16h-8V32z'

// Rounded tile with transparent corners — for purpose:"any" icons.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" rx="22" fill="#1a1f2e" />
  <path d="${F_PATH}" fill="#60a5fa" />
</svg>`

// Full-bleed square, F enlarged but inside the 80% maskable safe zone — for
// purpose:"maskable" icons (Android splash) and the iOS apple-touch-icon.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" fill="#1a1f2e" />
  <g transform="translate(50 50) scale(1.25) translate(-50 -52)">
    <path d="${F_PATH}" fill="#60a5fa" />
  </g>
</svg>`

const jobs = [
  [tile, 192, 'public/icon-192.png'],
  [tile, 512, 'public/icon-512.png'],
  [square, 192, 'public/icon-192-maskable.png'],
  [square, 512, 'public/icon-512-maskable.png'],
  [square, 180, 'public/apple-touch-icon.png'],
]

for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}
