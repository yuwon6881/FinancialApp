import React, { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  Flame,
  Gauge,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { CycleProgress } from '../../lib/cycle'
import {
  isOverBudgetTier,
  isUnrankedTier,
  type EssentialsChallenge,
  type EssentialsChallengeBadgeId,
  type EssentialsChallengeTier,
} from '../../lib/essentialsChallenge'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { Badge } from '../ui/Badge'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { InfoHint } from '../ui/InfoHint'
import { Meter } from '../ui/Meter'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass, type PanelTone } from '../ui/panelStyles'

interface TierPresentation {
  /** Rank shown while the cycle is still running. */
  rank: string
  /** The same standing, worded for a cycle that has already closed. */
  finishedRank: string
  Icon: LucideIcon
  /** Rank line and medallion colour. Both themes are Ayu, so each needs its own step. */
  accent: string
  /** Medallion chip fill, the ring's progress stroke, and the bar's fill. */
  chip: string
  stroke: string
  fill: string
  panelTone: PanelTone
}

/**
 * Nine standings, because "over budget" and "about to be" are not the same news, and neither are
 * "barely over" and "far over". Colour follows the meaning the app already uses elsewhere --
 * emerald for money outlasting the clock, blue for on plan, amber for a warning, orange for a
 * breach in progress, red for one that has already happened -- so the card teaches no new
 * colour vocabulary.
 */
const TIER_PRESENTATION: Record<EssentialsChallengeTier, TierPresentation> = {
  'far-ahead': {
    rank: 'Cruising',
    finishedRank: 'Finished way under',
    Icon: Rocket,
    accent: 'text-emerald-600 dark:text-emerald-300',
    chip: 'border-emerald-500/25 bg-emerald-500/12',
    stroke: 'stroke-emerald-500',
    fill: 'bg-emerald-500',
    panelTone: 'default',
  },
  ahead: {
    rank: 'Ahead of plan',
    finishedRank: 'Finished under',
    Icon: ShieldCheck,
    accent: 'text-emerald-600 dark:text-emerald-300',
    chip: 'border-emerald-500/25 bg-emerald-500/12',
    stroke: 'stroke-emerald-500',
    fill: 'bg-emerald-500',
    panelTone: 'default',
  },
  'on-track': {
    rank: 'On plan',
    finishedRank: 'Finished on plan',
    Icon: Target,
    accent: 'text-blue-600 dark:text-blue-300',
    chip: 'border-blue-500/25 bg-blue-500/12',
    stroke: 'stroke-blue-500',
    fill: 'bg-blue-500',
    panelTone: 'default',
  },
  'near-limit': {
    rank: 'Cutting it fine',
    finishedRank: 'Finished just inside',
    Icon: Gauge,
    accent: 'text-amber-700 dark:text-amber-300',
    chip: 'border-amber-500/25 bg-amber-500/15',
    stroke: 'stroke-amber-500',
    fill: 'bg-amber-500',
    panelTone: 'warning',
  },
  'off-track': {
    rank: 'Heading over',
    finishedRank: 'Closed short',
    Icon: TrendingUp,
    accent: 'text-orange-600 dark:text-orange-300',
    chip: 'border-orange-500/25 bg-orange-500/15',
    stroke: 'stroke-orange-500',
    fill: 'bg-orange-500',
    panelTone: 'urgent',
  },
  'over-a-little': {
    rank: 'Just over',
    finishedRank: 'Finished just over',
    Icon: AlertTriangle,
    accent: 'text-orange-600 dark:text-orange-300',
    chip: 'border-orange-500/25 bg-orange-500/15',
    stroke: 'stroke-orange-500',
    fill: 'bg-orange-500',
    panelTone: 'urgent',
  },
  'over-a-lot': {
    rank: 'Well over',
    finishedRank: 'Finished well over',
    Icon: Flame,
    accent: 'text-red-600 dark:text-red-300',
    chip: 'border-red-500/25 bg-red-500/15',
    stroke: 'stroke-red-500',
    fill: 'bg-red-500',
    panelTone: 'urgent',
  },
  unfunded: {
    rank: 'Waiting on funding',
    finishedRank: 'Never funded',
    Icon: Wallet,
    accent: 'text-muted-foreground',
    chip: 'border-border/60 bg-muted/50',
    stroke: 'stroke-muted-foreground',
    fill: 'bg-muted-foreground',
    panelTone: 'default',
  },
  'not-started': {
    rank: 'Starts soon',
    finishedRank: 'Never started',
    Icon: CalendarClock,
    accent: 'text-blue-600 dark:text-blue-300',
    chip: 'border-blue-500/25 bg-blue-500/12',
    stroke: 'stroke-blue-500',
    fill: 'bg-blue-500',
    panelTone: 'default',
  },
}

const BADGE_COPY: Record<EssentialsChallengeBadgeId, { label: string; earned: string; pending: string }> = {
  'under-pace': {
    label: 'Under pace',
    earned: 'Earned: Essentials is being spent slower than the cycle is passing.',
    pending: 'Not yet: Essentials is being spent faster than the cycle is passing.',
  },
  'buffer-held': {
    label: 'Buffer held',
    earned: 'Earned: Essentials is projected to close above zero.',
    pending: 'Not yet: Essentials is projected to close below zero.',
  },
  'bills-clear': {
    label: 'Bills clear',
    earned: 'Earned: no bill is waiting to be paid.',
    pending: 'Not yet: at least one bill is still waiting to be paid.',
  },
  'limits-clean': {
    label: 'Limits clean',
    earned: 'Earned: no tracked category is over its limit.',
    pending: 'Not yet: at least one tracked category is over its limit.',
  },
}

const SCORE_EXPLANATION =
  'The score weighs how much of the cycle’s Essentials money is already committed against how much of the cycle has passed. '
  + '41 to 100 means the money is still holding; 40 or less means it has already run out. It is worked out on this device from the figures on this page.'

// A smaller medallion than the card first shipped with: the rank and the bar carry the message,
// and the ring is the badge on top of them rather than the card's centrepiece.
const RING_SIZE = 96
const RING_RADIUS = 40
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const percentText = (ratio: number) => `${Math.round(Math.max(0, Math.min(9.99, ratio)) * 100)}%`

interface EssentialsChallengeCardProps {
  challenge: EssentialsChallenge
  cycle: CycleProgress
  formatSensitive: (value: number) => React.ReactNode
  onReviewEssentials?: () => void
}

/**
 * Today's standing on Essentials, as one rank rather than another row of figures.
 *
 * Everything shown is derived on this device from the selected cycle's own numbers. No run of past
 * cycles is claimed: the Today payload carries no per-cycle Essentials history, and a streak
 * invented from what it does carry would be a guess dressed as an achievement.
 *
 * Kept to a glance: rank, headline, the committed bar against the pace marker, and the badge row.
 * The daily allowance, the current pace and the projected finish are not repeated here -- the plan
 * snapshot directly below states all three, and saying them twice was most of this card's height.
 *
 * Percentages and the score stay visible in sensitive mode -- they are ratios, and masking them
 * would leave the card saying nothing -- while every amount goes through `formatSensitive`.
 */
export function EssentialsChallengeCard({
  challenge,
  cycle,
  formatSensitive,
  onReviewEssentials,
}: EssentialsChallengeCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const titleRef = useRef<HTMLSpanElement>(null)
  const presentation = TIER_PRESENTATION[challenge.tier]
  const { Icon } = presentation
  const ended = cycle.phase === 'ended'
  const unranked = isUnrankedTier(challenge.tier)
  const overBudget = isOverBudgetTier(challenge.tier)
  const rank = ended ? presentation.finishedRank : presentation.rank

  const usedPercent = percentText(challenge.usedRatio)
  const pacePercent = percentText(challenge.paceRatio)
  const barPercent = Math.max(0, Math.min(100, challenge.usedRatio * 100))
  const paceMarkerPercent = Math.max(0, Math.min(100, challenge.paceRatio * 100))
  const dayLabel = cycle.phase === 'active'
    ? `Day ${cycle.dayNumber} of ${cycle.totalDays}`
    : cycle.phase === 'upcoming'
      ? `Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'}`
      : 'Cycle closed'

  const scoreText = challenge.score !== null ? Math.round(challenge.score).toString() : '--'

  const headline = (() => {
    if (challenge.tier === 'unfunded') {
      return <>No Essentials money is allocated to this cycle yet, so there is nothing to rank.</>
    }
    if (challenge.tier === 'not-started') {
      return <>This cycle has not begun. Your standing appears on its first day.</>
    }
    if (overBudget) {
      return (
        <>
          Essentials is {formatSensitive(challenge.overspend)} past its money for this cycle, counting
          bills still to pay — {usedPercent} of what it was given.
        </>
      )
    }
    if (challenge.tier === 'off-track') {
      return (
        <>
          {usedPercent} committed with {pacePercent} of the cycle gone. At this pace Essentials closes
          about {formatSensitive(Math.abs(challenge.projectedEndingBalance))} short.
        </>
      )
    }
    if (challenge.tier === 'near-limit') {
      return (
        <>
          {usedPercent} committed with only {pacePercent} of the cycle gone —{' '}
          {formatSensitive(Math.abs(challenge.paceGap))} beyond where the plan expects you.
        </>
      )
    }
    if (challenge.tier === 'on-track') {
      return <>{usedPercent} committed, {pacePercent} of the cycle gone. Right where the plan expects you.</>
    }
    return (
      <>
        {usedPercent} committed with {pacePercent} of the cycle gone —{' '}
        {formatSensitive(challenge.paceGap)} ahead of where the plan expects you.
      </>
    )
  })()

  const result = ended && !unranked
    ? overBudget
      ? <>Essentials closed {formatSensitive(challenge.overspend)} past its money.</>
      : <>Essentials closed with {formatSensitive(challenge.projectedRemaining)} unspent.</>
    : null

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={challenge.score !== null
          ? `Essentials challenge score: ${scoreText}. Click to view details`
          : 'Essentials challenge. Click to view details'}
        className={cn(
          'rounded-full font-bold tabular-nums shrink-0 gap-1.5 border shadow-xs',
          challenge.score !== null ? presentation.chip : 'border-border/60 bg-muted/40 hover:bg-muted/60 text-muted-foreground',
          challenge.score !== null ? presentation.accent : '',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>Score {scoreText}</span>
      </Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidthClassName="max-w-xl"
        initialFocusRef={titleRef}
        title={
          <div className="flex items-center gap-1.5">
            <span ref={titleRef} tabIndex={-1} className="text-base font-bold text-foreground">Essentials challenge</span>
            <InfoHint inline label="How the Essentials score is worked out" text={SCORE_EXPLANATION} />
          </div>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral" className="shrink-0">{dayLabel}</Badge>
            <IconButton
              variant="tertiary"
              type="button"
              onClick={() => setIsOpen(false)}
              label="Close Essentials challenge details"
              tooltip="Close"
            >
              <X className="size-4" />
            </IconButton>
          </div>
        }
      >
        <section aria-labelledby="essentials-challenge-heading" className="space-y-6">
          <div className={cn(panelClass, PANEL_TONES[presentation.panelTone], 'p-5 sm:p-6')}>
            <div className="flex items-start gap-4">
              {challenge.score !== null && (
                <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
                  <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden focusable="false">
                    <circle cx="48" cy="48" r={RING_RADIUS} className="fill-none stroke-muted" strokeWidth="7" />
                    <circle
                      cx="48"
                      cy="48"
                      r={RING_RADIUS}
                      className={cn('fill-none transition-[stroke-dashoffset] duration-700', presentation.stroke)}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={RING_CIRCUMFERENCE * (1 - challenge.score / 100)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedNumber
                      value={challenge.score}
                      formatFn={value => Math.round(value).toString()}
                      className={cn('text-3xl font-black leading-none', presentation.accent)}
                    />
                    <span className="mt-1 text-eyebrow uppercase text-muted-foreground">score</span>
                  </div>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-lg border', presentation.chip, presentation.accent)}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <h3 id="essentials-challenge-heading" className={cn('text-section', presentation.accent)}>
                    {rank}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{headline}</p>
                {result && <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">{result}</p>}
              </div>
            </div>

            {!unranked && (
              <div className="mt-5 border-t border-border/40 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Essentials money committed</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">{usedPercent}</span>
                </div>
                <div className="relative mt-1.5">
                  <Meter
                    percent={barPercent}
                    tone={presentation.fill}
                    size="md"
                    className="h-2"
                    label="Share of this cycle's Essentials money already committed"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
                    style={{ left: `${paceMarkerPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  The marker sits at {pacePercent} — {ended ? 'where a full cycle ends' : "where today's plan expects the bar"}.
                </p>
              </div>
            )}
          </div>

          {!unranked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Badges</span>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {challenge.earnedBadgeCount} of {challenge.badges.length}
                </span>
              </div>
              <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
                {challenge.badges.map(badge => {
                  const copy = BADGE_COPY[badge.id]
                  return (
                    <li
                      key={badge.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                        badge.earned
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-dashed border-border/70 bg-muted/25 text-muted-foreground',
                      )}
                    >
                      {badge.earned && <Check className="size-3 shrink-0" aria-hidden />}
                      <span className="truncate">{copy.label}</span>
                      <span className="sr-only">{badge.earned ? copy.earned : copy.pending}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {onReviewEssentials && (
            <div className="pt-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setIsOpen(false)
                  onReviewEssentials()
                }}
                className="w-full justify-center gap-1.5 font-semibold text-foreground"
              >
                Review Essentials spending
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </section>
      </BottomSheet>
    </>
  )
}
