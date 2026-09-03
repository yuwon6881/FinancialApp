import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  label: string
  children: ReactNode
  variant?: ButtonVariant
  tooltip?: string
  loading?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip, children, variant = 'tertiary', ...props }, ref) => (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      aria-label={label}
      title={tooltip ?? label}
      {...props}
    >
      {children}
    </Button>
  ),
)
IconButton.displayName = 'IconButton'
