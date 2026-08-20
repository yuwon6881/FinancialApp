import { useEffect, useMemo, useState } from 'react'
import type { ActiveRecurringPayment, LedgerAccount, RecurringPayment } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { FormField } from '../ui/FormField'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { AlertBanner } from '../ui/AlertBanner'
import { InfoHint } from '../ui/InfoHint'
import { Loader2 } from 'lucide-react'

interface PayEarlySheetProps {
  isOpen: boolean
  payment: RecurringPayment | null
  occurrence?: ActiveRecurringPayment | null
  accounts: LedgerAccount[]
  currency: string
  onClose: () => void
  onPayEarly: (id: string, amount?: number, accountId?: string, settlesOccurrence?: boolean) => Promise<void> | void
}

type PayEarlyMode = 'full' | 'partial'

export function PayEarlySheet({
  isOpen,
  payment,
  occurrence,
  accounts,
  currency,
  onClose,
  onPayEarly,
}: PayEarlySheetProps) {
  const [mode, setMode] = useState<PayEarlyMode>('full')
  const [partialAmount, setPartialAmount] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scheduledAmount = Math.abs(occurrence?.scheduledAmount ?? payment?.amount ?? 0)
  const outstandingAmount = Math.abs(occurrence?.remainingAmount ?? occurrence?.amount ?? payment?.amount ?? 0)
  const alreadyPaidAmount = Math.max(0, scheduledAmount - outstandingAmount)
  const isAutoDeduct = payment?.paymentMode !== 'Manual'

  useEffect(() => {
    if (isOpen && payment) {
      setMode('full')
      setPartialAmount('')
      setSelectedAccountId(payment.accountId ?? '')
      setError(null)
    }
  }, [isOpen, payment])

  const accountOptions = useMemo(() => {
    return accounts
      .filter(a => !a.isArchived)
      .map(a => ({
        value: a.id,
        label: a.name,
      }))
  }, [accounts])

  const parsedPartialAmount = useMemo(() => {
    if (mode !== 'partial') return undefined
    const trimmed = partialAmount.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }, [mode, partialAmount])

  const remainingAmount = useMemo(() => {
    if (parsedPartialAmount == null) return 0
    return Math.max(0, outstandingAmount - parsedPartialAmount)
  }, [outstandingAmount, parsedPartialAmount])

  const handleSubmit = async () => {
    if (!payment) return
    setError(null)

    if (mode === 'partial') {
      if (parsedPartialAmount == null || parsedPartialAmount <= 0) {
        setError('Please enter a valid amount to pay.')
        return
      }
      if (parsedPartialAmount >= outstandingAmount) {
        setError('Part payment must be less than the amount still due. Choose "Pay in full" instead.')
        return
      }
    }

    setSubmitting(true)
    try {
      await onPayEarly(
        payment.id,
        mode === 'partial' ? parsedPartialAmount : outstandingAmount,
        selectedAccountId || undefined,
        mode === 'full',
      )
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record payment'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!payment) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">Pay {payment.name} early</div>
          <p className="text-[11px] font-normal text-muted-foreground">Due on {payment.nextDueDate || 'upcoming date'}</p>
        </div>
      }
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-5">
        {isAutoDeduct ? (
          <AlertBanner variant="warning">
            This bill is deducted automatically, so it can’t be paid ahead of time. Switch the bill to manual payment first if you want to pay early.
          </AlertBanner>
        ) : (
          <>
            {/* Full vs Partial switcher */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-semibold">
              <Button
                variant="unstyled"
                type="button"
                onClick={() => { setMode('full'); setError(null) }}
                className={`rounded-lg py-2 transition-all cursor-pointer text-center ${
                  mode === 'full'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pay in full
              </Button>
              <Button
                variant="unstyled"
                type="button"
                onClick={() => { setMode('partial'); setError(null) }}
                className={`rounded-lg py-2 transition-all cursor-pointer text-center ${
                  mode === 'partial'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pay part amount
              </Button>
            </div>

            {error && (
              <AlertBanner variant="error" className="text-xs">
                {error}
              </AlertBanner>
            )}

            {mode === 'full' ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount still due</span>
                  <span className="text-sm font-extrabold text-foreground">
                    {formatCurrencyVal(outstandingAmount, currency)}
                  </span>
                </div>
                {alreadyPaidAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Already recorded</span>
                    <span className="font-bold text-foreground">{formatCurrencyVal(alreadyPaidAmount, currency)}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Recording this full payment will add a transaction to your ledger and advance the subscription to the next cycle.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">Part payment</span>
                    <InfoHint label="Part payment" text="Pay a portion of this bill now. The rest stays due on the scheduled date." />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total bill amount</span>
                    <span className="font-bold text-foreground">{formatCurrencyVal(scheduledAmount, currency)}</span>
                  </div>
                  {alreadyPaidAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Already recorded</span>
                      <span className="font-bold text-foreground">{formatCurrencyVal(alreadyPaidAmount, currency)}</span>
                    </div>
                  )}
                </div>

                <FormField label="Amount to pay now" id="pay-early-partial-amount">
                  <SmartAmountInput
                    id="pay-early-partial-amount"
                    value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={submitting}
                  />
                </FormField>

                {parsedPartialAmount != null && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Paying now</span>
                      <span className="font-extrabold text-foreground">{formatCurrencyVal(parsedPartialAmount, currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Still due</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">{formatCurrencyVal(remainingAmount, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {accountOptions.length > 0 && (
              <FormField label="Pay from account" id="pay-early-account-select">
                <CustomSelect
                  id="pay-early-account-select"
                  value={selectedAccountId}
                  onChange={setSelectedAccountId}
                  options={accountOptions}
                  disabled={submitting}
                />
              </FormField>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleSubmit}
                disabled={submitting || isAutoDeduct || (mode === 'partial' && (parsedPartialAmount == null || parsedPartialAmount <= 0))}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Recording…</span>
                ) : (
                  <span>
                    Pay now ({formatCurrencyVal(mode === 'partial' ? (parsedPartialAmount ?? 0) : outstandingAmount, currency)})
                  </span>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
