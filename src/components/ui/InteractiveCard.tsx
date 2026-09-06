import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { panelClass } from './panelStyles'

/**
 * `panel` is a card that stands on its own surface. `plain` is a tile nested inside a panel that
 * already supplies the surface -- a status-coloured category tile, a metric cell in a grid -- so
 * it carries no shell of its own and the caller states the border and background that encode its
 * state. Both keep the interaction contract: block flow, full width, left-aligned text, the shared
 * hover lift, and the primitive's own focus ring.
 */
export type InteractiveCardSurface = 'panel' | 'plain'

export interface InteractiveCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  surface?: InteractiveCardSurface
}

/**
 * The clickable *surface*, as opposed to `Button`, the labelled *action*. A Button centres one
 * short label and is sized from the control scale; anything whose content is a small stacked
 * layout -- a heading over a figure, a bar with a caption under it -- belongs here instead, where
 * the children are laid out by the card's own classes rather than by an action's label box.
 */
export const InteractiveCard = forwardRef<HTMLButtonElement, InteractiveCardProps>(
  ({ className, type = 'button', surface = 'panel', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        surface === 'panel' && panelClass,
        'interactive-card block w-full cursor-pointer text-left transition duration-150 active:scale-[0.995]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  ),
)
InteractiveCard.displayName = 'InteractiveCard'
