const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB']

export const formatBytes = (bytes: number) => {
  // Guarded rather than trusted: a missing or malformed size used to reach Math.log and render as
  // "NaN undefined" on the card, and a total above GB ran off the end of the unit list.
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes'
  const k = 1024
  const index = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + BYTE_UNITS[index]
}

/** "92% sure" from the extractor's confidence (a 0-1 fraction or a percentage), or nothing without one. */
export const confidenceLabel = (confidence: number | null | undefined): string | null => {
  if (confidence == null || !Number.isFinite(confidence)) return null
  const percent = Math.round(confidence <= 1 ? confidence * 100 : confidence)
  return `${Math.max(0, Math.min(100, percent))}% sure`
}

/** "PDF", "JPG", "WEBP"… -- what a person calls the file, not its MIME type. */
export const formatFileKind = (contentType: string) => {
  const type = contentType.split(';', 1)[0].trim().toLowerCase()
  if (type === 'application/pdf') return 'PDF'
  if (type === 'image/jpeg') return 'JPG'
  if (type.startsWith('image/')) return type.slice('image/'.length).toUpperCase()
  return 'File'
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
