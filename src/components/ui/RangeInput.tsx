import { forwardRef, type InputHTMLAttributes } from 'react'
import type React from 'react'
import { cn } from '../../lib/utils'
import { useFormFieldControlProps } from './formFieldControl'

export interface RangeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

export const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
  ({ invalid = false, className, style, ...props }, ref) => {
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })

    // The filled part of the track is painted from the value, so the slider reads as "this much"
    // at a glance rather than as a thumb floating on a grey line.
    const min = Number(props.min ?? 0)
    const max = Number(props.max ?? 100)
    const current = Number(props.value ?? props.defaultValue ?? min)
    const fill = max > min ? Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100)) : 0

    return (
      <input
        ref={ref}
        type="range"
        {...accessibleProps}
        style={{ ...style, '--range-fill': `${fill}%` } as React.CSSProperties}
        className={cn(
          'range-input h-2 w-full cursor-pointer appearance-none rounded-full py-2 -my-2 touch-none',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
    )
  },
)

RangeInput.displayName = 'RangeInput'
