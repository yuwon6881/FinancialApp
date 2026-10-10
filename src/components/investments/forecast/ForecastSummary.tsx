import { InfoHint } from '../../ui/InfoHint'

/** The answer, before any of the controls that shape it. */
export function ForecastSummary({
  years,
  ending,
  lower,
  upper,
  startValue,
  futureContributions,
  growth,
  money,
}: {
  years: number
  ending: number | undefined
  lower: number | undefined
  upper: number | undefined
  startValue: number
  futureContributions: number | undefined
  growth: number | undefined
  todayMoney: boolean
  money: (value: number | undefined) => string
}) {
  const tiles = [
    {
      label: 'Already in your portfolio',
      value: money(startValue),
      hint: 'What your investments and investment cash are worth today. The forecast starts from this number.',
    },
    {
      label: 'Future deposits — what-if',
      value: money(futureContributions),
      hint: `The monthly amount you picked, added up over ${years} years. Nothing is actually deposited.`,
    },
    {
      label: 'Estimated market growth',
      value: money(growth),
      hint: 'The part of the middle estimate that came from markets rising, rather than from money you put in.',
    },
  ]

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <article className="rounded-control bg-surface-2/70 p-3 sm:col-span-3">
        <div className="flex items-center gap-1">
          <p className="text-label font-medium text-muted-foreground">
            Middle estimate after {years} years
          </p>
          <InfoHint
            label="the middle estimate"
            text="Half of outcomes finish above this amount and half below; it is not a promise."
          />
        </div>
        <strong className="mt-1 block break-words text-title tabular-nums text-foreground">{money(ending)}</strong>
        <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
          {ending === undefined
            ? 'Calculating…'
            : `Could reasonably range from ${money(lower)} to ${money(upper)}, based on 10,000 simulated paths.`}
        </p>
      </article>
      {tiles.map(tile => (
        <article key={tile.label} className="rounded-control bg-surface-2/70 p-3">
          <div className="flex items-center gap-1">
            <p className="text-label font-medium text-muted-foreground">{tile.label}</p>
            <InfoHint label={tile.label.toLowerCase()} text={tile.hint} />
          </div>
          <strong className="mt-1 block break-words text-section tabular-nums text-foreground">{tile.value}</strong>
        </article>
      ))}
    </div>
  )
}
