import { useEffect, useRef } from 'react'

/**
 * Opens a modal that was requested from *another* tab -- e.g. the dashboard FAB
 * quick actions, which switch to the target tab and flag its view to auto-open
 * its add form (autoOpenLedgerAdd / autoOpenSubscriptionAdd / autoOpenWishlistAdd).
 *
 * The open is deferred to the next animation frame on purpose. The flag is
 * consumed while the target view is still *mounting* and the page-switch
 * transition is running, so opening the sheet synchronously starts its entrance
 * animation on a heavily contended frame. framer-motion tweens are driven by
 * wall-clock time, so when the gap between the animation being created and its
 * first rAF tick approaches the tween's duration (which a janky mount frame can
 * cause), the slide advances most of the way before the first paint and appears
 * to be skipped. Waiting one frame lets the mount + transition settle so the
 * BottomSheet entrance plays in full, every time.
 *
 * The reset callback is fired inside the same frame as the open (not earlier),
 * so flipping the flag back to false can't cancel the pending open. Only
 * `shouldOpen` is a dependency -- `open`/`onReset` are read from a ref so an
 * unrelated parent re-render (very common mid tab-switch) doesn't tear down and
 * reschedule the frame.
 */
export function useAutoOpenModal(
  shouldOpen: boolean | undefined,
  open: () => void,
  onReset?: () => void
): void {
  const cbRef = useRef({ open, onReset })
  useEffect(() => {
    cbRef.current = { open, onReset }
  })

  useEffect(() => {
    if (!shouldOpen) return
    const raf = window.requestAnimationFrame(() => {
      cbRef.current.open()
      cbRef.current.onReset?.()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [shouldOpen])
}
