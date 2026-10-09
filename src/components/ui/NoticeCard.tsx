import type { ReactNode } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { DURATION, EASE_FLUID } from '../../lib/animations'
import { panelClass } from './panelStyles'

type NoticeTone = 'attention' | 'urgent' | 'neutral'

const TONE_WELL: Record<NoticeTone, string> = {
  attention: 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  urgent: 'bg-red-500/12 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  neutral: 'bg-surface-2 text-muted-foreground',
}

interface NoticeCardProps {
  /** `attention`: worth a look, nothing has gone wrong yet. `urgent`: a limit or payment is already short. */
  tone: NoticeTone
  icon: ReactNode
  /** Id for the heading; the card is labelled by it. */
  titleId: string
  title: ReactNode
  /** A short state chip beside the title, e.g. "Due tomorrow". */
  badge?: ReactNode
  /** One or two quiet sentences under the title. */
  description?: ReactNode
  /** Extra content between the description and the actions: a meter, a list. */
  children?: ReactNode
  /** Buttons. Laid out on one row under the text, so a narrow column and a wide one read the same. */
  actions?: ReactNode
  className?: string
}

/**
 * One anatomy for every exception Today raises -- a bill to review, a category near its limit, an
 * auto-debit that will bounce, a retention reminder. The colour lives in the icon well only: the
 * title stays ink so a stack of notices reads as a calm list rather than a wall of amber, and
 * urgency is told by the well's hue and the words, not by tinting the whole card.
 */
export function NoticeCard({
  tone,
  icon,
  titleId,
  title,
  badge,
  description,
  children,
  actions,
  className,
}: NoticeCardProps) {
  const reduceMotion = useReducedMotion()
  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.enter, ease: EASE_FLUID }}
      aria-labelledby={titleId}
      data-notice={tone}
      className={cn(panelClass, 'relative flex min-w-0 flex-col p-4 sm:p-5', className)}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          aria-hidden="true"
          className={cn('grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-[1.125rem]', TONE_WELL[tone])}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={titleId} className="min-w-0 text-subsection text-foreground">{title}</h3>
            {badge}
          </div>
          {description && <div className="mt-1 text-body text-muted-foreground">{description}</div>}
        </div>
      </div>
      {children && <div className="mt-4 min-w-0">{children}</div>}
      {actions && (
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-auto sm:pt-4 [&>*]:flex-1 sm:[&>*]:flex-initial">
          {actions}
        </div>
      )}
    </m.section>
  )
}
