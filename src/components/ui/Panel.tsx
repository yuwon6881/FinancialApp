import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/utils'
import {
  PANEL_TONES,
  panelPaddingClasses,
  panelVariantClasses,
  type PanelTone,
} from './panelStyles'

type PanelProps<T extends ElementType = 'div'> = {
  as?: T
  padding?: keyof typeof panelPaddingClasses
  variant?: keyof typeof panelVariantClasses
  tone?: PanelTone
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function Panel<T extends ElementType = 'div'>({
  as,
  padding = 'default',
  variant = 'default',
  tone = 'default',
  className,
  ...props
}: PanelProps<T>) {
  const Component = as ?? 'div'
  return (
    <Component
      className={cn(
        panelVariantClasses[variant],
        PANEL_TONES[tone],
        panelPaddingClasses[padding],
        className,
      )}
      {...props}
    />
  )
}
