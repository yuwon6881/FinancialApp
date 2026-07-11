interface BorderBeamProps {
  className?: string
}

/**
 * A single unified beam that travels around the parent's border, regardless of
 * the element's aspect ratio. Implemented as a rotating conic-gradient ring
 * masked to the border (see `.ai-beam` in index.css) rather than an SVG dash,
 * which fragmented into multiple segments on long/stretched elements.
 *
 * The parent must be `position: relative` and carry the desired `border-radius`
 * (the `.ai-border-beam` helper class provides the positioning).
 */
export function BorderBeam({ className = '' }: BorderBeamProps) {
  return <span aria-hidden="true" className={`ai-beam ${className}`} />
}
