// One-off generator: renders the black "F" brand tile into every PNG icon the
// PWA manifest and iOS need.
import sharp from 'sharp'

const F_PATH = 'M30 32h40v8H38v12h28v8H38v16h-8V32z'

// Keep standard and maskable assets visually identical. Installed browsers may
// choose either purpose for the launcher icon and generated splash screen.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" fill="#0b0e14" />
  <path d="${F_PATH}" fill="#ffffff" />
</svg>`

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect width="100" height="100" fill="#0b0e14" />
  <path d="${F_PATH}" fill="#ffffff" />
</svg>`

const jobs = [
  [tile, 192, 'public/icon-192.png'],
  [tile, 512, 'public/icon-512.png'],
  [maskable, 192, 'public/icon-192-maskable.png'],
  [maskable, 512, 'public/icon-512-maskable.png'],
  [maskable, 180, 'public/apple-touch-icon.png'],
]

for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}
