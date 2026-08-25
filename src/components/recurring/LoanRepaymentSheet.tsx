import { useEffect, useMemo, useState } from 'react'
import type { LedgerAccount, Loan, LoanRepaymentPreviewResult, RecurringPayment } from '../../types'
import { previewAdvanceRepayment } from '../../lib/api/loans'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { FormField } from '../ui/FormField'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { ModalActions } from '../ui/ModalActions'
import { AlertBanner } from '../ui/AlertBanner'
import { InfoHint } from '../ui/InfoHint'
import { Input } from '../ui/Input'
import { Loader2, Minus, Plus } from 'lucide-react'

interface LoanRepaymentSheetProps {
  isOpen: boolean
  loan: Loan | null
  payment?: RecurringPayment | null
  accounts: LedgerAccount[]
  currency: string
  onClose: () => void
  onAdvanceRepayment: (loanId: string, cycles: number, accountId?: string, previewFingerprint?: string) => Promise<void>
  onFullSettlement: (loanId: string, quoteAmount: number, accountId?: string) => Promise<void>
}

type RepaymentTab = 'advance' | 'settlement'

export function LoanRepaymentSheet({
  isOpen,
  loan,
  payment,
  accounts,
  currency,
  onClose,
  onAdvanceRepayment,
  onFullSettlement,
}: LoanRepaymentSheetProps) {
  const [tab, setTab] = useState<RepaymentTab>('advance')
  const [cyclesInput, setCyclesInput] = useState('1')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [preview, setPreview] = useState<LoanRepaymentPreviewResult | null>(null)
  const [previewLoanId, setPreviewLoanId] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Unknown counts as blocked: payment is optional, and treating a bill that has not loaded as
  // manual opened both tabs on exactly the loans whose mode could not be checked.
  const isAutoDeduct = payment?.paymentMode !== 'Manual'
  const repaymentBlockedReason = !payment
    ? 'This loan\'s bill has not loaded yet, so its payment mode cannot be checked. Reopen this once the Recurring Bills tab has loaded.'
    : isAutoDeduct
      ? 'This loan is linked to an auto-deducted bill. Direct debits cannot be brought forward, paid in advance, or settled early — switch the bill to manual payment first.'
      : null
  const maxAvailableCycles = useMemo(() => {
    if (!loan) return 1
    // The loan list intentionally carries only a short schedule preview. The persisted term is
    // the honest input ceiling here; the server preview narrows it to the instalments still open.
    return Math.max(1, Math.min(loan.termPeriods, 60))
  }, [loan])

  const eligibleAccounts = useMemo(() => {
    return accounts.filter(account => !account.isArchived)
  }, [accounts])

  const accountOptions = useMemo(() => {
    return eligibleAccounts.map(account => ({
      value: account.id,
      label: `${account.name} (${account.bucket})`,
    }))
  }, [eligibleAccounts])

  useEffect(() => {
    if (!isOpen || !loan) {
      setTab('advance')
      setCyclesInput('1')
      setQuoteAmount('')
      setSelectedAccountId('')
      setPreview(null)
      setPreviewLoanId(null)
      setPreviewLoading(false)
      setPreviewError(null)
      setSubmitting(false)
      setActionError(null)
      return
    }

    const defaultAccId = payment?.accountId || eligibleAccounts[0]?.id || ''
    setSelectedAccountId(defaultAccId)
    setQuoteAmount(loan.snapshot.outstandingBalance > 0 ? String(loan.snapshot.outstandingBalance) : '')
  }, [isOpen, loan, payment, eligibleAccounts])

  const cycles = useMemo(() => {
    const parsed = Number.parseInt(cyclesInput, 10)
    return Number.isFinite(parsed) ? Math.min(maxAvailableCycles, Math.max(1, parsed)) : 1
  }, [cyclesInput, maxAvailableCycles])

  useEffect(() => {
    if (!isOpen) return
    setCyclesInput(current => String(Math.min(maxAvailableCycles, Math.max(1, Number.parseInt(current, 10) || 1))))
  }, [isOpen, maxAvailableCycles])

  useEffect(() => {
    if (!isOpen || !loan || tab !== 'advance' || isAutoDeduct) return
    if (previewLoanId === loan.id && preview?.cyclesCount === cycles) {
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    const controller = new AbortController()
    setPreviewLoading(true)
    setPreviewError(null)
    const timer = window.setTimeout(() => {
      setPreviewLoading(true)
      previewAdvanceRepayment(loan.id, cycles, controller.signal)
        .then(result => {
          setPreview(result)
          setPreviewLoanId(loan.id)
        })
        .catch(err => {
          if (!controller.signal.aborted) {
            setPreviewError(err instanceof Error ? err.message : 'Failed to preview cycles')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setPreviewLoading(false)
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isOpen, loan, cycles, tab, isAutoDeduct, preview, previewLoanId])

  if (!loan) return null

  const handleAdvanceSubmit = async () => {
    setActionError(null)
    setSubmitting(true)
    try {
      if (!preview?.previewFingerprint) {
        setActionError('Wait for the repayment preview before confirming.')
        return
      }
      await onAdvanceRepayment(loan.id, preview.cyclesCount, selectedAccountId || undefined, preview.previewFingerprint)
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record advance repayment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSettlementSubmit = async () => {
    setActionError(null)
    const amountNum = Number(quoteAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setActionError('Enter a valid settlement amount.')
      return
    }
    setSubmitting(true)
    try {
      await onFullSettlement(loan.id, amountNum, selectedAccountId || undefined)
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record full settlement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">Pay {loan.name}</div>
          <p className="text-[11px] font-normal text-muted-foreground">Linked bill: {loan.recurringPaymentName || 'Recurring bill'}</p>
        </div>
      }
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-5">
        {/* Mode switcher tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-semibold">
          <Button
            variant="unstyled"
            type="button"
            onClick={() => { setTab('advance'); setActionError(null) }}
            className={`rounded-lg py-2 transition-all cursor-pointer text-center ${
              tab === 'advance'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Advance cycles
          </Button>
          <Button
            variant="unstyled"
            type="button"
            onClick={() => { setTab('settlement'); setActionError(null) }}
            className={`rounded-lg py-2 transition-all cursor-pointer text-center ${
              tab === 'settlement'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Full settlement
          </Button>
        </div>

        {actionError && (
          <AlertBanner variant="error" className="text-xs">
            {actionError}
          </AlertBanner>
        )}

        {tab === 'advance' ? (
          <div className="space-y-4">
            {repaymentBlockedReason ? (
              <AlertBanner variant="warning">{repaymentBlockedReason}</AlertBanner>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">Number of instalments to pay</p>
                      <p className="text-[11px] text-muted-foreground">Type a number from 1 to {maxAvailableCycles}, or use the step buttons.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setCyclesInput(String(Math.max(1, cycles - 1)))}
                        disabled={cycles <= 1 || submitting}
                        aria-label="Decrease cycles"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={maxAvailableCycles}
                        step={1}
                        value={cyclesInput}
                        onChange={event => setCyclesInput(event.target.value.replace(/\D/g, ''))}
                        onBlur={() => setCyclesInput(String(cycles))}
                        aria-label="Number of instalments to pay"
                        controlSize="sm"
                        className="w-16 text-center font-extrabold tabular-nums"
                        disabled={submitting}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setCyclesInput(String(Math.min(maxAvailableCycles, cycles + 1)))}
                        disabled={cycles >= maxAvailableCycles || submitting}
                        aria-label="Increase cycles"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {previewLoading ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-accent-ink" />
                    <span>Calculating cycle breakdown…</span>
                  </div>
                ) : previewError ? (
                  <AlertBanner variant="warning" className="text-xs">
                    {previewError}
                  </AlertBanner>
                ) : preview ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border/60 overflow-hidden text-xs">
                      <div className="bg-muted/40 px-3 py-2 font-bold text-muted-foreground border-b border-border/40 flex justify-between">
                        <span>Cycle</span>
                        <span>Payment</span>
                      </div>
                      <div className="divide-y divide-border/30 max-h-48 overflow-y-auto">
                        {preview.occurrences.map((occ, idx) => (
                          <div key={occ.occurrenceDate} className="px-3 py-2 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground">Cycle {idx + 1} · {occ.occurrenceDate}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Principal: {formatCurrencyVal(occ.principal, currency)} · Interest: {formatCurrencyVal(occ.interest, currency)}
                              </p>
                            </div>
                            <span className="font-bold text-foreground">
                              {formatCurrencyVal(occ.payment, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-muted/20 px-3 py-2.5 border-t border-border/40 flex items-center justify-between font-bold">
                        <span className="text-foreground">Total to pay</span>
                        <span className="text-sm text-accent-ink">
                          {formatCurrencyVal(preview.totalAmount, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {accountOptions.length > 0 && (
                  <FormField label="Pay from account" id="advance-account-select">
                    <CustomSelect
                      id="advance-account-select"
                      value={selectedAccountId}
                      onChange={setSelectedAccountId}
                      options={accountOptions}
                      disabled={submitting}
                    />
                  </FormField>
                )}

                <ModalActions className="pt-2">
                  <Button variant="outline" type="button" onClick={onClose} disabled={submitting} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleAdvanceSubmit}
                    disabled={submitting || previewLoading || !preview || isAutoDeduct}
                    className="rounded-xl shadow-md"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Recording…</span>
                    ) : (
                      <span>Pay {preview?.cyclesCount ?? cycles} {(preview?.cyclesCount ?? cycles) === 1 ? 'cycle' : 'cycles'} ({formatCurrencyVal(preview?.totalAmount ?? 0, currency)})</span>
                    )}
                  </Button>
                </ModalActions>
              </>
            )}
          </div>
        ) : repaymentBlockedReason ? (
          <AlertBanner variant="warning">{repaymentBlockedReason}</AlertBanner>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">Lender settlement quote</span>
                <InfoHint label="Lender settlement quote" text="Enter the exact amount your lender quoted to close the loan account in full, including any interest rebate." />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Recording a full settlement sets the loan balance to zero, stops its recurring bill schedule, and marks every remaining instalment as settled by the payoff. Any instalment still unpaid from before today has to be recorded or discarded first.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Settlement amount" id="settlement-amount-input">
                <SmartAmountInput
                  id="settlement-amount-input"
                  value={quoteAmount}
                  onChange={e => setQuoteAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={submitting}
                />
              </FormField>

              {accountOptions.length > 0 && (
                <FormField label="Pay from account" id="settlement-account-select">
                  <CustomSelect
                    id="settlement-account-select"
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    options={accountOptions}
                    disabled={submitting}
                  />
                </FormField>
              )}
            </div>

            <ModalActions className="pt-2">
              <Button variant="outline" type="button" onClick={onClose} disabled={submitting} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleSettlementSubmit}
                disabled={submitting || !quoteAmount || Number(quoteAmount) <= 0}
                className="rounded-xl shadow-md"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Settling…</span>
                ) : (
                  <span>Record full settlement ({formatCurrencyVal(Number(quoteAmount) || 0, currency)})</span>
                )}
              </Button>
            </ModalActions>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
