import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'destructiveGhost'
  | 'success'
  | 'successGhost'
  | 'danger'
  | 'unstyled'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80 border border-transparent',
  secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-muted',
  outline: 'border border-border bg-background text-foreground hover:bg-muted/70',
  ghost: 'border border-transparent bg-transparent text-foreground hover:bg-muted/70',
  destructive: 'border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
  destructiveGhost: 'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
  success: 'border border-transparent bg-emerald-600 text-on-vivid hover:bg-emerald-700',
  successGhost: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
  // Compatibility alias while existing list actions migrate to the explicit name.
  danger: 'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
  unstyled: '',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-[10px] gap-1',
  sm: 'px-2.5 py-1.5 text-[10px] gap-1',
  md: 'min-h-11 px-3 py-2 text-xs gap-1.5 sm:min-h-0',
  // Matches the header "New Subscription"/"Post Transaction"-style CTA buttons;
  // callers add rounded-xl + shadow-lg via className since only those CTAs want it.
  lg: 'min-h-11 px-4 py-2.5 text-sm gap-2',
  // Phones keep the 44px touch target; pointer-first layouts use the compact 36px control.
  icon: 'size-11 p-0 sm:size-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

// Shared chip/solid button primitive -- extracted from the repeated
// edit/delete/confirm button markup duplicated across the list views.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size, className, type = 'button', children, ...props }, ref) => {
    const resolvedSize = size ?? (variant === 'unstyled' ? undefined : 'md')

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring select-none cursor-pointer',
          variant !== 'unstyled'
            && 'inline-flex items-center justify-center rounded-lg font-bold select-none cursor-pointer transition duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          VARIANT_CLASSES[variant],
          resolvedSize && SIZE_CLASSES[resolvedSize],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
