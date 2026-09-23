import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  getUri: vi.fn(),
  share: vi.fn(),
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: native.writeFile,
    appendFile: native.appendFile,
    getUri: native.getUri,
  },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }))

describe('native file sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    native.writeFile.mockResolvedValue(undefined)
    native.appendFile.mockResolvedValue(undefined)
    native.getUri.mockResolvedValue({ uri: 'file:///cache/export.csv' })
    native.share.mockResolvedValue(undefined)
  })

  it('stores the export in app cache before opening the native share sheet', async () => {
    const { shareBlobAsNativeFile } = await import('./shareFile')

    await shareBlobAsNativeFile(new Blob(['account,total\nMain,12']), '../ledger.csv')

    expect(native.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^exports\/\d+-[0-9a-f-]+-_ledger\.csv$/i),
      data: 'YWNjb3VudCx0b3RhbApNYWluLDEy',
      directory: 'CACHE',
      recursive: true,
    }))
    expect(native.getUri).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE' }))
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({
      files: ['file:///cache/export.csv'],
      dialogTitle: 'Save or share file',
    }))
  })
})
