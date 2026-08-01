export type DocumentSort =
  | 'uploaded-desc'
  | 'uploaded-asc'
  | 'name-asc'
  | 'name-desc'
  | 'amount-desc'
  | 'amount-asc'

export const DOCUMENT_SORT_OPTIONS: { value: DocumentSort; label: string }[] = [
  { value: 'uploaded-desc', label: 'Newest' },
  { value: 'uploaded-asc', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'amount-desc', label: 'Amount high' },
  { value: 'amount-asc', label: 'Amount low' },
]
