import { getErrorMessage, getStatus } from './errors'

/**
 * Maps one server rejection onto a form field.
 *
 * Client-side pre-checks can never be authoritative — the row can change
 * between load and submit, and some rules (a name taken in another tab, a
 * category still referenced by a document) only exist on the server. So every
 * form keeps its optimistic validation *and* routes the eventual rejection
 * back onto the field that caused it, instead of firing a toast the user has
 * to read over the top of their own modal.
 */
export interface ServerFieldRule<TField extends string> {
  /** The field that receives the message. */
  field: TField
  /**
   * Lowercased substrings; the rule matches when the message contains any of
   * them. An empty list matches on `status` alone, for responses (404, 423)
   * whose body carries no useful message.
   */
  match: string[]
  /** Optional status narrowing, e.g. only treat a 409 as a duplicate. */
  status?: number
  /** Copy shown instead of the raw server message. */
  message?: string
}

export interface MappedServerFieldError<TField extends string> {
  field: TField
  message: string
}

/**
 * Returns the field/message pair for the first matching rule, or `null` when
 * the error is not a field-level problem (offline, 500, auth) and therefore
 * still belongs in a toast.
 */
export function mapServerErrorToField<TField extends string>(
  error: unknown,
  rules: readonly ServerFieldRule<TField>[],
): MappedServerFieldError<TField> | null {
  const rawMessage = getErrorMessage(error, '')
  const haystack = rawMessage.toLowerCase()
  const status = getStatus(error)

  for (const rule of rules) {
    if (rule.status !== undefined && status !== rule.status) continue
    const matchesMessage = rule.match.length === 0
      ? rule.status !== undefined
      : rule.match.some(needle => haystack.includes(needle.toLowerCase()))
    if (!matchesMessage) continue
    return { field: rule.field, message: rule.message || rawMessage || 'This value was rejected.' }
  }

  return null
}

/**
 * Applies {@link mapServerErrorToField} and reports whether the error was
 * consumed, so callers can write `if (!applyServerFieldError(...)) showToast(...)`.
 */
export function applyServerFieldError<TField extends string>(
  error: unknown,
  rules: readonly ServerFieldRule<TField>[],
  apply: (mapped: MappedServerFieldError<TField>) => void,
): boolean {
  const mapped = mapServerErrorToField(error, rules)
  if (!mapped) return false
  apply(mapped)
  return true
}
