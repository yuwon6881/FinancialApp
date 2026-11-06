/** How far today's worth sits from the money put in, in words and colour; hidden while amounts are masked. */
export function WorthGainChip({ gain, money, className = '' }: {
  gain: number
  money: (amount: number) => string
  className?: string
}) {
  return (
    <p className={`inline-block rounded-control px-2 py-0.5 text-caption font-medium tabular-nums ${
      gain > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : gain < 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-surface-2 text-muted-foreground'
    } ${className}`}>
      {gain === 0 ? 'Same as money in' : `${money(Math.abs(gain))} ${gain > 0 ? 'above' : 'below'} money in`}
    </p>
  )
}
