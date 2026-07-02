import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useIsMobile } from '../../lib/useIsMobile'

interface PullToRefreshProps {
  /** Called when the user pulls past the threshold. May return a promise; the spinner shows until it settles. */
  onRefresh: () => Promise<unknown> | void
  /** Disable the gesture (e.g. while locked or already loading). */
  disabled?: boolean
  children: React.ReactNode
}

const THRESHOLD = 64
const MAX_PULL = 96

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

  useEffect(() => {
    if (!isMobile || disabled) return

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) {
        drag.current.active = false
        return
      }
      drag.current = { startY: e.touches[0].clientY, pulling: false, active: true }
    }

    const onMove = (e: TouchEvent) => {
      const s = drag.current
      if (!s.active || refreshingRef.current) return
      const dy = e.touches[0].clientY - s.startY
      if (dy <= 0) {
        if (s.pulling) setPullBoth(0)
        return
      }
      if (window.scrollY > 0) {
        s.active = false
        s.pulling = false
        if (pullRef.current) setPullBoth(0)
        return
      }
      if (!s.pulling && dy < 8) return
      s.pulling = true
      setDragging(true)
      e.preventDefault()
      setPullBoth(Math.min(MAX_PULL, dy * 0.5))
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
          setPullBoth(0)
        }
      } else {
        setPullBoth(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [isMobile, disabled])

  const visible = refreshing || pull > 4
  const progress = Math.min(1, pull / THRESHOLD)

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
          <div className="flex items-center justify-center size-9 rounded-full bg-card border border-border shadow-lg text-blue-500">
            <Loader2
              className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}
            />
          </div>
        </div>
      )}
      {children}
    </>
  )
}
