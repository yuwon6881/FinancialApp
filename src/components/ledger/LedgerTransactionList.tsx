import { useIsDenseContent } from '../../lib/breakpoints'
import { DesktopLedgerTable } from './DesktopLedgerTable'
import { MobileLedgerList } from './MobileLedgerList'
import type { LedgerListProps } from './ledgerListShared'

export type { LedgerListProps } from './ledgerListShared'

// Picks exactly one ledger layout instead of rendering both and CSS-hiding one.
// The previous version mounted the full desktop table *and* the full mobile card
// list, so a phone built every row's element tree, motion component and
// SwipeableRow twice and threw half away — roughly double the mount cost and DOM
// node count on the most render-heavy screen in the app.
//
// The navigation rail consumes 224px from expanded laptop viewports. Keep cards through that
// constrained range and mount the dense table only once the full window reaches 1280px.
export function LedgerTransactionList(props: LedgerListProps) {
  const showDenseTable = useIsDenseContent()
  return showDenseTable ? <DesktopLedgerTable {...props} /> : <MobileLedgerList {...props} />
}
