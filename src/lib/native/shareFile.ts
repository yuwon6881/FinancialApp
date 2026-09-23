const CHUNK_BYTES = 3 * 1024 * 1024

function safeFileName(fileName: string): string {
  const safe = [...fileName.replace(/[\\/:*?"<>|]+/g, '_')]
    .map(character => (character.codePointAt(0) ?? 0) <= 0x1f ? '_' : character)
    .join('')
    .replace(/^\.+/, '')
  return safe || 'financialapp-export.bin'
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)))
  }
  return btoa(binary)
}

/** Saves an authenticated response in app storage, then hands it to the native share sheet. */
export async function shareBlobAsNativeFile(blob: Blob, fileName: string): Promise<void> {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const safeName = safeFileName(fileName)
  const path = `exports/${Date.now()}-${crypto.randomUUID()}-${safeName}`
  const chunks = Math.max(1, Math.ceil(blob.size / CHUNK_BYTES))

  for (let index = 0; index < chunks; index += 1) {
    const start = index * CHUNK_BYTES
    const end = Math.min(start + CHUNK_BYTES, blob.size)
    const encoded = toBase64(new Uint8Array(await blob.slice(start, end).arrayBuffer()))
    if (index === 0) {
      await Filesystem.writeFile({ path, data: encoded, directory: Directory.Cache, recursive: true })
    } else {
      await Filesystem.appendFile({ path, data: encoded, directory: Directory.Cache })
    }
  }

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
  await Share.share({
    title: safeName,
    files: [uri],
    dialogTitle: 'Save or share file',
  })
}
