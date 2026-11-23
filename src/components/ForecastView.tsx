import { FlaskConical, RotateCcw } from 'lucide-react'
import { useAppPrefs } from '../contexts/AppContext'
import { isScenarioChanged } from '../lib/forecastScenario'
import { financialDate } from '../lib/financialDate'
import { useForecastView } from './forecast/view/useForecastView'
import { ForecastScenarioPanel } from './forecast/ForecastScenarioPanel'
import { ForecastTimeline } from './forecast/ForecastTimeline'
import { AlertBanner } from './ui/AlertBanner'
import { AmountText } from './ui/AmountText'
import { Button } from './ui/Button'
import { PageContainer } from './ui/PageContainer'
import { PageHeader } from './ui/PageHeader'
import { ForecastCyclesSkeleton } from './ui/skeletons/ForecastPageSkeleton'
import { panelClass } from './ui/panelStyles'
import { cn } from '../lib/utils'

/**
 * A sandbox for planning ahead. It starts from real balances, settings and bills, and everything
 * the user changes here is a temporary scenario: it is never queued, synced or saved to records.
 */
export function ForecastView() {
  const { currency, hideSensitive } = useAppPrefs()
  const view = useForecastView()
  const { scenario, forecast } = view
  const today = forecast?.today ?? financialDate()
  const reachedOn = forecast?.forecast.stabilityTargetReachedOn

  return (
    <PageContainer className="space-y-4 py-4 sm:py-6">
      <PageHeader
        title="Forecast"
        description="See where your buckets are heading over the next few cycles, and try what-ifs safely."
        titleActions={(
          <Button type="button" variant="secondary" size="md" onClick={view.reset} disabled={!isScenarioChanged(scenario)}>
            <RotateCcw className="size-4" /> Reset what-ifs
          </Button>
        )}
      />

      <div role="note" className="flex items-start gap-2 rounded-control inset-group px-3 py-2 text-caption text-muted-foreground">
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Scenario only. Nothing you change here is saved to your records.</span>
      </div>

      <ForecastScenarioPanel
        scenario={scenario}
        today={today}
        currency={currency}
        masked={hideSensitive}
        onCyclesChange={view.setCycles}
        onIncomeChange={view.setIncome}
        onEverydaySpendingChange={view.setEverydaySpending}
        onAddItem={view.addItem}
        onRemoveItem={view.removeItem}
      />

      {view.error && (
        <AlertBanner variant="error">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {view.error}
            <Button type="button" variant="secondary" size="sm" onClick={view.retry}>Try again</Button>
          </span>
        </AlertBanner>
      )}

      {forecast && (
        <section aria-labelledby="forecast-summary-title" aria-busy={view.isLoading} className={cn(panelClass, 'space-y-2 p-4 sm:p-5')}>
          <h2 id="forecast-summary-title" className="text-section text-foreground">What this assumes</h2>
          <ul className="list-disc space-y-1 pl-5 text-caption text-muted-foreground">
            <li>{forecast.forecast.incomeKnown ? 'Income arrives on the first day of each cycle and is split by your allocation settings.' : 'No income is included yet. Add your income each cycle above.'}</li>
            <li>{forecast.forecast.everydaySpendingIncluded ? 'Everyday spending comes out of Essentials at the start of each cycle.' : 'Everyday spending is not included, so Essentials may look higher than it will be.'}</li>
            <li>Upcoming bills and loan instalments come from your Bills, at their current amounts.</li>
            {forecast.stabilityTarget > 0 && (
              <li>
                {reachedOn
                  ? <>Stability reaches its target of <AmountText value={forecast.stabilityTarget} currency={currency} isMasked={hideSensitive} /> on {reachedOn}; after that its share goes where your settings redirect it.</>
                  : <>Stability's target is <AmountText value={forecast.stabilityTarget} currency={currency} isMasked={hideSensitive} />.</>}
              </li>
            )}
          </ul>
          {forecast.skippedBills.length > 0 && (
            <div className="pt-2">
              <h3 className="text-label text-foreground">Skipped in this scenario</h3>
              <ul className="mt-1 divide-y divide-border/60">
                {forecast.skippedBills.map(bill => (
                  <li key={bill.sourceId ?? `${bill.label}-${bill.date}`} className="flex min-w-0 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-body text-foreground">{bill.label} · {bill.date}</span>
                    {bill.sourceId && (
                      <Button type="button" variant="tertiary" size="sm" onClick={() => view.toggleBill(bill.sourceId!)}>
                        Include again
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {forecast
        ? <ForecastTimeline cycles={forecast.forecast.cycles} currency={currency} masked={hideSensitive} onSkipBill={view.toggleBill} />
        : !view.error && (
          <div role="status" aria-label="Loading forecast"><ForecastCyclesSkeleton /></div>
        )}
    </PageContainer>
  )
}
