import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-transparent',
  ghost: 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/15',
  danger: 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/15',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-[10px] gap-1',
  md: 'px-3 py-2 text-xs gap-1.5',
  // Matches the header "New Subscription"/"Post Transaction"-style CTA buttons;
  // callers add rounded-xl + shadow-lg via className since only those CTAs want it.
  lg: 'px-4 py-2.5 text-sm gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

// Shared chip/solid button primitive -- extracted from the repeated
// edit/delete/confirm button markup duplicated across the list views.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold cursor-pointer transition duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'
