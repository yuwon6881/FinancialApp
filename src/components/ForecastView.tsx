import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ForecastCycle } from '../types'
import { useAppPrefs } from '../contexts/AppContext'
import {
  FORECAST_MAX_ITEMS,
  formatForecastDate,
  formatForecastRange,
  hasScenarioAdjustments,
  hasWhatIfChanges,
} from '../lib/forecastScenario'
import { financialDate } from '../lib/financialDate'
import { useForecastView } from './forecast/view/useForecastView'
import { ForecastScenarioPanel } from './forecast/ForecastScenarioPanel'
import { ForecastTimeline } from './forecast/ForecastTimeline'
import { ForecastWhatIfSheet } from './forecast/ForecastWhatIfSheet'
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
  const [adjusting, setAdjusting] = useState<ForecastCycle | null>(null)
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
        onAddItems={view.addItems}
        onRemoveItem={view.removeItem}
        resetAction={!masked && hasWhatIfChanges(scenario) && (
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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="forecast-balances-title" className="text-section text-foreground">End-of-cycle balances</h2>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span role="status" className="text-caption text-muted-foreground">
              {view.isLoading && forecast ? 'Updating…' : ''}
            </span>
            {!masked && hasScenarioAdjustments(scenario) && (
              <Button type="button" variant="tertiary" size="sm" onClick={view.resetAdjustments}>
                <RotateCcw className="size-4" aria-hidden="true" /> Reset adjustments
              </Button>
            )}
          </div>
        </div>

        <div aria-busy={view.isLoading}>
          {forecast && projection
            ? <ForecastTimeline key={masked ? 'hidden' : 'visible'} cycles={projection.cycles} currency={currency} masked={masked}
                targetReachedOn={projection.stabilityTargetReachedOn}
                skippedBills={forecast.skippedBills} selectedSkippedBills={scenario.skippedBills} onToggleBill={view.toggleBill}
                onAdjustCycle={scenario.items.length + 2 <= FORECAST_MAX_ITEMS ? setAdjusting : undefined} />
            : !view.error && <div role="status" aria-label="Loading forecast"><ForecastCyclesSkeleton /></div>}
        </div>

        {forecast && projection && (
          <DetailDisclosure label="What’s included" open={assumptionsOpen} onOpenChange={setAssumptionsOpen}
            className="border-t border-border [&>summary]:min-h-11 lg:[&>summary]:min-h-9">
            <ul className="list-disc space-y-1.5 pb-2 pl-5 text-body text-muted-foreground">
              <li>Unpaid bills and loan instalments are included. Overdue amounts count today. Paused bills are excluded.</li>
              <li>Starting next cycle, income follows your allocation settings and everyday spending comes out of Essentials once per cycle.</li>
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
      {adjusting && !masked && (
        // A cycle's change may only fall inside that cycle, and never before today.
        <ForecastWhatIfSheet key={adjusting.start} initialKind="move" currency={currency}
          range={{
            title: `Adjust ${adjusting.label}`,
            description: formatForecastRange(adjusting.start, adjusting.end),
            min: adjusting.start > today ? adjusting.start : today,
            max: adjusting.end,
          }}
          onClose={() => setAdjusting(null)}
          onAddItems={items => { view.addAdjustments(items); setAdjusting(null) }} />
      )}
    </PageContainer>
  )
}
