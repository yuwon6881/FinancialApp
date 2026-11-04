/**
 * What changing the app currency does, said before it happens. Ledger amounts are only relabelled,
 * but investments are converted from each fund's own currency at the rate on each date, so their
 * whole history is recalculated -- and for a while some of it may be unavailable.
 */
export function CurrencySwitchNotice({ from, to }: { from: string; to: string }) {
  return (
    <div className="space-y-2">
      <p>
        Amounts you have already recorded keep their numbers. Only the currency shown changes from {from} to {to}; nothing in your budget or ledger is converted.
      </p>
      <p>
        Investments work differently. They are converted from each fund&apos;s own currency, so their history is recalculated at each date&apos;s exchange rate. Totals, gains and yearly returns will change.
      </p>
      <p>
        Past exchange rates may need to be fetched first. Until they arrive, the affected investment figures show as unavailable, never as zero.
      </p>
    </div>
  )
}
