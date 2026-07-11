import { useEffect } from 'react'

/**
 * Keep visual-viewport CSS vars (`--app-vvh/vvw/vv-top/vv-left`) in sync so
 * fixed bottom-sheet modals stay pinned to the visible area while the mobile
 * keyboard opens, closes, or pans the layout viewport. Also nudges a focused
 * field back into view inside a `.sheet-panel` on small layouts.
 *
 * Pure DOM side-effects with no React state coupling — lifted verbatim out of
 * App.tsx.
 */
export function useVisualViewportVars(): void {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let viewportRaf = 0
    let activeFocusEl: HTMLElement | null = null
    let activeFocusPanel: HTMLElement | null = null
    let focusSettleTimer = 0
    let focusMaxTimer = 0
    const viewportVars = new Map<string, string>()

    const setViewportVar = (name: string, value: number) => {
      const next = `${value.toFixed(2)}px`
      if (viewportVars.get(name) === next) return
      viewportVars.set(name, next)
      root.style.setProperty(name, next)
    }

    const applyViewport = () => {
      const h = vv ? vv.height : window.innerHeight
      const w = vv ? vv.width : window.innerWidth
      const top = vv ? vv.offsetTop : 0
      const left = vv ? vv.offsetLeft : 0
      setViewportVar('--app-vvh', h)
      setViewportVar('--app-vvw', w)
      setViewportVar('--app-vv-top', top)
      setViewportVar('--app-vv-left', left)
    }

    const scheduleViewport = () => {
      if (viewportRaf) return
      viewportRaf = window.requestAnimationFrame(() => {
        viewportRaf = 0
        applyViewport()
      })
    }

    const ensureFocusedFieldVisible = (el: HTMLElement, panel: HTMLElement) => {
      if (document.activeElement !== el || !panel.contains(el)) return
      const panelRect = panel.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const topPadding = 18
      const bottomPadding = 40

      if (elRect.bottom > panelRect.bottom - bottomPadding) {
        panel.scrollTop += elRect.bottom - panelRect.bottom + bottomPadding
      } else if (elRect.top < panelRect.top + topPadding) {
        panel.scrollTop -= panelRect.top + topPadding - elRect.top
      }
    }

    const clearFocusCorrection = () => {
      if (focusSettleTimer) window.clearTimeout(focusSettleTimer)
      if (focusMaxTimer) window.clearTimeout(focusMaxTimer)
      focusSettleTimer = 0
      focusMaxTimer = 0
    }

    const runFocusCorrection = () => {
      clearFocusCorrection()
      const el = activeFocusEl
      const panel = activeFocusPanel
      if (!el || !panel || document.activeElement !== el || !panel.contains(el)) return
      window.requestAnimationFrame(() => ensureFocusedFieldVisible(el, panel))
    }

    const scheduleFocusCorrection = (delay: number, withMaxTimer = false) => {
      if (!activeFocusEl || !activeFocusPanel) return
      if (focusSettleTimer) window.clearTimeout(focusSettleTimer)
      focusSettleTimer = window.setTimeout(runFocusCorrection, delay)
      if (withMaxTimer && !focusMaxTimer) {
        focusMaxTimer = window.setTimeout(runFocusCorrection, 720)
      }
    }

    const isSheetLayout = () => window.matchMedia('(max-width: 639px)').matches
    const handleFocusIn = (e: FocusEvent) => {
      if (!isSheetLayout()) return
      const el = e.target as HTMLElement | null
      if (!el || !el.matches?.('input, textarea, select')) return
      const panel = el.closest('.sheet-panel') as HTMLElement | null
      if (!panel) return

      activeFocusEl = el
      activeFocusPanel = panel
      root.classList.add('sheet-keyboard-focus')
      scheduleFocusCorrection(260, true)
    }

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        if (active?.closest?.('.sheet-panel')) return
        activeFocusEl = null
        activeFocusPanel = null
        clearFocusCorrection()
        root.classList.remove('sheet-keyboard-focus')
      }, 0)
    }

    const handleViewportChange = () => {
      scheduleViewport()
      if (activeFocusEl && activeFocusPanel) {
        scheduleFocusCorrection(140)
      }
    }

    applyViewport()
    vv?.addEventListener('resize', handleViewportChange)
    vv?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      vv?.removeEventListener('resize', handleViewportChange)
      vv?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      if (viewportRaf) window.cancelAnimationFrame(viewportRaf)
      clearFocusCorrection()
      root.classList.remove('sheet-keyboard-focus')
    }
  }, [])
}
