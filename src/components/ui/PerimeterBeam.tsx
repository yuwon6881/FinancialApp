import type { CSSProperties } from 'react'

interface PerimeterBeamProps {
  className?: string
  duration?: number
  radius?: number
  size?: number
}

type PerimeterBeamStyle = CSSProperties & {
  '--perimeter-beam-duration': string
  '--perimeter-beam-radius': string
  '--perimeter-beam-size': string
}

/**
 * A quiet, border-only activity indicator. The moving color segment is clipped
 * to a one-pixel perimeter and never paints or glows through the host content.
 * The host must use `perimeter-beam-host` while this element is mounted.
 */
export function PerimeterBeam({
  className = '',
  duration = 5.5,
  radius = 12,
  size = 88,
}: PerimeterBeamProps) {
  const style: PerimeterBeamStyle = {
    '--perimeter-beam-duration': `${duration}s`,
    '--perimeter-beam-radius': `${radius}px`,
    '--perimeter-beam-size': `${size}px`,
  }

  return <span aria-hidden="true" className={`perimeter-beam ${className}`} style={style} />
}
