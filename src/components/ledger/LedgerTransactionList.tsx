import { useIsMobile } from '../../lib/useIsMobile'
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
// useIsMobile is the negation of Tailwind's `md:` query, so the branch taken here
export function LedgerTransactionList(props: LedgerListProps) {
  const isMobile = useIsMobile(768)
  return isMobile ? <MobileLedgerList {...props} /> : <DesktopLedgerTable {...props} />
}
