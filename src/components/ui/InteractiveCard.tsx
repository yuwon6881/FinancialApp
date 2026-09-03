import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { panelClass } from './panelStyles'

export const InteractiveCard = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        panelClass,
        'interactive-card w-full cursor-pointer text-left transition duration-150 active:scale-[0.995]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  ),
)
InteractiveCard.displayName = 'InteractiveCard'
