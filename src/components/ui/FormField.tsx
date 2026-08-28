import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { FormFieldContext } from './formFieldControl'

export interface FormFieldProps {
  label: ReactNode
  children: ReactNode
  /**
   * Sits beside the label, for an InfoHint explaining the field. Kept out of the `<label>`
   * itself so clicking it cannot forward the activation to the control it describes.
   */
  labelAction?: ReactNode
  id?: string
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  labelClassName?: string
  hintClassName?: string
  errorClassName?: string
}

export function FormField({
  label,
  children,
  labelAction,
  id,
  hint,
  error,
  required = false,
  className,
  labelClassName,
  hintClassName,
  errorClassName,
}: FormFieldProps) {
  const generatedId = useId()
  const controlId = id ?? `field-${generatedId.replace(/:/g, '')}`
  const labelId = `${controlId}-label`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const labelElement = (
    <label
      id={labelId}
      htmlFor={controlId}
      className={cn(
        'block text-xs font-bold text-muted-foreground',
        labelClassName,
      )}
    >
      {label}
      {required && (
        <>
          <span aria-hidden="true" className="ml-1 text-destructive">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  )

  return (
    <FormFieldContext.Provider
      value={{ controlId, labelledBy: labelId, describedBy, invalid: Boolean(error), required }}
    >
      <div className={cn('min-w-0 space-y-1.5', className)}>
        {labelAction
          ? <div className="flex min-w-0 items-center gap-1">{labelElement}{labelAction}</div>
          : labelElement}
        {children}
        {hint && (
          <p id={hintId} className={cn('text-xs leading-relaxed text-muted-foreground', hintClassName)}>
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className={cn(
              'text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-150',
              errorClassName,
            )}
          >
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  )
}
