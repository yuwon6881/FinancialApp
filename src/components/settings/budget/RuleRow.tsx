import { useId, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { FormFieldContext } from '../../ui/formFieldControl'

interface RuleRowProps {
  label: ReactNode
  /** One quiet line under the label saying what the setting does. */
  hint?: ReactNode
  /** The control itself; it picks up its id, label and error wiring from the row. */
  children: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
}

/**
 * One row of a grouped settings list: what the setting is on the left, its value -- as the live
 * control -- on the right. The value is the control, so a rule is changed where it is read rather
 * than in a form somewhere below it.
 *
 * Wires the control through the same context `FormField` uses, so the label, hint and error are its
 * accessible name and description exactly as they were in the stacked form. The row wraps under a
 * narrow container, putting a wide control under its label instead of squeezing both.
 */
export function RuleRow({ label, hint, children, error, required = false, className }: RuleRowProps) {
  const generatedId = useId().replace(/:/g, '')
  const controlId = `rule-${generatedId}`
  const labelId = `${controlId}-label`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FormFieldContext.Provider value={{ controlId, labelledBy: labelId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('px-4 py-3 sm:px-5', className)}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-[1_1_9rem]">
            <label id={labelId} htmlFor={controlId} className="block text-body font-medium text-foreground">
              {label}
              {required && <span className="sr-only"> (required)</span>}
            </label>
            {hint && <p id={hintId} className="mt-0.5 text-caption text-muted-foreground">{hint}</p>}
          </div>
          <div className="ml-auto flex min-w-0 max-w-full shrink-0 justify-end">{children}</div>
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-caption font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  )
}
