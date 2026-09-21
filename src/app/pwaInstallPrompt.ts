export interface PwaInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let pendingPrompt: PwaInstallPromptEvent | null = null
const listeners = new Set<(available: boolean) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    pendingPrompt = event as PwaInstallPromptEvent
    for (const listener of listeners) listener(true)
  })
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null
    for (const listener of listeners) listener(false)
  })
}

export function getPwaInstallPrompt() {
  return pendingPrompt
}

export function takePwaInstallPrompt() {
  const prompt = pendingPrompt
  pendingPrompt = null
  return prompt
}

export function subscribePwaInstallPrompt(listener: (available: boolean) => void) {
  listeners.add(listener)
  listener(pendingPrompt !== null)
  return () => { listeners.delete(listener) }
}
