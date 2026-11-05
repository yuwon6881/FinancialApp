import type { InvestmentPortfolio } from '../types'

export type InvestmentMarketValue =
  | { kind: 'known'; worth: number; sent: number; gain: number }
  /** The broker holds money but a price or rate is missing, so its worth today is unknown. */
  | { kind: 'unknown' }

/**
 * What the investments are worth at today's prices beside what was sent to the broker, for the
 * Accounts total. Ledger accounts record money sent, never market moves, so the gain is the one
 * figure the ledger cannot know; it is read from the investment ledger, never written back.
 *
 * Absent (null) when there is nothing invested, when the portfolio is in another currency than
 * the ledger (the two totals cannot be added honestly), or before the portfolio has loaded.
 */
export function investmentMarketValue(
  portfolio: Pick<InvestmentPortfolio, 'appCurrency' | 'summary'> & { accounts: ReadonlyArray<{ isArchived: boolean }> } | null,
  ledgerCurrency: string,
): InvestmentMarketValue | null {
  if (!portfolio || portfolio.appCurrency.toUpperCase() !== ledgerCurrency.toUpperCase()) return null
  if (!portfolio.accounts.some(account => !account.isArchived)) return null
  const { totalValue, netDeposits } = portfolio.summary
  if (totalValue === undefined || netDeposits === undefined) return { kind: 'unknown' }
  if (totalValue === 0 && netDeposits === 0) return null
  const round = (value: number) => Math.round(value * 100) / 100
  return { kind: 'known', worth: totalValue, sent: netDeposits, gain: round(totalValue - netDeposits) }
}
