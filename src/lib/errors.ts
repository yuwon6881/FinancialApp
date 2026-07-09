export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined
}

export function errorMessageIncludes(error: unknown, text: string): boolean {
  return getErrorMessage(error, '').includes(text)
}

export function errorMessageIncludesLower(error: unknown, text: string): boolean {
  return getErrorMessage(error, '').toLowerCase().includes(text.toLowerCase())
}
