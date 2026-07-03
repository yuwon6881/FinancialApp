import React from 'react'

interface AppLogoProps {
  className?: string
  imageClassName?: string
  pulse?: boolean
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'size-9 rounded-xl',
  imageClassName = 'size-[78%]',
  pulse = false
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 border border-border/60 bg-white/95 shadow-md shadow-blue-500/10 dark:bg-slate-950/90 ${pulse ? 'animate-pulse' : ''} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/favicon.svg"
        alt=""
        draggable={false}
        className={`select-none drop-shadow-sm ${imageClassName}`}
      />
    </div>
  )
}
