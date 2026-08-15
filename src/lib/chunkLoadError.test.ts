import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './chunkLoadError'

describe('chunkLoadError', () => {
  it('detects standard dynamic import chunk loading errors', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://example.com/chunk.js'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 456 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 123 failed'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Load failed'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
    expect(isChunkLoadError(new Error('User aborted'))).toBe(false)
    expect(isChunkLoadError(new TypeError('Cannot read property of undefined'))).toBe(false)
  })
})
