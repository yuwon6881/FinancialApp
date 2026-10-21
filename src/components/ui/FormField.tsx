import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
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
  const labelRef = useRef<HTMLLabelElement>(null)

  // `for` is pointed at the control only while one carrying `controlId` is mounted. Some fields
  // hold a group instead (the transaction form's category tiles, whose "More categories" select
  // only appears past a certain count), and a `for` naming no element is flagged by the browser as
  // a broken label. The group stays named through `labelledBy` either way. Runs on every render
  // because the control can come and go with the field's own content.
  useLayoutEffect(() => {
    const label = labelRef.current
    if (!label) return
    if (document.getElementById(controlId)) label.htmlFor = controlId
    else label.removeAttribute('for')
  })

  const labelElement = (
    <label
      ref={labelRef}
      id={labelId}
      className={cn(
        'block text-label font-medium text-muted-foreground',
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
          <p id={hintId} className={cn('text-caption text-muted-foreground', hintClassName)}>
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className={cn(
              'text-caption font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-150',
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
