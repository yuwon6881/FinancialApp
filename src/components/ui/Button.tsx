import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  secondary: 'border border-border bg-background text-foreground shadow-xs hover:bg-muted/70',
  tertiary: 'border border-transparent bg-transparent text-foreground hover:bg-muted/70',
  destructive: 'border border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-xs gap-1.5 lg:min-h-9',
  md: 'min-h-11 px-4 text-sm gap-2',
  lg: 'min-h-11 px-5 text-sm gap-2',
  icon: 'size-11 p-0 lg:size-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: ReactNode
}

// Shared chip/solid button primitive -- extracted from the repeated
// edit/delete/confirm button markup duplicated across the list views.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, loadingLabel, className, type = 'button', children, disabled, 'aria-busy': ariaBusy, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || ariaBusy || undefined}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex select-none items-center justify-center rounded-control font-bold transition duration-150',
        'cursor-pointer active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading && <span className="sr-only">{children}</span>}
      {loadingLabel === undefined ? (
        // `contents`, not a grid cell: the wrapper must not become a layout box of its own. The
        // overlay version below reserves the wider of the two labels, which every caller that
        // stacks or spreads its own content -- a nav item, a metric tile, a menu row -- then had
        // squeezed into one centred inline row, because those children were laid out by the
        // wrapper instead of by the button's own `className`. Visibility is inherited, so it still
        // hides the children under the spinner while they keep reserving the button's size.
        <span aria-hidden={loading || undefined} className={cn('contents', loading && 'invisible')}>
          {children}
        </span>
      ) : (
        <span className="inline-grid min-w-0 items-center justify-center">
          <span
            aria-hidden={loading || undefined}
            className={cn('col-start-1 row-start-1 inline-flex min-w-0 items-center justify-center gap-2', loading && 'invisible')}
          >
            {children}
          </span>
          <span
            aria-hidden="true"
            className={cn('col-start-1 row-start-1 inline-flex items-center justify-center gap-2', !loading && 'invisible')}
          >
            <LoaderCircle className="size-4 animate-spin" />
            {loadingLabel}
          </span>
        </span>
      )}
      {loading && loadingLabel === undefined && (
        <span className="absolute inset-0 inline-flex items-center justify-center" aria-hidden="true">
          <LoaderCircle className="size-4 animate-spin" />
        </span>
      )}
    </button>
  ),
)
Button.displayName = 'Button'
