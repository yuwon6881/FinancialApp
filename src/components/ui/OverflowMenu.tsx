import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export interface OverflowMenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: () => void
  disabled?: boolean
  /** Why the item is unavailable, e.g. "Unhide balances to delete". Shown as its title. */
  hint?: string
  tone?: 'default' | 'danger'
}

interface OverflowMenuProps {
  items: OverflowMenuItem[]
  /** What the menu acts on, e.g. a commitment or loan name. Used for the accessible name. */
  entityLabel: string
  align?: 'left' | 'right'
  disabled?: boolean
  className?: string
}

/**
 * Secondary card actions behind one "…" trigger.
 *
 * Built on AnchoredPopover rather than the Radix dropdown because these cards live inside
 * HorizontalRail: the popover portals to document.body, so `overflow-x-auto` cannot clip the menu,
 * and it flips toward whichever side has room.
 *
 * Replaces the hand-rolled action swap that SavingsGoalCard and RewardCard each carried, where
 * tapping a manage button *replaced* the money actions because six controls would not fit at rail
 * width. One primary plus a menu fits, and nothing has to disappear to make room.
 */
export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  entityLabel,
  align = 'right',
  disabled = false,
  className,
}) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const menuId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // A card whose actions become unavailable mid-interaction (a sync starts, balances are masked)
  // must not leave a live menu behind.
  useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open])

  const focusItem = useCallback((offset: number, from?: number) => {
    const enabled = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    )
    if (enabled.length === 0) return
    const current = from ?? enabled.findIndex(item => item === document.activeElement)
    const next = (current + offset + enabled.length) % enabled.length
    enabled[next]?.focus()
  }, [])

  // Keyboard handling lives on the document rather than on the panel, so the arrow keys work
  // whether focus is still on the trigger or already inside the menu. Opening deliberately does
  // not steal focus: the popover remounts its panel once it has measured itself, which would
  // detach anything focused before that, and a pointer user does not want focus moved anyway.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: Event) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close(true)
        return
      }
      if (event.key === 'Tab') { setOpen(false); return }
      const insideMenu = panelRef.current?.contains(document.activeElement)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusItem(1, insideMenu ? undefined : -1)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusItem(-1, insideMenu ? undefined : 0)
      }
      if (event.key === 'Home') { event.preventDefault(); focusItem(1, -1) }
      if (event.key === 'End') { event.preventDefault(); focusItem(-1, 0) }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close, focusItem])

  if (items.length === 0) return null

  return (
    <>
      <Button
        ref={triggerRef}
        variant="tertiary"
        size="icon"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More actions for ${entityLabel}`}
        onClick={() => setOpen(previous => !previous)}
        className={cn('shrink-0', className)}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Button>
      <AnchoredPopover
        ref={panelRef}
        id={menuId}
        open={open}
        anchorRef={triggerRef}
        align={align}
        minWidth={180}
        role="menu"
        aria-label={`Actions for ${entityLabel}`}
        className="z-[240] w-48 overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl"
      >
        {items.map(item => {
          const Icon = item.icon
          return (
            <Button
              key={item.label}
              variant="tertiary"
              role="menuitem"
              aria-disabled={item.disabled ? true : undefined}
              title={item.disabled ? item.hint : undefined}
              onClick={() => {
                if (item.disabled) return
                // Close first: an item that opens a sheet would otherwise race this menu's own
                // pointerdown dismissal.
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-bold',
                'transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-10',
                item.disabled
                  ? 'cursor-not-allowed text-muted-foreground/60'
                  : item.tone === 'danger'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground hover:bg-muted/70',
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{item.label}</span>
            </Button>
          )
        })}
      </AnchoredPopover>
    </>
  )
}
