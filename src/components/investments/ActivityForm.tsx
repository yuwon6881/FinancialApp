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
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { ModalActions } from '../ui/ModalActions'
import { Loader2 } from 'lucide-react'
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
    <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
    <Button type="submit" disabled={busy || disabled} className="rounded-xl shadow-md">{busy && <Loader2 className="size-4 animate-spin" />} {submitLabel}</Button>
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
  const [type, setType] = useState<InvestmentTransactionType>(initial?.type ?? 'Buy')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [instrumentId, setInstrumentId] = useState(initial?.instrumentId ?? instruments[0]?.id ?? '')
  const [tradeDate, setTradeDate] = useState(initial?.tradeDate ?? today())
  const [units, setUnits] = useState(initial?.units ? String(initial.units) : '')
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ? String(initial.unitPrice) : '')
  const [cashAmount, setCashAmount] = useState(initial?.cashAmount ? String(initial.cashAmount) : '')
  const [fees, setFees] = useState(String(initial?.fees ?? 0))
  const [taxes, setTaxes] = useState(String(initial?.taxes ?? 0))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(false)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [activeScanJobId, setActiveScanJobId] = useState<string | null>(null)
  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedScanJobRef = useRef<string | null>(null)
  const trackedScanJobsRef = useRef<Set<string>>(new Set())
  const selectedInstrument = instruments.find(value => value.id === instrumentId)

  const editOrder = useRef<Array<'units' | 'price' | 'gross'>>([])
  const noteEdit = (field: 'units' | 'price' | 'gross') => {
    editOrder.current = [field, ...editOrder.current.filter(value => value !== field)]
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
    const result = scanDraft.result
    const scannedActivityType = activityTypes.find(value => value.value === result.type)?.value
    if (result.type && !scannedActivityType) return
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    setShowScanBanner(true)
    if (scannedActivityType) setType(scannedActivityType)
    if (result.accountId && accounts.some(value => value.id === result.accountId)) setAccountId(result.accountId)
    if (result.instrumentId && instruments.some(value => value.id === result.instrumentId)) setInstrumentId(result.instrumentId)
    if (result.tradeDate) setTradeDate(result.tradeDate)
    if (result.units != null) setUnits(String(result.units))
    if (result.unitPrice != null) setUnitPrice(String(result.unitPrice))
    if (result.cashAmount != null) setCashAmount(String(result.cashAmount))
    if (result.fees != null) setFees(String(result.fees))
    if (result.taxes != null) setTaxes(String(result.taxes))
    const supplied = [
      result.units != null ? 'units' as const : null,
      result.unitPrice != null ? 'price' as const : null,
      result.cashAmount != null ? 'gross' as const : null,
    ].filter((value): value is 'units' | 'price' | 'gross' => value !== null)
    editOrder.current = supplied.length === 2 ? supplied : []
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
  useEffect(() => {
    if (!['Buy', 'Sell'].includes(type)) return
    const recent = editOrder.current.slice(0, 2)
    if (recent.length < 2) return
    const fmt = (value: number) => value.toFixed(6).replace(/\.?0+$/, '')
    const derive = (['units', 'price', 'gross'] as const).find(value => !recent.includes(value))!
    const u = numberOrUndefined(units)
    const p = numberOrUndefined(unitPrice)
    const c = numberOrUndefined(cashAmount)
    if (derive === 'gross' && u && p) setCashAmount(fmt(u * p))
    else if (derive === 'units' && c && p) setUnits(fmt(c / p))
    else if (derive === 'price' && c && u) setUnitPrice(fmt(c / u))
  }, [units, unitPrice, cashAmount, type])
  if (!accounts.length || !instruments.length) return <div><p className="text-sm text-muted-foreground">Add both an account and an investment before recording activity.</p><div className="mt-4 flex justify-end gap-2">{!accounts.length && <Button onClick={onNeedAccount}>Add account</Button>}{!instruments.length && <Button variant="ghost" onClick={onNeedInstrument}>Add investment</Button>}</div></div>
  const needsUnits = !['Dividend', 'FeeTax'].includes(type)
  const trade = ['Buy', 'Sell'].includes(type)
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
      units: numberOrUndefined(units), unitPrice: numberOrUndefined(unitPrice), cashAmount: numberOrUndefined(cashAmount),
      fees: Number(fees || 0), taxes: Number(taxes || 0),
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
      <Field label="Activity type" plain><CustomSelect value={type} onChange={v => setType(v as InvestmentTransactionType)} options={activityTypes.map(t => ({ value: t.value, label: t.label }))} ariaLabel="Activity type" className="w-full" /></Field>
      <Field label="Trade date" plain><DatePicker value={tradeDate} onChange={setTradeDate} max={today()} className="w-full" /></Field>
      <Field label="Account" plain><CustomSelect value={accountId} onChange={v => setAccountId(v as string)} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
      <Field label="Investment" plain><CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: `${i.symbol} · ${i.name}` }))} ariaLabel="Investment" className="w-full" /></Field>
      {needsUnits && <Field label="Units" error={errors.units}><Input type="number" inputMode="decimal" min="0" step="0.0000000001" value={units} onChange={event => { noteEdit('units'); setUnits(event.target.value); setErrors(prev => ({ ...prev, units: '', form: '' })) }} /></Field>}
      {trade && <Field label={`Unit price (${selectedInstrument?.currency})`} error={errors.unitPrice}><Input type="number" inputMode="decimal" min="0" step="0.0000000001" value={unitPrice} onChange={event => { noteEdit('price'); setUnitPrice(event.target.value); setErrors(prev => ({ ...prev, unitPrice: '', form: '' })) }} /></Field>}
      <Field className={type === 'FeeTax' ? 'sm:col-span-2' : ''} required={type === 'Dividend'} label={`${type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} (${selectedInstrument?.currency})`} error={errors.cashAmount}><Input type="number" inputMode="decimal" min={type === 'Dividend' ? '0.0000000001' : '0'} step="0.0000000001" value={cashAmount} onChange={event => { noteEdit('gross'); setCashAmount(event.target.value); setErrors(prev => ({ ...prev, cashAmount: '', form: '' })) }} /></Field>
      {type !== 'FeeTax' && <>
        <Field label={`Fees${feesLabelSuffix}`}><Input type="number" inputMode="decimal" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} /></Field>
        <Field className={type === 'Dividend' ? 'sm:col-span-2' : ''} label={`Taxes${feesLabelSuffix}`}><Input type="number" inputMode="decimal" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} /></Field>
      </>}
    </div>
    {trade && <p className="text-xs text-muted-foreground">Fill any two of units, unit price, and gross amount — the third is worked out for you.</p>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <p className="text-xs text-muted-foreground">Amounts use {selectedInstrument.currency}; reports use {portfolio?.appCurrency} at that date's rate. Convert cash in "Manage cash" before trading.</p>}
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel="Save activity" />
  </form>
}
