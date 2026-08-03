import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import type {
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentTransactionType,
} from '../../types'
import type { InvestmentActivityScanResult } from '../../lib/api'
import * as api from '../../lib/api'
import { FALLBACK_CURRENCY } from '../../lib/currency'
import type { InstrumentSearchResult } from '../../lib/api/investments'
import {
  availableActivityCash,
  availableActivityUnits,
  availableCash,
  validateActivityBalances,
  validateCashFlowBalances,
} from '../../lib/investmentValidation'

const marketAvailability = (result: InstrumentSearchResult) =>
  result.availability ?? (result.availableOnBasic ? 'Available' : 'Unavailable')
import { getErrorMessage } from '../../lib/errors'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
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
const formGridWideClass = 'grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4'

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
    labelClassName="h-4 truncate leading-4"
    hintClassName="text-[10px] font-normal"
  >
    {children}
  </FormField>
)

const money = (value: number, currency: string) =>
  formatCurrencyVal(value, currency)

const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)

const FormActions = ({ busy, onCancel, submitLabel, disabled }: { busy: boolean; onCancel: () => void; submitLabel: string; disabled?: boolean }) => (
  <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button type="submit" disabled={busy || disabled}>{busy && <Loader2 className="size-4 animate-spin" />} {submitLabel}</Button>
  </div>
)

export const AccountForm = ({ appCurrency = FALLBACK_CURRENCY, existingAccounts = [], busy, onCancel, onSave }: { appCurrency?: string; existingAccounts?: { name: string }[]; busy: boolean; onCancel: () => void; onSave: (value: api.AccountMutation) => Promise<boolean> }) => {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(appCurrency)
  const [errors, setErrors] = useState<Record<string, string>>({})
  return <form noValidate className="space-y-4" onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Account name is required.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    // Mirrors the unique (UserId, Name) index behind the API's 409. Investment
    // saves go through the offline queue, so without this check the rejection
    // only reaches the user much later, detached from this form.
    if (existingAccounts.some(account => account.name.trim() === name.trim())) {
      setErrors({ name: 'An investment account with this name already exists.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    setErrors({})
    void onSave({ name, baseCurrency: currency }) 
  }}>
    <div className={formGridClass}>
      <Field label="Account name" required error={errors.name}><Input maxLength={120} value={name} onChange={event => { setName(event.target.value); setErrors({}) }} placeholder="e.g. Moomoo" /></Field>
      <Field label="Base currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="Base currency" /></Field>
    </div>
    <p className="text-[10px] text-muted-foreground">A display name only — no broker login is stored.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel="Add account" />
  </form>
}

export const InstrumentForm = ({ busy, offline, existingInstruments = [], onCancel, onSave }: { busy: boolean; offline: boolean; existingInstruments?: { symbol: string; providerMic?: string; marketDataReference?: { providerId: string; externalId: string } }[]; onCancel: () => void; onSave: (value: api.InstrumentMutation) => Promise<boolean> }) => {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<InstrumentSearchResult[]>([])
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<InstrumentSearchResult | null>(null)
  useEffect(() => {
    if (offline || query.trim().length < 3) {
      setResults([])
      setMessage(query.trim().length > 0 && query.trim().length < 3 ? 'Enter at least three characters.' : '')
      return
    }
    const abort = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      api.searchInvestmentInstruments(query.trim(), abort.signal)
        .then(response => { setResults(response.results); setMessage(response.message ?? '') })
        .catch(error => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof Error ? error.message : 'Search failed.')
        })
        .finally(() => { if (!abort.signal.aborted) setSearching(false) })
    }, 600)
    return () => { window.clearTimeout(timer); abort.abort() }
  }, [query, offline])
  // Prefer the provider-neutral identity; legacy fields remain only for the staggered rollout.
  const alreadySaved = Boolean(selected) && existingInstruments.some(instrument =>
    instrument.marketDataReference && selected?.marketDataReference
      ? instrument.marketDataReference.providerId === selected.marketDataReference.providerId &&
        instrument.marketDataReference.externalId === selected.marketDataReference.externalId
      : instrument.symbol === selected?.symbol && (instrument.providerMic ?? '') === (selected?.mic ?? ''))
  const selectedUnavailable = selected ? marketAvailability(selected) === 'Unavailable' : false
  return <div className="space-y-4">
    <>
      <Field label="Symbol or company / fund name"><span className="relative block"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search at least 3 characters" className="pl-9" />{searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />}</span></Field>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {selected ? (
        <div className="rounded-xl border border-blue-500 bg-blue-500/5 p-3">
          <div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm">{selected.symbol} · {selected.name}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{[selected.exchange, selected.mic, selected.currency, selected.country].filter(Boolean).join(' · ')}</span></span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button></div>
        </div>
      ) : <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
        {results.map(result => <Button type="button" variant="unstyled" key={`${result.symbol}-${result.mic ?? result.exchange}`} onClick={() => setSelected(result)} className="block w-full cursor-pointer rounded-xl border border-border/50 p-3 text-left transition-colors hover:bg-muted/30">
          <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-foreground">{result.symbol}</strong><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">{result.type}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${marketAvailability(result) === 'Available' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{marketAvailability(result) === 'Available' ? 'Market data available' : marketAvailability(result) === 'Unavailable' ? 'Market data unavailable' : 'Availability not confirmed'}</span></span>
          <span className="mt-1 block text-xs text-muted-foreground">{result.name}</span>
          <span className="mt-1 block text-[10px] text-muted-foreground">{[result.exchange, result.mic, result.currency, result.country].filter(Boolean).join(' · ')}</span>
          {result.availabilityMessage && <span className="mt-1 block text-[10px] text-muted-foreground">{result.availabilityMessage}</span>}
        </Button>)}
      </div>}
      {alreadySaved && <p role="alert" className="text-xs font-semibold text-destructive">This investment is already saved. Pick a different one, or record activity against the existing entry.</p>}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/40 bg-card py-3">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy || !selected || selectedUnavailable || alreadySaved} onClick={() => selected && !selectedUnavailable && !alreadySaved && void onSave({ symbol: selected.symbol, name: selected.name, type: selected.type, currency: selected.currency, exchange: selected.exchange, mic: selected.mic, country: selected.country, providerSymbol: selected.symbol, providerMic: selected.mic, marketDataReference: selected.marketDataReference, isCustom: false })}>{busy && <Loader2 className="size-4 animate-spin" />} Save investment</Button>
      </div>
    </>
  </div>
}

export const ActivityForm = ({ portfolio, initial, pendingActivities, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount, onNeedInstrument }: {
  portfolio: InvestmentPortfolio | null
  initial: InvestmentActivity | null
  pendingActivities: InvestmentActivity[]
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
  // "Enter any two of units, unit price, gross; the third is derived" (gross =
  // units x price). We track the two most recently edited fields and only ever
  // recompute the remaining one, so no user-entered value is clobbered and there
  // is no derivation loop. Prefilled values on an edit are left alone until the
  // user has edited at least two of the three fields.
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
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    setShowScanBanner(true)
    const result = scanDraft.result
    const scannedActivityType = activityTypes.find(value => value.value === result.type)?.value
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
  if (!accounts.length || !instruments.length) return <div><p className="text-sm text-muted-foreground">Add both an account and an investment before recording activity.</p><div className="mt-4 flex gap-2">{!accounts.length && <Button onClick={onNeedAccount}>Add account</Button>}{!instruments.length && <Button variant="ghost" onClick={onNeedInstrument}>Add investment</Button>}</div></div>
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
    // Cash and units are checked before queueing, so an impossible record is never
    // sent and the reason lands on the field that caused it.
    const issue = validateActivityBalances(portfolio, {
      type,
      accountId,
      instrumentId,
      units: numberOrUndefined(units),
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
  const heldUnits = availableActivityUnits(portfolio, accountId, instrumentId, pendingActivities)
  const heldCash = selectedInstrument ? availableActivityCash(portfolio, accountId, selectedInstrument.currency, pendingActivities) : 0
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
    <div className={formGridWideClass}>
    <Field label="Activity type" plain><CustomSelect value={type} onChange={v => setType(v as InvestmentTransactionType)} options={activityTypes.map(t => ({ value: t.value, label: t.label }))} ariaLabel="Activity type" className="w-full" /></Field>
    <Field label="Account" plain><CustomSelect value={accountId} onChange={v => setAccountId(v as string)} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
    <Field label="Investment" plain><CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: `${i.symbol} · ${i.name}` }))} ariaLabel="Investment" className="w-full" /></Field>
    <Field label="Trade date" plain><DatePicker value={tradeDate} onChange={setTradeDate} max={today()} className="w-full" /></Field>
    {needsUnits && <Field label="Units" error={errors.units} hint={type === 'Sell' ? `${number(heldUnits, 8)} units held` : undefined}><Input type="number" min="0" step="0.0000000001" value={units} onChange={event => { noteEdit('units'); setUnits(event.target.value); setErrors(prev => ({ ...prev, units: '', form: '' })) }} /></Field>}
    {trade && <Field label={`Unit price (${selectedInstrument?.currency})`} error={errors.unitPrice}><Input type="number" min="0" step="0.0000000001" value={unitPrice} onChange={event => { noteEdit('price'); setUnitPrice(event.target.value); setErrors(prev => ({ ...prev, unitPrice: '', form: '' })) }} /></Field>}
    <Field required={type === 'Dividend'} label={`${type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} (${selectedInstrument?.currency})`} error={errors.cashAmount} hint={['Buy', 'FeeTax'].includes(type) && selectedInstrument ? `${money(Math.max(heldCash, 0), selectedInstrument.currency)} cash available` : undefined}><Input type="number" min={type === 'Dividend' ? '0.0000000001' : '0'} step="0.0000000001" value={cashAmount} onChange={event => { noteEdit('gross'); setCashAmount(event.target.value); setErrors(prev => ({ ...prev, cashAmount: '', form: '' })) }} /></Field>
    {type !== 'FeeTax' && <>
      <Field label={`Fees${feesLabelSuffix}`}><Input type="number" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} /></Field>
      <Field label={`Taxes${feesLabelSuffix}`}><Input type="number" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} /></Field>
    </>}
    </div>
    {trade && <p className="text-[10px] text-muted-foreground">Fill any two of units, unit price, and gross amount — the third is worked out for you.</p>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <p className="text-[10px] text-muted-foreground">Amounts stay in {selectedInstrument.currency} and are reported in {portfolio?.appCurrency} at that date's market rate. Use "Manage cash" to convert cash into {selectedInstrument.currency} before trading.</p>}
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel="Save activity" />
  </form>
}

export const CashForm = ({ portfolio, initial, pendingCashFlows, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount }: {
  portfolio: InvestmentPortfolio | null
  initial?: InvestmentCashFlow | null
  pendingCashFlows?: InvestmentCashFlow[]
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
  const [currency, setCurrency] = useState(initial?.currency ?? accounts[0]?.baseCurrency ?? portfolio?.appCurrency ?? FALLBACK_CURRENCY)
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
  if (!accounts.length) return <div><p className="text-sm text-muted-foreground">Add an investment account before recording cash.</p><div className="mt-4"><Button onClick={onNeedAccount}>Add account</Button></div></div>
  const heldCash = availableCash(portfolio, accountId, currency) + (pendingCashFlows ?? [])
    .filter(flow => flow.accountId === accountId && flow.currency.toUpperCase() === currency.toUpperCase() && flow.id !== initial?.id)
    .reduce((total, flow) => total + (flow.type === 'Deposit' ? Math.abs(flow.amount) : flow.type === 'Withdrawal' ? -Math.abs(flow.amount) : -Math.abs(flow.amount)), 0)
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
    // Withdrawals and conversions can only spend cash the account actually holds.
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
          <Field label="From amount" required error={errors.amount} hint={`${money(Math.max(heldCash, 0), currency.toUpperCase())} available`}><Input type="number" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} /></Field>
          <Field label="From currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="From currency" /></Field>
          <Field label="To amount" required error={errors.toAmount}><Input type="number" min="0.0000000001" step="0.0000000001" value={toAmount} onChange={event => { setToAmount(event.target.value); setErrors(prev => ({ ...prev, toAmount: '' })) }} /></Field>
          <Field label="To currency" required error={errors.toCurrency} plain><CurrencySelect value={toCurrency} onChange={value => { setToCurrency(value); setErrors(prev => ({ ...prev, toCurrency: '' })) }} className="w-full" ariaLabel="To currency" /></Field>
        </>
      ) : (
        <>
          <Field label={`Amount (${currency})`} required error={errors.amount} hint={type === 'Withdrawal' ? `${money(Math.max(heldCash, 0), currency.toUpperCase())} available` : undefined}><Input type="number" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} /></Field>
          <Field label="Currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="Cash currency" /></Field>
        </>
      )}
      <Field label="Date" plain><DatePicker value={date} onChange={setDate} max={today()} className="w-full" /></Field>
    </div>
    <p className="text-[10px] text-muted-foreground">For money moved in or out of the broker account itself, and for converting between currencies before a trade or after a sale. Buys, sells, dividends, and fees adjust cash on their own.</p>
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel={initial ? 'Save changes' : type === 'Conversion' ? 'Record conversion' : type === 'Withdrawal' ? 'Record withdrawal' : 'Record deposit'} disabled={!accountId} />
  </form>
}
