export interface MutationSuccessToast {
  title: string
  message: string
  tone: 'success'
}

interface MutationSuccessToastOptions {
  /** The record family shown in the title, for example "Savings Goal". */
  entity: string
  /** The completed operation shown in the title, for example "Updated". */
  action: string
  /** The affected record. When present, the message always identifies it first. */
  recordName?: string | null
  /** Optional verb when the message needs a more precise action than the title. */
  messageVerb?: string
  /** Optional detail after the standard record-first sentence. */
  messageSuffix?: string
  /** Use for batch/system mutations that need their own grammatical subject. */
  message?: string
}

const titleCase = (value: string): string => value.replace(/\b\w/g, letter => letter.toUpperCase())

const clean = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Shared success-copy shape for completed mutations:
 *
 *   Title:   <Entity> <Action>
 *   Message: "<record>" was <action>.
 *
 * Batch mutations can provide an explicit message while retaining the same entity/action title.
 */
export function buildMutationSuccessToast(options: MutationSuccessToastOptions): MutationSuccessToast {
  const entity = clean(options.entity) || 'Item'
  const action = clean(options.action) || 'Processed'
  const recordName = clean(options.recordName)
  const verb = clean(options.messageVerb) || action.toLowerCase()
  const standardMessage = recordName
    ? `"${recordName}" was ${verb}.`
    : `${titleCase(entity)} was ${verb}.`
  const message = options.message?.trim() || standardMessage

  return {
    title: `${titleCase(entity)} ${titleCase(action)}`,
    message: options.messageSuffix?.trim()
      ? `${message} ${options.messageSuffix.trim()}`
      : message,
    tone: 'success',
  }
}

/** Keep every reversible success on the same Undo title/body convention. */
export function buildUndoSuccessToast(recordName?: string | null, entity = 'item'): MutationSuccessToast {
  const name = clean(recordName)
  return {
    title: 'Undo successful',
    message: name
      ? `The change to "${name}" was undone.`
      : `The previous ${entity.toLowerCase()} change was undone.`,
    tone: 'success',
  }
}
