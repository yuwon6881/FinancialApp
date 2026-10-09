import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

/**
 * Lumen actions are pills. `primary` is ink -- near-black in Day, near-white in Night -- so the one
 * action that matters is the most decisive shape on the page without spending the brand colour,
 * which stays reserved for "you are here". `secondary` is a quiet filled pill, `tertiary` is text
 * until it is hovered, and `destructive` is the one place red appears on an action.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-ink text-ink-foreground shadow-xs hover:bg-ink/88',
  secondary: 'border border-border/80 bg-background text-foreground hover:bg-surface-2 dark:bg-surface-2 dark:hover:bg-surface-3',
  tertiary: 'border border-transparent bg-transparent text-foreground hover:bg-surface-2',
  destructive: 'border border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3.5 py-2 text-label gap-1.5 lg:min-h-9',
  md: 'min-h-12 px-4.5 text-body font-semibold gap-2 lg:min-h-10',
  lg: 'min-h-13 px-6 text-callout font-semibold gap-2.5 lg:min-h-12',
  icon: 'size-11 p-0 lg:size-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: ReactNode
}

// The shared action primitive. Every feature action composes this rather than a raw <button>.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, loadingLabel, className, type = 'button', children, disabled, 'aria-busy': ariaBusy, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-button-size={size}
      aria-busy={loading || ariaBusy || undefined}
      disabled={disabled || loading}
      className={cn(
        'shared-button relative inline-flex select-none items-center justify-center rounded-full font-medium',
        'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-fluid',
        'cursor-pointer active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
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
