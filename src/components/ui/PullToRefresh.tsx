import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useIsMobile } from '../../lib/useIsMobile'
import { isSwipeLocked } from '../../lib/swipeLock'

interface PullToRefreshProps {
  /** Called when the user pulls past the threshold. May return a promise; the spinner shows until it settles. */
  onRefresh: () => Promise<unknown> | void
  /** Disable the gesture (e.g. while locked or already loading). */
  disabled?: boolean
  children: React.ReactNode
}

const THRESHOLD = 48
const MAX_PULL = 96
const PULL_RESISTANCE = 0.72

/**
 * Native-style pull-to-refresh for the mobile PWA. Active only on touch/mobile
 * viewports and only when the window is scrolled to the very top.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, disabled = false, children }) => {
  const isMobile = useIsMobile()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  const drag = useRef({ startY: 0, pulling: false, active: false })

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const setPullBoth = (v: number) => {
    pullRef.current = v
    setPull(v)
  }

  const resetPullState = () => {
    setPullBoth(0)
  }

  useEffect(() => {
    if (!isMobile || disabled) return

    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (
        refreshingRef.current ||
        e.touches.length !== 1 ||
        window.scrollY > 0 ||
        target?.closest('.sheet-backdrop, .sheet-panel')
      ) {
        drag.current.active = false
        return
      }
      drag.current = { startY: e.touches[0].clientY, pulling: false, active: true }
    }

    const onMove = (e: TouchEvent) => {
      const s = drag.current
      if (!s.active || refreshingRef.current) return
      if (isSwipeLocked()) {
        s.active = false
        s.pulling = false
        if (pullRef.current) resetPullState()
        return
      }
      const dy = e.touches[0].clientY - s.startY
      if (dy <= 0) {
        if (s.pulling) resetPullState()
        return
      }
      if (!s.pulling && window.scrollY > 0) {
        s.active = false
        s.pulling = false
        if (pullRef.current) resetPullState()
        return
      }
      if (!s.pulling && dy < 8) return
      s.pulling = true
      setDragging(true)
      e.preventDefault()
      setPullBoth(Math.min(MAX_PULL, dy * PULL_RESISTANCE))
    }

    const onEnd = async () => {
      const s = drag.current
      setDragging(false)
      if (!s.active) return
      s.active = false
      const wasPulling = s.pulling
      s.pulling = false
      if (wasPulling && pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullBoth(THRESHOLD)
        try {
          await onRefreshRef.current?.()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
          resetPullState()
        }
      } else {
        resetPullState()
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [isMobile, disabled])

  const visible = refreshing || pull > 4
  const progress = Math.min(1, pull / THRESHOLD)
  const label = refreshing ? 'Refreshing' : progress >= 1 ? 'Release' : 'Pull'

  return (
    <>
      {isMobile && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center pointer-events-none"
          style={{
            // Sit just below the sticky header so the spinner is always visible.
            top: 'calc(4rem + env(safe-area-inset-top, 0px))',
            transform: `translateY(${(refreshing ? 10 : Math.min(pull, MAX_PULL) * 0.5) - 6}px)`,
            opacity: visible ? 1 : 0,
            transition: dragging && !refreshing ? 'none' : 'transform 200ms ease, opacity 200ms ease',
          }}
        >
          <div className="flex items-center gap-2 rounded-full bg-card border border-border shadow-lg text-blue-500 px-3 py-2">
            <Loader2
              className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}
            />
            <span className="text-[10px] font-bold text-foreground">{label}</span>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
