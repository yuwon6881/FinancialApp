import React, { useEffect, useRef, useState } from 'react'
import type {
  InvestmentActivity,
  InvestmentPortfolio,
  InvestmentTransactionType,
} from '../../types'
import type { InvestmentActivityScanResult } from '../../lib/api'
import * as api from '../../lib/api'
import {
  type PendingInvestmentActivity,
  validateActivityBalances,
} from '../../lib/investmentValidation'
import { getErrorMessage } from '../../lib/errors'
import { maskCurrencyInput } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { ModalActions } from '../ui/ModalActions'
import { MutationButtonContent } from '../ui/MutationButtonContent'
import { focusFirstInvalidField } from '../ui/formValidation'
import { ReceiptScanPicker } from '../ledger/transaction-form/ReceiptScanPicker'
import { ReceiptScanStatus } from '../ledger/transaction-form/ReceiptScanStatus'

const activityTypes: Array<{ value: InvestmentTransactionType; label: string }> = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'FeeTax', label: 'Fee / tax' },
]

const today = () => {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const numberOrUndefined = (value: string) => value.trim() === '' ? undefined : Number(value)
const positiveNumberOrUndefined = (value: string) => {
  const n = numberOrUndefined(value)
  return n !== undefined && n > 0 && !isNaN(n) ? n : undefined
}
const fmtUnits = (value: number) => value.toFixed(6).replace(/\.?0+$/, '')
const fmtMoney = (value: number) => value.toFixed(2)

// Which inputs an activity type actually puts in front of the user. A value left behind in a
// field the current type hides is still submitted, so nothing — a scan least of all — may write
// to one of these unless the type it belongs to shows it.
const showsUnits = (type: InvestmentTransactionType) => !['Dividend', 'FeeTax'].includes(type)
const showsUnitPrice = (type: InvestmentTransactionType) => ['Buy', 'Sell'].includes(type)
const showsFeesAndTaxes = (type: InvestmentTransactionType) => type !== 'FeeTax'
const formGridClass = 'grid items-start gap-4 sm:grid-cols-2'

const Field = ({ label, hint, error, className = '', required, children }: {
  label: React.ReactNode
  hint?: string
  error?: string
  className?: string
  required?: boolean
  plain?: boolean
  children: React.ReactNode
}) => (
  <FormField
    label={label}
    hint={hint}
    error={error}
    required={required}
    className={className}
    hintClassName="text-xs font-normal"
  >
    {children}
  </FormField>
)

const FormActions = ({ busy, onCancel, submitLabel, disabled }: { busy: boolean; onCancel: () => void; submitLabel: string; disabled?: boolean }) => (
  <ModalActions className="border-t border-border/40 pt-4">
    <Button type="button" variant="secondary" onClick={onCancel} className="rounded-xl">Cancel</Button>
    <Button type="submit" disabled={busy || disabled} aria-busy={busy} className="rounded-xl shadow-md">
      <MutationButtonContent state={busy ? 'saving' : null} entityLabel={submitLabel.toLocaleLowerCase()} idleLabel={submitLabel} />
    </Button>
  </ModalActions>
)

export const ActivityForm = ({ portfolio, initial, pendingActivities, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount, onNeedInstrument }: {
  portfolio: InvestmentPortfolio | null
  initial: InvestmentActivity | null
  pendingActivities: PendingInvestmentActivity[]
  busy: boolean
  scanDraft?: { jobId: string; result: InvestmentActivityScanResult } | null
  failedScanJob?: { jobId: string; errorMessage: string } | null
  activeScanJobIds?: string[]
  onScanStarted?: (scanId: string) => void
  onScanCleared?: (scanId: string) => void | Promise<void>
  onCancel: () => void
  onSave: (value: api.InvestmentActivityMutation) => Promise<boolean>
  onNeedAccount: () => void
  onNeedInstrument: () => void
}) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const instruments = portfolio?.instruments.filter(value => !value.isArchived) ?? []
  const initialScan = scanDraft && activityTypes.some(value => value.value === scanDraft.result.type) ? scanDraft.result : null
  const [type, setType] = useState<InvestmentTransactionType>(initial?.type ?? (initialScan?.type as InvestmentTransactionType) ?? 'Buy')
  const trade = ['Buy', 'Sell'].includes(type)
  const [accountId, setAccountId] = useState(initial?.accountId ?? (initialScan?.accountId && accounts.some(value => value.id === initialScan.accountId) ? initialScan.accountId : accounts[0]?.id ?? ''))
  const [instrumentId, setInstrumentId] = useState(initial?.instrumentId ?? (initialScan?.instrumentId && instruments.some(value => value.id === initialScan.instrumentId) ? initialScan.instrumentId : instruments[0]?.id ?? ''))
  const [tradeDate, setTradeDate] = useState(initial?.tradeDate ?? initialScan?.tradeDate ?? today())
  const initialScanType = (initialScan?.type ?? 'Buy') as InvestmentTransactionType
  const initialScanUnits = initialScan && showsUnits(initialScanType) ? initialScan.units : null
  const initialScanUnitPrice = initialScan && showsUnitPrice(initialScanType) ? initialScan.unitPrice : null
  const initialScanGross = initialScan?.cashAmount != null ? initialScan.cashAmount : null
  const initialScanCosts = initialScan && showsFeesAndTaxes(initialScanType) ? initialScan : null
  const [units, setUnits] = useState(initial?.units ? String(initial.units) : initialScanUnits != null ? String(initialScanUnits) : '')
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ? Number(initial.unitPrice).toFixed(2) : initialScanUnitPrice != null ? Number(initialScanUnitPrice).toFixed(2) : '')
  const initialGross = initial?.cashAmount
    ? Number(initial.cashAmount).toFixed(2)
    : initialScanGross != null
      ? Number(initialScanGross).toFixed(2)
      : initialScanUnits != null && initialScanUnitPrice != null
        ? (initialScanUnits * initialScanUnitPrice).toFixed(2)
        : ''
  const [cashAmount, setCashAmount] = useState(initialGross)
  const initialWorkedOut: 'units' | 'price' | 'gross' | null = trade && !initial ? (
    initialScanUnits != null && initialScanUnitPrice != null && initialScanGross == null
      ? 'gross'
      : initialScanUnits != null && initialScanGross != null && initialScanUnitPrice == null
        ? 'price'
        : initialScanUnitPrice != null && initialScanGross != null && initialScanUnits == null
          ? 'units'
          : null
  ) : null
  const [workedOutField, setWorkedOutField] = useState<'units' | 'price' | 'gross' | null>(initialWorkedOut)
  const [fees, setFees] = useState(initial?.fees != null ? Number(initial.fees).toFixed(2) : initialScanCosts?.fees != null ? Number(initialScanCosts.fees).toFixed(2) : '0.00')
  const [taxes, setTaxes] = useState(initial?.taxes != null ? Number(initial.taxes).toFixed(2) : initialScanCosts?.taxes != null ? Number(initialScanCosts.taxes).toFixed(2) : '0.00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(Boolean(initialScan))
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [activeScanJobId, setActiveScanJobId] = useState<string | null>(scanDraft?.jobId ?? null)
  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedScanJobRef = useRef<string | null>(null)
  const trackedScanJobsRef = useRef<Set<string>>(new Set())
  const selectedInstrument = instruments.find(value => value.id === instrumentId)

  // Read by the scan effect to resolve field exposure when the scan itself named no type.
  // A ref rather than a dependency so a plain type change cannot re-run that effect.
  const typeRef = useRef(type)
  useEffect(() => { typeRef.current = type }, [type])
  const changeType = (next: InvestmentTransactionType) => {
    setType(next)
    setWorkedOutField(null)
    if (!showsUnits(next)) setUnits('')
    if (!showsUnitPrice(next)) setUnitPrice('')
    if (!showsFeesAndTaxes(next)) { setFees('0.00'); setTaxes('0.00') }
  }
  const clearScan = () => {
    const jobId = activeScanJobId
    setActiveScanJobId(null)
    setIsScanning(false)
    setScanError(null)
    setShowScanBanner(false)
    if (jobId) {
      trackedScanJobsRef.current.delete(jobId)
      void onScanCleared?.(jobId)
    }
  }
  const handleScan = async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setShowScanBanner(false)
    try {
      const started = await api.startInvestmentScan(file)
      setActiveScanJobId(started.scanId)
      onScanStarted?.(started.scanId)
    } catch (error) {
      setScanError(getErrorMessage(error, 'Could not scan this investment image. Please try a clearer image.'))
      setIsScanning(false)
    } finally {
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }
  useEffect(() => {
    if (!scanDraft || appliedScanJobRef.current === scanDraft.jobId) return
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    const result = scanDraft.result
    const scannedActivityType = activityTypes.find(value => value.value === result.type)?.value
    if (result.type && !scannedActivityType) {
      setScanError('This looks like a cash movement, not a trade — record it under Cash')
      return
    }
    setShowScanBanner(true)
    // A dividend or standalone-charge scan can still report a holding size or a per-unit price.
    // Those inputs do not exist for those types, so applying them would save numbers the
    // reviewer never saw and has no way to correct.
    const appliedType = scannedActivityType ?? typeRef.current
    if (scannedActivityType) changeType(scannedActivityType)
    if (result.accountId && accounts.some(value => value.id === result.accountId)) setAccountId(result.accountId)
    if (result.instrumentId && instruments.some(value => value.id === result.instrumentId)) setInstrumentId(result.instrumentId)
    if (result.tradeDate) setTradeDate(result.tradeDate)
    const scannedUnits = showsUnits(appliedType) ? result.units : null
    const scannedUnitPrice = showsUnitPrice(appliedType) ? result.unitPrice : null
    if (scannedUnits != null) setUnits(String(scannedUnits))
    if (scannedUnitPrice != null) setUnitPrice(Number(scannedUnitPrice).toFixed(2))
    if (result.cashAmount != null) setCashAmount(Number(result.cashAmount).toFixed(2))
    if (showsFeesAndTaxes(appliedType)) {
      if (result.fees != null) setFees(Number(result.fees).toFixed(2))
      if (result.taxes != null) setTaxes(Number(result.taxes).toFixed(2))
    }
    if (['Buy', 'Sell'].includes(appliedType)) {
      if (scannedUnits != null && scannedUnitPrice != null && result.cashAmount == null) {
        setCashAmount(fmtMoney(scannedUnits * scannedUnitPrice))
        setWorkedOutField('gross')
      } else if (scannedUnits != null && result.cashAmount != null && scannedUnitPrice == null) {
        setUnitPrice(fmtMoney(result.cashAmount / scannedUnits))
        setWorkedOutField('price')
      } else if (scannedUnitPrice != null && result.cashAmount != null && scannedUnits == null) {
        setUnits(fmtUnits(result.cashAmount / scannedUnitPrice))
        setWorkedOutField('units')
      } else {
        setWorkedOutField(null)
      }
    } else {
      setWorkedOutField(null)
    }
  }, [scanDraft, accounts, instruments])
  useEffect(() => {
    if (failedScanJob?.jobId !== activeScanJobId) return
    setScanError(failedScanJob.errorMessage)
    setIsScanning(false)
    trackedScanJobsRef.current.delete(failedScanJob.jobId)
    setActiveScanJobId(null)
  }, [failedScanJob, activeScanJobId])
  useEffect(() => {
    if (!activeScanJobId) return
    if (activeScanJobIds.includes(activeScanJobId)) {
      trackedScanJobsRef.current.add(activeScanJobId)
      return
    }
    if (scanDraft?.jobId === activeScanJobId || !trackedScanJobsRef.current.has(activeScanJobId)) return
    trackedScanJobsRef.current.delete(activeScanJobId)
    setIsScanning(false)
    setActiveScanJobId(null)
  }, [activeScanJobId, activeScanJobIds, scanDraft])
  const handleUnitsChange = (nextVal: string) => {
    if (trade && workedOutField === 'units') return
    setUnits(nextVal)
    setErrors(prev => ({ ...prev, units: '', form: '' }))
    if (!trade) return
    const u = positiveNumberOrUndefined(nextVal)
    const p = positiveNumberOrUndefined(unitPrice)
    const c = positiveNumberOrUndefined(cashAmount)

    if (workedOutField === 'gross') {
      if (!u) { setCashAmount(''); setWorkedOutField(null) }
      else if (p) setCashAmount(fmtMoney(u * p))
    } else if (workedOutField === 'price') {
      if (!u) { setUnitPrice(''); setWorkedOutField(null) }
      else if (c) setUnitPrice(fmtMoney(c / u))
    } else {
      if (u && p && !c) { setCashAmount(fmtMoney(u * p)); setWorkedOutField('gross') }
      else if (u && c && !p) { setUnitPrice(fmtMoney(c / u)); setWorkedOutField('price') }
      else if (u && p && c) { setCashAmount(fmtMoney(u * p)); setWorkedOutField('gross') }
    }
  }

  const handleUnitPriceChange = (nextVal: string) => {
    if (trade && workedOutField === 'price') return
    setUnitPrice(nextVal)
    setErrors(prev => ({ ...prev, unitPrice: '', form: '' }))
    if (!trade) return
    const p = positiveNumberOrUndefined(nextVal)
    const u = positiveNumberOrUndefined(units)
    const c = positiveNumberOrUndefined(cashAmount)

    if (workedOutField === 'gross') {
      if (!p) { setCashAmount(''); setWorkedOutField(null) }
      else if (u) setCashAmount(fmtMoney(u * p))
    } else if (workedOutField === 'units') {
      if (!p) { setUnits(''); setWorkedOutField(null) }
      else if (c) setUnits(fmtUnits(c / p))
    } else {
      if (p && u && !c) { setCashAmount(fmtMoney(u * p)); setWorkedOutField('gross') }
      else if (p && c && !u) { setUnits(fmtUnits(c / p)); setWorkedOutField('units') }
      else if (p && u && c) { setCashAmount(fmtMoney(u * p)); setWorkedOutField('gross') }
    }
  }

  const handleCashAmountChange = (nextVal: string) => {
    if (trade && workedOutField === 'gross') return
    setCashAmount(nextVal)
    setErrors(prev => ({ ...prev, cashAmount: '', form: '' }))
    if (!trade) return
    const c = positiveNumberOrUndefined(nextVal)
    const u = positiveNumberOrUndefined(units)
    const p = positiveNumberOrUndefined(unitPrice)

    if (workedOutField === 'price') {
      if (!c) { setUnitPrice(''); setWorkedOutField(null) }
      else if (u) setUnitPrice(fmtMoney(c / u))
    } else if (workedOutField === 'units') {
      if (!c) { setUnits(''); setWorkedOutField(null) }
      else if (p) setUnits(fmtUnits(c / p))
    } else {
      if (c && u && !p) { setUnitPrice(fmtMoney(c / u)); setWorkedOutField('price') }
      else if (c && p && !u) { setUnits(fmtUnits(c / p)); setWorkedOutField('units') }
      else if (c && u && p) { setUnitPrice(fmtMoney(c / u)); setWorkedOutField('price') }
    }
  }

  if (!accounts.length || !instruments.length) return <div><p className="text-sm text-muted-foreground">Add both an account and an investment before recording activity.</p><div className="mt-4 flex justify-end gap-2">{!accounts.length && <Button onClick={onNeedAccount}>Add account</Button>}{!instruments.length && <Button variant="tertiary" onClick={onNeedInstrument}>Add investment</Button>}</div></div>
  const needsUnits = !['Dividend', 'FeeTax'].includes(type)
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let numFields = 0
    if (numberOrUndefined(units) !== undefined) numFields++
    if (numberOrUndefined(unitPrice) !== undefined) numFields++
    if (numberOrUndefined(cashAmount) !== undefined) numFields++
    if (trade && numFields < 2) {
      const field = numberOrUndefined(units) === undefined
        ? 'units'
        : numberOrUndefined(unitPrice) === undefined
          ? 'unitPrice'
          : 'cashAmount'
      setErrors({ [field]: 'Enter any two of units, unit price, and gross amount; the missing value is calculated.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (type === 'Dividend' && numberOrUndefined(cashAmount) === undefined) {
      setErrors({ cashAmount: 'Gross dividend is required.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    const issue = validateActivityBalances(portfolio, {
      type,
      accountId,
      instrumentId,
      units: numberOrUndefined(units),
      unitPrice: numberOrUndefined(unitPrice),
      cashAmount: numberOrUndefined(cashAmount),
      fees: Number(fees || 0),
      taxes: Number(taxes || 0),
    }, initial, pendingActivities)
    if (issue) {
      setErrors({ [issue.field]: issue.message })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    setErrors({})
    void onSave({
      accountId, instrumentId, type, tradeDate,
      units: needsUnits ? numberOrUndefined(units) : undefined,
      unitPrice: trade ? numberOrUndefined(unitPrice) : undefined,
      cashAmount: numberOrUndefined(cashAmount),
      fees: showsFeesAndTaxes(type) ? Number(fees || 0) : 0,
      taxes: showsFeesAndTaxes(type) ? Number(taxes || 0) : 0,
    }).then(saved => {
      if (saved) clearScan()
    })
  }
  const feesLabelSuffix = selectedInstrument ? ` (${selectedInstrument.currency})` : ''
  return <form noValidate onSubmit={submit} className="space-y-4">
    {!initial && <>
      <ReceiptScanPicker
        isScanning={isScanning}
        showScanPicker={showScanPicker}
        setShowScanPicker={setShowScanPicker}
        scanFileInputRef={scanFileInputRef}
        scanGalleryInputRef={scanGalleryInputRef}
        handleScanReceipt={handleScan}
        setScanError={setScanError}
        label="Scan investment activity"
        scanningLabel="Scanning investment activity..."
      />
      <ReceiptScanStatus
        showScanBanner={showScanBanner}
        setShowScanBanner={setShowScanBanner}
        scanError={scanError}
        setScanError={setScanError}
        successMessage="Investment activity scanned — review fields below and edit as needed"
      />
    </>}
    <div className={formGridClass}>
      <Field label="Activity type" plain><CustomSelect value={type} onChange={v => changeType(v as InvestmentTransactionType)} options={activityTypes.map(t => ({ value: t.value, label: t.label }))} ariaLabel="Activity type" className="w-full" /></Field>
      <Field label="Trade date" plain><DatePicker value={tradeDate} onChange={setTradeDate} max={today()} className="w-full" /></Field>
      <Field label="Account" plain><CustomSelect value={accountId} onChange={v => setAccountId(v as string)} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
      <Field label="Investment" plain><CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: `${i.symbol} · ${i.name}` }))} ariaLabel="Investment" className="w-full" /></Field>
      {needsUnits && (
        <Field
          label="Units"
          error={errors.units}
          hint={trade && workedOutField === 'units' ? 'Calculated automatically' : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0000000001"
            value={units}
            readOnly={trade && workedOutField === 'units'}
            tabIndex={trade && workedOutField === 'units' ? -1 : undefined}
            onChange={event => handleUnitsChange(event.target.value)}
          />
        </Field>
      )}
      {trade && (
        <Field
          label={`Unit price (${selectedInstrument?.currency})`}
          error={errors.unitPrice}
          hint={workedOutField === 'price' ? 'Calculated automatically' : undefined}
        >
          <SmartAmountInput
            min="0"
            value={unitPrice}
            readOnly={workedOutField === 'price'}
            tabIndex={workedOutField === 'price' ? -1 : undefined}
            onChange={event => handleUnitPriceChange(maskCurrencyInput(event.target.value, unitPrice))}
          />
        </Field>
      )}
      <Field
        className={type === 'FeeTax' ? 'sm:col-span-2' : ''}
        required={type === 'Dividend'}
        label={`${type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} (${selectedInstrument?.currency})`}
        error={errors.cashAmount}
        hint={trade && workedOutField === 'gross' ? 'Calculated automatically' : undefined}
      >
        <SmartAmountInput
          min={type === 'Dividend' ? '0.0000000001' : '0'}
          value={cashAmount}
          readOnly={trade && workedOutField === 'gross'}
          tabIndex={trade && workedOutField === 'gross' ? -1 : undefined}
          onChange={event => handleCashAmountChange(maskCurrencyInput(event.target.value, cashAmount))}
        />
      </Field>
      {type !== 'FeeTax' && <>
        <Field label={`Fees${feesLabelSuffix}`}><SmartAmountInput min="0" value={fees} onChange={event => setFees(maskCurrencyInput(event.target.value, fees))} /></Field>
        <Field className={type === 'Dividend' ? 'sm:col-span-2' : ''} label={`Taxes${feesLabelSuffix}`}><SmartAmountInput min="0" value={taxes} onChange={event => setTaxes(maskCurrencyInput(event.target.value, taxes))} /></Field>
      </>}
    </div>
    {trade && <p className="text-xs text-muted-foreground">Fill any two of units, unit price, and gross amount — the third is worked out for you.</p>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <p className="text-xs text-muted-foreground">Amounts use {selectedInstrument.currency}; reports use {portfolio?.appCurrency} at that date's rate. Convert cash in "Manage cash" before trading.</p>}
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel="Save activity" />
  </form>
}
