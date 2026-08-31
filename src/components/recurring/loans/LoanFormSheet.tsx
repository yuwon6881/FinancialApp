import { useEffect, useMemo, useState } from 'react'
import type { Loan, LoanInterestMethod, LoanRateBasis, RecurringPayment } from '../../../types'
import { financialDate } from '../../../lib/financialDate'
import { scheduledPayment } from '../../../lib/loanAmortization'
import {
  LOAN_INTEREST_METHOD_OPTIONS,
  LOAN_RATE_BASIS_OPTIONS,
  annualRateFromEntry,
  entryRateFromAnnual,
  formatRatePercent,
  loanInterestMethodCopy,
} from '../../../lib/loanTerms'
import {
  countLoanPaymentsThrough,
  durationFromTermPeriods,
  termPeriodsFromDuration,
  type LoanDurationUnit,
} from '../../../lib/loanTermSchedule'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { DatePicker } from '../../ui/DatePicker'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { ModalActions } from '../../ui/ModalActions'
import { SmartAmountInput } from '../../ui/SmartAmountInput'

interface LoanFormSheetProps {
  isOpen: boolean
  editingLoan: Loan | null
  payments: RecurringPayment[]
  linkedPaymentIds: Set<string>
  onClose: () => void
  onSave: (loan: Partial<Loan>) => void
}

export function LoanFormSheet({ isOpen, editingLoan, payments, linkedPaymentIds, onClose, onSave }: LoanFormSheetProps) {
  const [name, setName] = useState('')
  const [recurringPaymentId, setRecurringPaymentId] = useState('')
  const [openingPrincipal, setOpeningPrincipal] = useState('')
  const [trackingStartDate, setTrackingStartDate] = useState(financialDate())
  const [rateEntry, setRateEntry] = useState('')
  const [rateBasis, setRateBasis] = useState<LoanRateBasis>('Yearly')
  const [termLength, setTermLength] = useState('')
  const [termUnit, setTermUnit] = useState<LoanDurationUnit>('Months')
  const [interestMethod, setInterestMethod] = useState<LoanInterestMethod>('ReducingBalance')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setName(editingLoan?.name ?? '')
    setRecurringPaymentId(editingLoan?.recurringPaymentId ?? '')
    setOpeningPrincipal(editingLoan ? String(editingLoan.openingPrincipal) : '')
    setTrackingStartDate(editingLoan?.trackingStartDate ?? financialDate())
    const nextRateBasis = editingLoan?.rateBasis ?? 'Yearly'
    setRateBasis(nextRateBasis)
    setRateEntry(editingLoan ? String(entryRateFromAnnual(editingLoan.annualRatePercent, nextRateBasis)) : '')
    const duration = durationFromTermPeriods(editingLoan?.termPeriods ?? 0, editingLoan?.scheduleFrequency)
    setTermLength(editingLoan ? String(duration.value) : '')
    setTermUnit(duration.unit)
    setInterestMethod(editingLoan?.interestMethod ?? 'ReducingBalance')
    setError(null)
  }, [editingLoan, isOpen])

  const editingPaymentId = editingLoan?.recurringPaymentId
  const paymentOptions = useMemo(() => {
    const selected = payments.find(payment => payment.id === recurringPaymentId)
    const options = payments
      .filter(payment => !linkedPaymentIds.has(payment.id) || payment.id === editingPaymentId)
      .map(payment => ({ value: payment.id, label: `${payment.name} · ${payment.frequency}` }))
    if (!selected && recurringPaymentId) {
      options.unshift({ value: recurringPaymentId, label: 'This bill was deleted — choose another' })
    }
    return options
  }, [editingPaymentId, linkedPaymentIds, payments, recurringPaymentId])

  const principal = Number(openingPrincipal)
  const enteredRate = Number(rateEntry)
  const annualRatePercent = annualRateFromEntry(enteredRate, rateBasis)
  const selectedPayment = payments.find(payment => payment.id === recurringPaymentId)
  const previewFrequency = recurringPaymentId === editingLoan?.recurringPaymentId
    ? editingLoan.scheduleFrequency
    : selectedPayment?.frequency
  const term = termPeriodsFromDuration(Number(termLength), termUnit, previewFrequency)
  const preview = principal > 0 && Number.isFinite(annualRatePercent) && term !== null
    && Boolean(previewFrequency)
    ? scheduledPayment({ openingPrincipal: principal, annualRatePercent, termPeriods: term, interestMethod }, previewFrequency)
    : null

  useEffect(() => {
    if (!selectedPayment?.endDate || !previewFrequency) return
    const linkChanged = recurringPaymentId !== editingLoan?.recurringPaymentId
    if (editingLoan && !linkChanged) return
    const count = countLoanPaymentsThrough({
      trackingStartDate,
      scheduleFrequency: previewFrequency,
      scheduleDueDay: selectedPayment.dueDate,
      scheduleStartDate: selectedPayment.startDate,
      scheduleStatus: 'Complete',
    }, selectedPayment.endDate)
    if (count == null) return
    const duration = durationFromTermPeriods(count, previewFrequency)
    setTermLength(String(duration.value))
    setTermUnit(duration.unit)
  }, [editingLoan, previewFrequency, recurringPaymentId, selectedPayment, trackingStartDate])

  const handleTermUnitChange = (nextUnit: LoanDurationUnit) => {
    const serialized = termPeriodsFromDuration(Number(termLength), termUnit, previewFrequency)
    if (serialized != null) {
      const nextValue = previewFrequency === 'Annually'
        ? (nextUnit === 'Years' ? serialized : serialized * 12)
        : (nextUnit === 'Years' ? serialized / 12 : serialized)
      setTermLength(String(nextValue))
    }
    setTermUnit(nextUnit)
  }

  const handleRateBasisChange = (nextBasis: LoanRateBasis) => {
    if (Number.isFinite(enteredRate)) {
      const annual = annualRateFromEntry(enteredRate, rateBasis)
      setRateEntry(String(entryRateFromAnnual(annual, nextBasis)))
    }
    setRateBasis(nextBasis)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!rateEntry.trim() || !Number.isFinite(enteredRate) || enteredRate < 0 || !Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 100) {
      setError(rateBasis === 'Monthly'
        ? 'Interest rate must be between 0% and 8.3333% a month.'
        : 'Interest rate must be between 0% and 100% a year.')
      return
    }
    if (!name.trim() || !recurringPaymentId || !(principal > 0) || !trackingStartDate
      || term == null) {
      setError('Enter a name, link a bill, and complete the loan terms.')
      return
    }
    onSave({
      id: editingLoan?.id,
      name: name.trim(),
      recurringPaymentId,
      openingPrincipal: Math.round(principal * 100) / 100,
      trackingStartDate,
      annualRatePercent,
      rateBasis,
      termPeriods: term,
      interestMethod,
      snapshot: editingLoan?.snapshot,
    })
    onClose()
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      title={editingLoan ? 'Edit loan' : 'Add a loan'}
      description="Link a recurring bill and set terms to project repayment progress and interest."
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      footer={(
        <ModalActions>
          <Button variant="outline" type="button" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button variant="primary" type="submit" form="loan-form" className="rounded-xl shadow-md">{editingLoan ? 'Save changes' : 'Add loan'}</Button>
        </ModalActions>
      )}
    >
      <form id="loan-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">{error}</p>}
        <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
          <FormField label="Loan name" required>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Car loan" autoComplete="off" className="w-full" />
          </FormField>
          <FormField label="Linked recurring bill" required>
            <CustomSelect
              value={recurringPaymentId}
              onChange={setRecurringPaymentId}
              options={paymentOptions}
              placeholder="Select a recurring bill"
              ariaLabel="Linked recurring bill"
              className="w-full"
            />
          </FormField>
          <FormField label="Starting amount owed" required>
            <SmartAmountInput value={openingPrincipal} onChange={event => setOpeningPrincipal(event.target.value)} placeholder="0.00" className="w-full" />
          </FormField>
          <FormField label="Include payments from" required>
            <DatePicker value={trackingStartDate} onChange={setTrackingStartDate} className="w-full" required />
          </FormField>
          <FormField
            label="Interest rate"
            hint={rateBasis === 'Monthly' && Number.isFinite(annualRatePercent) ? `That's ${formatRatePercent(annualRatePercent)} a year.` : undefined}
            required
          >
            <div className="flex min-w-0 gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  id="loan-rate-entry"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={rateBasis === 'Monthly' ? '8.3333' : '100'}
                  step={rateBasis === 'Monthly' ? '0.0001' : '0.01'}
                  value={rateEntry}
                  onChange={event => setRateEntry(event.target.value)}
                  placeholder={rateBasis === 'Monthly' ? '1.50' : '5.50'}
                  className="w-full pr-8"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground/80">%</span>
              </div>
              <CustomSelect
                id="loan-rate-basis"
                value={rateBasis}
                onChange={handleRateBasisChange}
                options={LOAN_RATE_BASIS_OPTIONS}
                ariaLabel="Interest rate period"
                className="w-[7.5rem] shrink-0"
              />
            </div>
          </FormField>
          <FormField label="Loan length" required>
            <div className="flex min-w-0 gap-2">
              <Input
                id="loan-term-length"
                type="number"
                inputMode="numeric"
                min={termUnit === 'Years' ? 1 / 12 : 1}
                max={termUnit === 'Years' ? (previewFrequency === 'Annually' ? 360 : 30) : (previewFrequency === 'Annually' ? 4320 : 360)}
                step={termUnit === 'Years' && previewFrequency === 'Monthly' ? 1 / 12 : 1}
                value={termLength}
                onChange={event => setTermLength(event.target.value)}
                placeholder={termUnit === 'Years' ? '5' : '60'}
                className="w-full"
              />
              <CustomSelect
                id="loan-term-unit"
                value={termUnit}
                onChange={handleTermUnitChange}
                options={[{ value: 'Years' as const, label: 'years' }, { value: 'Months' as const, label: 'months' }]}
                ariaLabel="Loan length unit"
                className="w-[7.5rem] shrink-0"
              />
            </div>
          </FormField>
        </div>
        <FormField label="Interest method" hint={loanInterestMethodCopy(interestMethod).hint} required>
          <CustomSelect value={interestMethod} onChange={setInterestMethod} options={LOAN_INTEREST_METHOD_OPTIONS} ariaLabel="Interest method" className="w-full" />
        </FormField>
        {preview !== null && (
          <div className="flex items-center justify-between rounded-xl border border-accent-ink/20 bg-accent/15 px-3.5 py-2.5 text-xs text-foreground">
            <span className="font-semibold text-muted-foreground">Estimated payment:</span>
            <span className="font-extrabold text-accent-ink">{preview.toFixed(2)}</span>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
