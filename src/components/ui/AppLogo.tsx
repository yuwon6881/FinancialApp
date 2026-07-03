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
      className={`inline-flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''} ${className}`}
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
