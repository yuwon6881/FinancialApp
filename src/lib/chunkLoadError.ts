/** Browser wording varies for a missing or stale dynamic-import chunk, especially on mobile. */
export function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`.toLowerCase()
  return message.includes('dynamically imported module')
    || message.includes('module script failed')
    || message.includes('chunkloaderror')
    || message.includes('loading chunk')
    || message === 'typeerror load failed'
}
