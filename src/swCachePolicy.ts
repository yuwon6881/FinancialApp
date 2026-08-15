/**
 * A missing hashed asset must never poison the runtime cache with the SPA shell.
 * Workbox calls this predicate before writing a network response to app-assets.
 */
export async function cacheWillUpdate({ response }: { response: Response }): Promise<Response | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/html')) return null
  return response.status === 200 ? response : null
}
