import { apiFetch } from './client'

export async function pingServer(): Promise<{ status: string }> {
  try {
    const response = await apiFetch(`/ping?t=${Date.now()}`, {}, false)
    if (!response.ok) throw new Error('Status not ok')
    return response.json()
  } catch {
    return { status: 'waking_up' }
  }
}
