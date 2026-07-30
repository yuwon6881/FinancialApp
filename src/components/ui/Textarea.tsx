import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { controlClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  controlSize?: ControlSize
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ controlSize = 'md', invalid = false, className, ...props }, ref) => {
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })
    const isInvalid = accessibleProps['aria-invalid'] === true
      || accessibleProps['aria-invalid'] === 'true'

    return (
      <textarea
        ref={ref}
        {...accessibleProps}
        className={controlClassName({
          size: controlSize,
          invalid: isInvalid,
          className: cn('h-auto min-h-24 resize-y py-2.5 leading-relaxed', className),
        })}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
