/**
 * What changing the app currency does, said before it happens. Ledger amounts are only relabelled.
 * Investments are kept in each fund's own currency and read at today's rate, so nothing about them
 * is recalculated -- only their totals wait, briefly, for a rate that has not been fetched yet.
 */
export function CurrencySwitchNotice({ from, to }: { from: string; to: string }) {
  return (
    <div className="space-y-2">
      <p>
        Amounts you have already recorded keep their numbers. Only the currency shown changes from {from} to {to}; nothing in your budget or ledger is converted. Amounts added while using {to} will also be labelled {from} if you switch back.
      </p>
      <p>
        Investments are not recalculated. Each fund keeps its own currency, and investment totals in {to} use today&apos;s exchange rate, so gains and returns still show what the markets did.
      </p>
      <p>
        If today&apos;s {to} rate has not been fetched yet, investment totals show as unavailable until it arrives, never as zero.
      </p>
    </div>
  )
}
