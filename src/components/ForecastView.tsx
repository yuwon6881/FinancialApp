import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react'
import type { ForecastCycle } from '../types'
import { firstShortfalls } from '../lib/forecastSummary'
import { useAppPrefs } from '../contexts/AppContext'
import { isScenarioChanged, formatForecastDate } from '../lib/forecastScenario'
import { financialDate } from '../lib/financialDate'
import { useForecastView } from './forecast/view/useForecastView'
import { ForecastScenarioPanel } from './forecast/ForecastScenarioPanel'
import { ForecastTimeline } from './forecast/ForecastTimeline'
import { AlertBanner } from './ui/AlertBanner'
import { AmountText } from './ui/AmountText'
import { Button } from './ui/Button'
import { DetailDisclosure } from './ui/DetailDisclosure'
import { PageContainer } from './ui/PageContainer'
import { PageHeader } from './ui/PageHeader'
import { ForecastCyclesSkeleton } from './ui/skeletons/ForecastPageSkeleton'

export function ForecastView({ account }: { account: string }) {
  const { currency, hideSensitive, maskPassiveFinancialFigures, sensitivePreferenceStatus } = useAppPrefs()
  const masked = hideSensitive || Boolean(maskPassiveFinancialFigures) || sensitivePreferenceStatus === 'pending'
  return <ForecastWorkspace key={JSON.stringify([account, currency])} account={account} currency={currency} masked={masked} />
}

function ForecastWorkspace({ account, currency, masked }: { account: string; currency: string; masked: boolean }) {
  const view = useForecastView(account, currency)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const { scenario, forecast } = view
  const today = forecast?.today ?? financialDate()
  const projection = forecast?.forecast

  return (
    <PageContainer className="max-w-6xl space-y-5 py-4 sm:py-6">
      <PageHeader
        title="Forecast"
        description={<span role="note">Plan ahead without changing your records.</span>}
      />

      <ForecastScenarioPanel
        key={masked ? 'hidden' : 'visible'}
        scenario={scenario}
        today={today}
        horizonEnd={projection?.cycles.at(-1)?.end}
        currency={currency}
        masked={masked}
        onCyclesChange={view.setCycles}
        onIncomeChange={view.setIncome}
        onEverydaySpendingChange={view.setEverydaySpending}
        onAddItem={view.addItem}
        onRemoveItem={view.removeItem}
        resetAction={!masked && isScenarioChanged(scenario) && (
          <Button type="button" variant="tertiary" size="sm" onClick={view.reset}>
            <RotateCcw className="size-4" aria-hidden="true" /> Reset what-ifs
          </Button>
        )}
      />

      {view.error && (
        <AlertBanner variant="error">
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <span className="mr-auto">{view.error}{forecast && ' Showing the last forecast.'}</span>
            <Button type="button" variant="secondary" size="sm" onClick={view.retry}>Try again</Button>
          </span>
        </AlertBanner>
      )}

      <section aria-labelledby="forecast-balances-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="forecast-balances-title" className="text-section text-foreground">End-of-cycle balances</h2>
          <span role="status" className="text-caption text-muted-foreground">
            {view.isLoading && forecast ? 'Updating…' : ''}
          </span>
        </div>

        {projection && !masked && <ForecastVerdict cycles={projection.cycles} currency={currency} />}

        <div aria-busy={view.isLoading}>
          {forecast && projection
            ? <ForecastTimeline cycles={projection.cycles} currency={currency} masked={masked}
                targetReachedOn={projection.stabilityTargetReachedOn}
                skippedBills={forecast.skippedBills} selectedSkippedBills={scenario.skippedBills} onToggleBill={view.toggleBill} />
            : !view.error && <div role="status" aria-label="Loading forecast"><ForecastCyclesSkeleton /></div>}
        </div>

        {forecast && projection && (
          <DetailDisclosure label="What’s included" open={assumptionsOpen} onOpenChange={setAssumptionsOpen}
            className="border-t border-border [&>summary]:min-h-11 lg:[&>summary]:min-h-9">
            <ul className="list-disc space-y-1.5 pb-2 pl-5 text-body text-muted-foreground">
              <li>Unpaid bills and loan instalments are included. Overdue amounts count today. Paused bills are excluded.</li>
              <li>Income and everyday spending apply from the next cycle. Income follows your allocation settings and everyday spending comes out of Essentials.</li>
              <li>Stability repayment instalments are excluded.</li>
              {forecast.stabilityTarget > 0 && !masked && (
                <li>
                  Stability’s target is <AmountText value={forecast.stabilityTarget} currency={currency} />.
                  {projection.stabilityTargetReachedOn && <> It’s first projected to reach that on {formatForecastDate(projection.stabilityTargetReachedOn)}.</>}
                </li>
              )}
            </ul>
          </DetailDisclosure>
        )}
      </section>
    </PageContainer>
  )
}

/** Leads with the answer: where money first runs short, or that nothing does. */
function ForecastVerdict({ cycles, currency }: { cycles: ForecastCycle[]; currency: string }) {
  const shortfalls = firstShortfalls(cycles)
  if (shortfalls.length === 0) {
    return (
      <p className="flex items-start gap-2 text-body text-muted-foreground">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        No bucket runs short in this forecast.
      </p>
    )
  }
  return (
    <ul aria-label="Shortfalls" className="space-y-1">
      {shortfalls.map(shortfall => (
        <li key={shortfall.bucket} className="flex items-start gap-2 text-body text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <span className="min-w-0">
            {shortfall.bucket} runs short in {shortfall.isCurrent ? 'the rest of this cycle' : shortfall.cycleLabel}, ending at{' '}
            <AmountText value={shortfall.closing} currency={currency} className="font-semibold text-destructive" />
          </span>
        </li>
      ))}
    </ul>
  )
}
