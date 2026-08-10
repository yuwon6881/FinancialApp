const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB']

export const formatBytes = (bytes: number) => {
  // Guarded rather than trusted: a missing or malformed size used to reach Math.log and render as
  // "NaN undefined" on the card, and a total above GB ran off the end of the unit list.
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes'
  const k = 1024
  const index = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + BYTE_UNITS[index]
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
