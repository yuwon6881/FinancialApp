import { forwardRef, type InputHTMLAttributes } from 'react'
import { controlClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: ControlSize
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ controlSize = 'md', invalid = false, className, ...props }, ref) => {
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })
    const isInvalid = accessibleProps['aria-invalid'] === true
      || accessibleProps['aria-invalid'] === 'true'

    return (
      <input
        ref={ref}
        {...accessibleProps}
        className={controlClassName({
          size: controlSize,
          invalid: isInvalid,
          className,
        })}
      />
    )
  },
)

Input.displayName = 'Input'
