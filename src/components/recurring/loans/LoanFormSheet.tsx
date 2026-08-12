import { useEffect, useMemo, useState } from 'react'
import type { Loan, LoanInterestMethod, RecurringPayment } from '../../../types'
import { financialDate } from '../../../lib/financialDate'
import { scheduledPayment } from '../../../lib/loanAmortization'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { DatePicker } from '../../ui/DatePicker'
import { FormField } from '../../ui/FormField'
import { InfoHint } from '../../ui/InfoHint'
import { Input } from '../../ui/Input'
import { SmartAmountInput } from '../../ui/SmartAmountInput'

interface LoanFormSheetProps {
  isOpen: boolean
  editingLoan: Loan | null
  payments: RecurringPayment[]
  linkedPaymentIds: Set<string>
  onClose: () => void
  onSave: (loan: Partial<Loan>) => void
}

const interestOptions = [
  { value: 'ReducingBalance' as const, label: "Interest on what's left" },
  { value: 'Flat' as const, label: 'Interest on the original amount' },
]

export function LoanFormSheet({ isOpen, editingLoan, payments, linkedPaymentIds, onClose, onSave }: LoanFormSheetProps) {
  const [name, setName] = useState('')
  const [recurringPaymentId, setRecurringPaymentId] = useState('')
  const [openingPrincipal, setOpeningPrincipal] = useState('')
  const [trackingStartDate, setTrackingStartDate] = useState(financialDate())
  const [annualRatePercent, setAnnualRatePercent] = useState('')
  const [termPeriods, setTermPeriods] = useState('')
  const [interestMethod, setInterestMethod] = useState<LoanInterestMethod>('ReducingBalance')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setName(editingLoan?.name ?? '')
    setRecurringPaymentId(editingLoan?.recurringPaymentId ?? '')
    setOpeningPrincipal(editingLoan ? String(editingLoan.openingPrincipal) : '')
    setTrackingStartDate(editingLoan?.trackingStartDate ?? financialDate())
    setAnnualRatePercent(editingLoan ? String(editingLoan.annualRatePercent) : '')
    setTermPeriods(editingLoan ? String(editingLoan.termPeriods) : '')
    setInterestMethod(editingLoan?.interestMethod ?? 'ReducingBalance')
    setError(null)
  }, [editingLoan, isOpen])

  const paymentOptions = useMemo(() => {
    const selected = payments.find(payment => payment.id === recurringPaymentId)
    const options = payments
      .filter(payment => !linkedPaymentIds.has(payment.id) || payment.id === editingLoan?.recurringPaymentId)
      .map(payment => ({ value: payment.id, label: `${payment.name} · ${payment.frequency}` }))
    if (!selected && recurringPaymentId) {
      options.unshift({ value: recurringPaymentId, label: 'This bill was deleted — choose another' })
    }
    return options
  }, [editingLoan?.recurringPaymentId, linkedPaymentIds, payments, recurringPaymentId])

  const principal = Number(openingPrincipal)
  const rate = Number(annualRatePercent)
  const term = Number(termPeriods)
  const preview = principal > 0 && Number.isFinite(rate) && term > 0
    ? scheduledPayment({ openingPrincipal: principal, annualRatePercent: rate, termPeriods: term, interestMethod }, payments.find(payment => payment.id === recurringPaymentId)?.frequency)
    : null

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !recurringPaymentId || !(principal > 0) || !trackingStartDate
      || !annualRatePercent.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100
      || !Number.isInteger(term) || term < 1 || term > 360) {
      setError('Enter a name, link a bill, and complete the loan terms.')
      return
    }
    onSave({
      id: editingLoan?.id,
      name: name.trim(),
      recurringPaymentId,
      openingPrincipal: Math.round(principal * 100) / 100,
      trackingStartDate,
      annualRatePercent: Math.round(rate * 10000) / 10000,
      termPeriods: Math.trunc(term),
      interestMethod,
      snapshot: editingLoan?.snapshot,
    })
    onClose()
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      title={editingLoan ? 'Edit loan' : 'Add a loan'}
      onClose={onClose}
      description="Add the terms once. The balance is calculated from the linked bill's payment history."
      maxWidthClassName="max-w-2xl"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="loan-form">{editingLoan ? 'Save changes' : 'Add loan'}</Button>
        </div>
      )}
    >
      <form id="loan-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Loan name" required>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Car loan" autoComplete="off" className="w-full" />
          </FormField>
          <FormField label="Linked recurring bill" required hint="The bill's occurrence date controls the payment order.">
            <CustomSelect
              value={recurringPaymentId}
              onChange={setRecurringPaymentId}
              options={paymentOptions}
              placeholder="Select a recurring bill"
              ariaLabel="Linked recurring bill"
              className="w-full"
            />
          </FormField>
          <FormField label="Opening amount" required hint="The amount still owed when tracking starts.">
            <SmartAmountInput value={openingPrincipal} onChange={event => setOpeningPrincipal(event.target.value)} placeholder="0.00" className="w-full" />
          </FormField>
          <FormField label="Tracking starts" required hint="Payments before this date are not included.">
            <DatePicker value={trackingStartDate} onChange={setTrackingStartDate} className="w-full" required />
          </FormField>
          <FormField label="Annual interest rate" required hint="Enter 5.5 for 5.5%, not 0.055.">
            <div className="relative w-full">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={annualRatePercent}
                onChange={event => setAnnualRatePercent(event.target.value)}
                placeholder="5.50"
                className="w-full pr-8"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground/80">%</span>
            </div>
          </FormField>
          <FormField label="Number of payments" required hint="Monthly bills count months; annual bills count years.">
            <Input type="number" min="1" max="360" step="1" value={termPeriods} onChange={event => setTermPeriods(event.target.value)} placeholder="60" className="w-full" />
          </FormField>
        </div>
        <FormField label={<span className="inline-flex items-center gap-1.5">Interest method <InfoHint label="interest method" text="Interest on what's left falls as the amount owed falls. Interest on the original amount keeps the interest base unchanged." /></span>} required>
          <CustomSelect value={interestMethod} onChange={setInterestMethod} options={interestOptions} ariaLabel="Interest method" className="w-full" />
        </FormField>
        {preview !== null && (
          <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            Estimated scheduled payment: <strong className="text-foreground">{preview.toFixed(2)}</strong>. This is a planning figure; the recorded bill history remains the source for the live balance.
          </p>
        )}
      </form>
    </BottomSheet>
  )
}
