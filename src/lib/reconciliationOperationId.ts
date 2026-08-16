export const RECONCILIATION_OPERATION_ID_LIMIT = 60

export function sanitizeReconciliationOperationId(value: string): string {
  const safe = [...value]
    .filter(character => /[A-Za-z0-9_-]/.test(character))
    .slice(0, RECONCILIATION_OPERATION_ID_LIMIT)
    .join('')
  return safe || 'operation'
}
