import { afterEach, describe, it, expect, vi } from 'vitest'
import { compressImageFile } from './imageCompression'

describe('compressImageFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('passes through PDF files unchanged', async () => {
    const pdf = new File(['%PDF-1.4 test content'], 'test.pdf', { type: 'application/pdf' })
    const result = await compressImageFile(pdf)
    expect(result).toBe(pdf)
  })

  it('passes through HEIC files unchanged', async () => {
    const heic = new File(['heic content'], 'photo.heic', { type: 'image/heic' })
    const result = await compressImageFile(heic)
    expect(result).toBe(heic)
  })

  it('passes through HEIF files unchanged', async () => {
    const heif = new File(['heif content'], 'photo.heif', { type: 'image/heif' })
    const result = await compressImageFile(heif)
    expect(result).toBe(heif)
  })

  it('passes through small images under 300KB', async () => {
    const smallImage = new File([new Uint8Array(100 * 1024)], 'small.jpg', { type: 'image/jpeg' })
    const result = await compressImageFile(smallImage)
    expect(result).toBe(smallImage)
  })

  it('resizes a large PNG and emits a smaller WebP file', async () => {
    const close = vi.fn()
    const drawImage = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 4000,
      height: 2000,
      close,
    }))
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(new Blob([new Uint8Array(50)], { type: 'image/webp' })),
    } as unknown as HTMLCanvasElement
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
      tagName === 'canvas' ? canvas : realCreateElement(tagName)) as typeof document.createElement)
    const png = new File([new Uint8Array(400 * 1024)], 'large.png', { type: 'image/png' })

    const result = await compressImageFile(png)

    expect(result).not.toBe(png)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('large.webp')
    expect(canvas.width).toBe(2000)
    expect(canvas.height).toBe(1000)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1000)
    expect(close).toHaveBeenCalledOnce()
  })
})
