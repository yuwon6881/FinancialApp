import React from 'react'

interface AppLogoProps {
  className?: string
  imageClassName?: string
  pulse?: boolean
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'size-9 rounded-xl',
  imageClassName = 'size-full',
  pulse = false
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 border border-border/60 bg-[#1a1f2e] ring-1 ring-blue-500/10 shadow-md shadow-blue-500/10 dark:border-sky-400/25 dark:ring-sky-400/35 dark:shadow-[0_0_18px_rgba(56,189,248,0.28)] ${pulse ? 'animate-pulse' : ''} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/favicon.svg"
        alt=""
        draggable={false}
        className={`select-none ${imageClassName}`}
      />
    </div>
  )
}
