import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { useFormFieldControlProps } from './formFieldControl'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ invalid = false, className, ...props }, ref) => {
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })

    return (
      <input
        ref={ref}
        type="checkbox"
        {...accessibleProps}
        className={cn(
          'size-4 shrink-0 cursor-pointer rounded border border-border bg-background accent-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          (accessibleProps['aria-invalid'] === true || accessibleProps['aria-invalid'] === 'true')
            && 'outline outline-1 outline-destructive',
          className,
        )}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
