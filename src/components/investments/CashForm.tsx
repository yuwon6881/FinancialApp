import React, { useEffect, useRef, useState } from 'react'
import type {
  InvestmentCashFlow,
  InvestmentPortfolio,
} from '../../types'
import type { InvestmentActivityScanResult } from '../../lib/api'
import * as api from '../../lib/api'
import {
  type PendingInvestmentCashFlow,
  validateCashFlowBalances,
} from '../../lib/investmentValidation'
import { getErrorMessage } from '../../lib/errors'
import { Button } from '../ui/Button'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { ModalActions } from '../ui/ModalActions'
import { Loader2 } from 'lucide-react'
import { focusFirstInvalidField } from '../ui/formValidation'
import { ReceiptScanPicker } from '../ledger/transaction-form/ReceiptScanPicker'
import { ReceiptScanStatus } from '../ledger/transaction-form/ReceiptScanStatus'

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

export const CashForm = ({ portfolio, initial, pendingCashFlows, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount }: {
  portfolio: InvestmentPortfolio | null
  initial?: InvestmentCashFlow | null
  pendingCashFlows?: PendingInvestmentCashFlow[]
  busy: boolean
  scanDraft?: { jobId: string; result: InvestmentActivityScanResult } | null
  failedScanJob?: { jobId: string; errorMessage: string } | null
  activeScanJobIds?: string[]
  onScanStarted?: (scanId: string) => void
  onScanCleared?: (scanId: string) => void | Promise<void>
  onCancel: () => void
  onSave: (value: { accountId: string; currency: string; type: 'Deposit' | 'Withdrawal' | 'Conversion'; amount: number; date: string; toCurrency?: string; toAmount?: number }) => Promise<boolean>
  onNeedAccount: () => void
}) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [type, setType] = useState<'Deposit' | 'Withdrawal' | 'Conversion'>(initial?.type ?? 'Deposit')
  const [currency, setCurrency] = useState(initial?.currency ?? accounts[0]?.baseCurrency ?? portfolio?.appCurrency ?? '')
  const [amount, setAmount] = useState(initial?.amount ? String(Math.abs(initial.amount)) : '')
  const [toCurrency, setToCurrency] = useState(initial?.toCurrency ?? currency)
  const [toAmount, setToAmount] = useState(initial?.toAmount ? String(initial.toAmount) : '')
  const [date, setDate] = useState(initial?.date ?? today())
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
      setScanError(getErrorMessage(error, 'Could not scan this cash movement. Please try a clearer image.'))
      setIsScanning(false)
    } finally {
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }
  useEffect(() => {
    if (!scanDraft || appliedScanJobRef.current === scanDraft.jobId) return
    const result = scanDraft.result
    if (!result.type || !['Deposit', 'Withdrawal', 'Conversion'].includes(result.type)) return
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    setShowScanBanner(true)
    setType(result.type as 'Deposit' | 'Withdrawal' | 'Conversion')
    if (result.accountId && accounts.some(value => value.id === result.accountId)) setAccountId(result.accountId)
    if (result.currency) setCurrency(result.currency)
    if (result.cashAmount != null) setAmount(String(result.cashAmount))
    if (result.toCurrency) setToCurrency(result.toCurrency)
    if (result.toAmount != null) setToAmount(String(result.toAmount))
    if (result.tradeDate) setDate(result.tradeDate)
  }, [scanDraft, accounts])
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
  if (!accounts.length) return <div><p className="text-sm text-muted-foreground">Add an investment account before recording cash.</p><div className="mt-4 flex justify-end"><Button onClick={onNeedAccount}>Add account</Button></div></div>
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currency) {
      setErrors({ currency: 'Choose a currency.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (type === 'Conversion' && !toCurrency) {
      setErrors({ toCurrency: 'Choose the currency to receive.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (type === 'Conversion') {
      if (!(numberOrUndefined(amount)! > 0)) {
        setErrors({ amount: 'Enter a positive from amount.' })
        focusFirstInvalidField(event.currentTarget)
        return
      }
      if (!(numberOrUndefined(toAmount)! > 0)) {
        setErrors({ toAmount: 'Enter a positive to amount.' })
        focusFirstInvalidField(event.currentTarget)
        return
      }
    } else {
      if (!(numberOrUndefined(amount)! > 0)) {
        setErrors({ amount: 'Enter a positive amount.' })
        focusFirstInvalidField(event.currentTarget)
        return
      }
    }
    const issue = validateCashFlowBalances(portfolio, {
      accountId,
      type,
      currency: currency.toUpperCase(),
      amount: numberOrUndefined(amount),
      toCurrency: type === 'Conversion' ? toCurrency.toUpperCase() : undefined,
      toAmount: type === 'Conversion' ? numberOrUndefined(toAmount) : undefined,
    }, initial, pendingCashFlows)
    if (issue) {
      setErrors({ [issue.field]: issue.message })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    setErrors({})
    void onSave({
      accountId,
      currency: currency.toUpperCase(),
      type,
      amount: Number(amount || 0),
      date, 
      toCurrency: type === 'Conversion' ? toCurrency.toUpperCase() : undefined,
      toAmount: type === 'Conversion' ? Number(toAmount || 0) : undefined,
    }).then(saved => {
      if (saved) clearScan()
    })
  }
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
        label="Scan cash movement"
        scanningLabel="Scanning cash movement..."
      />
      <ReceiptScanStatus
        showScanBanner={showScanBanner}
        setShowScanBanner={setShowScanBanner}
        scanError={scanError}
        setScanError={setScanError}
        successMessage="Cash movement scanned — review fields below and edit as needed"
      />
    </>}
    <div className={formGridClass}>
      <Field label="Account" plain><CustomSelect value={accountId} onChange={v => { const id = v as string; setAccountId(id); const next = accounts.find(value => value.id === id); if (next) { setCurrency(next.baseCurrency); if (!initial) setToCurrency(next.baseCurrency) } }} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
      <Field label="Cash movement type" plain><CustomSelect value={type} onChange={v => setType(v as 'Deposit' | 'Withdrawal' | 'Conversion')} options={[{ value: 'Deposit', label: 'Deposit (cash in)' }, { value: 'Withdrawal', label: 'Withdrawal (cash out)' }, { value: 'Conversion', label: 'Convert currency' }]} ariaLabel="Cash movement type" className="w-full" /></Field>
      {type === 'Conversion' ? (
        <>
          <Field label="From amount" required error={errors.amount}><Input type="number" inputMode="decimal" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} /></Field>
          <Field label="From currency" required error={errors.currency}><CurrencySelect value={currency} onChange={value => { setCurrency(value); setErrors(previous => ({ ...previous, currency: '' })) }} className="w-full" ariaLabel="From currency" /></Field>
          <Field label="To amount" required error={errors.toAmount}><Input type="number" inputMode="decimal" min="0.0000000001" step="0.0000000001" value={toAmount} onChange={event => { setToAmount(event.target.value); setErrors(prev => ({ ...prev, toAmount: '' })) }} /></Field>
          <Field label="To currency" required error={errors.toCurrency} plain><CurrencySelect value={toCurrency} onChange={value => { setToCurrency(value); setErrors(prev => ({ ...prev, toCurrency: '' })) }} className="w-full" ariaLabel="To currency" /></Field>
        </>
      ) : (
        <>
          <Field label={`Amount (${currency})`} required error={errors.amount}><Input type="number" inputMode="decimal" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} /></Field>
          <Field label="Currency" required error={errors.currency}><CurrencySelect value={currency} onChange={value => { setCurrency(value); setErrors(previous => ({ ...previous, currency: '' })) }} className="w-full" ariaLabel="Cash currency" /></Field>
        </>
      )}
      <Field label="Date" plain className="sm:col-span-2"><DatePicker value={date} onChange={setDate} max={today()} className="w-full" /></Field>
    </div>
    <p className="text-xs text-muted-foreground">Use for deposits, withdrawals, and currency conversions. Trades, dividends, and fees adjust cash automatically.</p>
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel={initial ? 'Save changes' : type === 'Conversion' ? 'Record conversion' : type === 'Withdrawal' ? 'Record withdrawal' : 'Record deposit'} disabled={!accountId} />
  </form>
}
