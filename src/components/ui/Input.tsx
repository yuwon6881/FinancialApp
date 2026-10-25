import { forwardRef, useCallback, useRef, type InputHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { controlClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'
import { IconButton } from './IconButton'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: ControlSize
  invalid?: boolean
  /**
   * Opts the field into a trailing clear button, shown while it holds text. Called on press; the
   * caller empties its own state, and focus returns to the field so the replacement can be typed.
   */
  onClear?: () => void
  /** Accessible name for the clear button. */
  clearLabel?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ controlSize = 'md', invalid = false, className, onClear, clearLabel = 'Clear', ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null)
    const setRef = useCallback((node: HTMLInputElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }, [ref])
    const accessibleProps = useFormFieldControlProps({
      ...props,
      'aria-invalid': props['aria-invalid'] ?? (invalid || undefined),
    })
    const isInvalid = accessibleProps['aria-invalid'] === true
      || accessibleProps['aria-invalid'] === 'true'

    const showClear = onClear !== undefined
      && !props.disabled
      && !props.readOnly
      && typeof props.value === 'string'
      && props.value.length > 0

    const input = (
      <input
        ref={setRef}
        {...accessibleProps}
        className={controlClassName({
          size: controlSize,
          invalid: isInvalid,
          className: cn(onClear && 'pr-11 lg:pr-10', className),
        })}
      />
    )
    if (!onClear) return input

    return (
      <div className="relative">
        {input}
        {showClear && (
          <IconButton
            label={clearLabel}
            tooltip={clearLabel}
            // Pressing it must not blur the field first: that would close an open suggestion list
            // and run blur-time work before the text is even gone.
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onClear()
              innerRef.current?.focus()
            }}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
