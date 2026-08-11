import { motionSafeScrollBehavior } from './motionPreference'

export type LedgerRowLayout = 'desktop' | 'mobile'

export function ledgerTransactionRowId(transactionId: string, layout: LedgerRowLayout): string {
  return `tx-row-${layout}-${transactionId}`
}

export function getLedgerTransactionRowElement(
  transactionId: string,
  isMobile: boolean,
  documentRoot: Pick<Document, 'getElementById'> = document,
): HTMLElement | null {
  return documentRoot.getElementById(ledgerTransactionRowId(transactionId, isMobile ? 'mobile' : 'desktop'))
}

export function scrollLedgerTransactionRowIntoView(element: HTMLElement): void {
  element.scrollIntoView({ behavior: motionSafeScrollBehavior(), block: 'center' })
}
