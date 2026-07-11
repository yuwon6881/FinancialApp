interface BorderBeamProps {
  className?: string
}

export function BorderBeam({ className = '' }: BorderBeamProps) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full overflow-visible ${className}`}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <rect
        className="ai-border-beam__path"
        x="1"
        y="1"
        width="98"
        height="38"
        rx="11"
        pathLength="100"
        fill="none"
        stroke="var(--ledger-sky-500)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
