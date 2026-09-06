import React, { useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'
import { Button } from './Button'
import { cn } from '../../lib/utils'

interface InfoHintProps {
  /** Plain-language explanation. Keep it to one or two short sentences. */
  text: string
  /** Describes what is being explained, for screen readers. */
  label: string
  align?: 'left' | 'right'
  className?: string
  /** Sized to fit inline within text/headings without expanding the parent line height. */
  inline?: boolean
}

/**
 * A "?" affordance that reveals a short explanation.
 *
 * Tap/click toggles it so touch devices are first-class; pointer devices also get
 * hover and focus for free. Never hover-only, because the app ships as a mobile PWA.
 */
export const InfoHint: React.FC<InfoHintProps> = ({ text, label, align = 'right', className = '', inline = false }) => {
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!pinned) return
    const dismiss = (event: Event) => {
      if (anchorRef.current?.contains(event.target as Node)) return
      setPinned(false)
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPinned(false); setOpen(false) }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  return (
    <>
      <Button
        variant="tertiary"
        // Always the icon size, in both forms: it is the only one with no horizontal padding, and
        // the control scale's `px-4` collapses a `size-5` glyph to zero width.
        size="icon"
        ref={anchorRef}
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => { const next = !pinned; setPinned(next); setOpen(next) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) setOpen(false) }}
        className={cn(
          'shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring',
          // The inline form sits in a heading's text run, so it keeps a glyph-sized box at every
          // tier -- including expanded, which the icon size would otherwise take back to 36px --
          // and buys its 44px target from the invisible `before` overlay instead.
          inline
            ? 'relative inline-flex size-5 align-middle before:absolute before:-inset-2.5 sm:size-5 lg:size-5'
            : 'inline-flex size-11 sm:size-7 lg:size-7',
          className
        )}
      >
        <HelpCircle className="size-3.5" aria-hidden="true" />
      </Button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        align={align}
        minWidth={200}
        id={id}
        role="tooltip"
        className="z-[240] w-56 rounded-xl border border-border/70 bg-card p-3 text-xs font-normal leading-relaxed text-foreground shadow-xl"
      >
        {text}
      </AnchoredPopover>
    </>
  )
}
