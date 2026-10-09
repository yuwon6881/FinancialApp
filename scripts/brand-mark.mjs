// The Lumen brand mark, defined once: the plan's four buckets (Essentials 50, Growth 25,
// Stability 15, Rewards 10) as segments of one ring, white on Iris. Every icon, splash and the
// in-app logo are drawn from these numbers -- the launcher scripts import this module, and the
// path data below is what `src/components/ui/AppLogo.tsx`, `public/favicon.svg` and the launch
// splash in `index.html` carry (`node scripts/brand-mark.mjs` prints it).
//
// Flat colour only: the design language has no gradients, and a launcher icon is read at 48px.

export const BRAND = {
  /** Iris, the Day primary. Also the launcher and favicon tile in both themes. */
  iris: '#4f49e6',
  mark: '#ffffff',
  canvasNight: '#090b11',
  canvasDay: '#f5f6f8',
}

const SHARES = [50, 25, 15, 10]
/** Ring geometry on a 100-unit tile: radius and stroke keep the mark inside every launcher safe zone. */
export const RING = { cx: 50, cy: 50, r: 21, width: 12, gapDeg: 10 }

function point(angleDeg, { cx, cy, r }) {
  const radians = (angleDeg - 90) * Math.PI / 180
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)]
}

/** One SVG arc path per bucket, clockwise from twelve o'clock, separated by equal gaps. */
export function segmentPaths(ring = RING) {
  const usable = 360 - SHARES.length * ring.gapDeg
  let angle = ring.gapDeg / 2
  return SHARES.map(share => {
    const sweep = usable * share / 100
    const [x1, y1] = point(angle, ring)
    const [x2, y2] = point(angle + sweep, ring)
    angle += sweep + ring.gapDeg
    const large = sweep > 180 ? 1 : 0
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${ring.r} ${ring.r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  })
}

/** The white ring alone, for adaptive foregrounds, monochrome icons and splash layers. */
export function markSvg({ size = 1024, color = BRAND.mark, scale = 1 } = {}) {
  const transform = scale === 1 ? '' : ` transform="translate(50 50) scale(${scale}) translate(-50 -50)"`
  const paths = segmentPaths().map(d => `<path d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><g fill="none" stroke="${color}" stroke-width="${RING.width}"${transform}>${paths}</g></svg>`
}

/** The full tile: Iris square (rounded when `radius` is set) with the ring on it. */
export function tileSvg({ size = 1024, radius = 0, background = BRAND.iris } = {}) {
  const paths = segmentPaths().map(d => `<path d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><rect width="100" height="100" rx="${radius}" fill="${background}"/><g fill="none" stroke="${BRAND.mark}" stroke-width="${RING.width}">${paths}</g></svg>`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(segmentPaths(), null, 2))
}
