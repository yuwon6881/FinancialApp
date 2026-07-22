import React from 'react'

// Hardware-accelerated CSS grid-rows accordion transition -- runs on native compositor threads at 60/120fps
// without JS layout measurement overhead.
export const CollapsibleBody: React.FC<{ open: boolean; children: React.ReactNode; className?: string }> = ({
  open,
  children,
  className = ''
}) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
    } ${className}`}
  >
    <div className="overflow-hidden min-h-0">
      {children}
    </div>
  </div>
)
