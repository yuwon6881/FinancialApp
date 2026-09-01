/**
 * What a tax document may be, mirrored for the file picker. The server owns the allowlist and
 * advertises it through `/documents/constraints` (`DocumentVaultService.Categories.cs`); this
 * module only turns that list into an `accept` attribute and a pre-flight check, so a picker can
 * never offer a type the upload endpoint would refuse. The fallback matches the server's current
 * list and is used before the constraints response arrives.
 */

/** MIME type to the extensions a file dialog may present it under. */
const UPLOAD_TYPE_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'application/pdf': ['.pdf'],
}

export const FALLBACK_ACCEPTED_UPLOAD_TYPES = Object.keys(UPLOAD_TYPE_EXTENSIONS)

export const UNSUPPORTED_DOCUMENT_TYPE_MESSAGE =
  'Upload a photo or a PDF. Other kinds of file cannot be kept as tax evidence.'

function allowedTypes(acceptedMimeTypes?: string[]): string[] {
  return acceptedMimeTypes && acceptedMimeTypes.length > 0
    ? acceptedMimeTypes
    : FALLBACK_ACCEPTED_UPLOAD_TYPES
}

export function buildDocumentAcceptAttribute(acceptedMimeTypes?: string[]): string {
  const types = allowedTypes(acceptedMimeTypes)
  // Extensions as well as MIME types: some desktop dialogs match only on the extension.
  const extensions = types.flatMap(mime => UPLOAD_TYPE_EXTENSIONS[mime] ?? [])
  return [...types, ...extensions].join(',')
}

/**
 * The `accept` attribute is a hint the operating system's dialog lets the user override, so the
 * chosen file still has to be checked. A missing or unhelpful MIME type falls back to the
 * extension, which is how HEIC commonly arrives.
 */
export function isSupportedDocumentUpload(file: File, acceptedMimeTypes?: string[]): boolean {
  const allowed = allowedTypes(acceptedMimeTypes)
  const mime = file.type.toLowerCase().trim()
  if (mime && allowed.includes(mime)) return true

  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]
  if (!extension) return false
  return allowed.some(type => UPLOAD_TYPE_EXTENSIONS[type]?.includes(extension))
}
