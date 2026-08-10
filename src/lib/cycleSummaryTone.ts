export type InsightTone = 'good' | 'warn' | 'neutral'

export function changeTone(change: number | null, higherIsBetter: boolean): InsightTone {
  if (change === null || change === 0) return 'neutral'
  return (change > 0) === higherIsBetter ? 'good' : 'warn'
}
