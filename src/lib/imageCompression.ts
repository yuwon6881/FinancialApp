export interface CompressOptions {
  maxEdge?: number
  quality?: number
}

export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxEdge = 2000, quality = 0.8 } = options

  // Skip non-images (PDF, JSON, XML etc)
  if (!file.type.startsWith('image/')) return file

  // Skip when already under ~300 KB
  if (file.size <= 300 * 1024) return file

  try {
    const bitmap = await createImageBitmap(file)
    let width = bitmap.width
    let height = bitmap.height

    if (width > maxEdge || height > maxEdge) {
      if (width > height) {
        height *= maxEdge / width
        width = maxEdge
      } else {
        width *= maxEdge / height
        height = maxEdge
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width)
    canvas.height = Math.round(height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file)
          
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
            lastModified: Date.now(),
          })
          
          resolve(compressedFile.size < file.size ? compressedFile : file)
        },
        'image/webp',
        quality
      )
    })
  } catch {
    // Fall back to original file on any error
    return file
  }
}
