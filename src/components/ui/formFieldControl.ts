import {
  createContext,
  useContext,
  type AriaAttributes,
} from 'react'

export interface FormFieldContextValue {
  controlId: string
  labelledBy: string
  describedBy?: string
  invalid: boolean
  required: boolean
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(null)

export interface FormControlAccessibilityProps {
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: AriaAttributes['aria-invalid']
  'aria-required'?: AriaAttributes['aria-required']
}

export function useFormFieldControlProps<T extends FormControlAccessibilityProps>(
  props: T,
): T & FormControlAccessibilityProps {
  const field = useContext(FormFieldContext)
  if (!field) return props

  const describedBy = [props['aria-describedby'], field.describedBy]
    .filter(Boolean)
    .join(' ') || undefined

  return {
    ...props,
    id: props.id ?? field.controlId,
    'aria-labelledby': props['aria-labelledby'] ?? field.labelledBy,
    'aria-describedby': describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
    'aria-required': props['aria-required'] ?? (field.required || undefined),
  }
}
