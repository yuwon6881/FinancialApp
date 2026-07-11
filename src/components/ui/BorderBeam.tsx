import { useId } from 'react'

interface BorderBeamProps {
  className?: string
}

export function BorderBeam({ className = '' }: BorderBeamProps) {
  // Unique per instance so multiple beams on one page don't share (and clash on)
  // the same gradient id.
  const gradientId = useId()

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full overflow-visible ${className}`}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Calm blue-green accent: blue -> cyan -> soft green. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1677ff" />
          <stop offset="52%" stopColor="#36cfc9" />
          <stop offset="100%" stopColor="#95de64" />
        </linearGradient>
      </defs>
      <rect
        className="ai-border-beam__path"
        x="1"
        y="1"
        width="98"
        height="38"
        rx="11"
        pathLength="100"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
