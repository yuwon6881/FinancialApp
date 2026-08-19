import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { useFormFieldControlProps } from './formFieldControl'

export interface RangeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

export const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
  ({ invalid = false, className, ...props }, ref) => {
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })

    return (
      <input
        ref={ref}
        type="range"
        {...accessibleProps}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary py-2 -my-2 touch-none',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
    )
  },
)

RangeInput.displayName = 'RangeInput'
