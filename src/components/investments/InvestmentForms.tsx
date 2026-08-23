import React, { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import * as api from '../../lib/api'
import type { InstrumentSearchResult } from '../../lib/api/investments'
import { Button } from '../ui/Button'
import { CurrencySelect } from '../ui/CurrencySelect'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { ModalActions } from '../ui/ModalActions'
import { focusFirstInvalidField } from '../ui/formValidation'

export { ActivityForm } from './ActivityForm'
export { CashForm } from './CashForm'

const marketAvailability = (result: InstrumentSearchResult) =>
  result.availability ?? (result.availableOnBasic ? 'Available' : 'Unavailable')

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
    hintClassName="text-[10px] font-normal"
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

export const AccountForm = ({ appCurrency, existingAccounts = [], busy, onCancel, onSave }: { appCurrency?: string; existingAccounts?: { name: string }[]; busy: boolean; onCancel: () => void; onSave: (value: api.AccountMutation) => Promise<boolean> }) => {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(appCurrency ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  return <form noValidate className="space-y-4" onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setErrors({ name: 'Account name is required.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (!currency) {
      setErrors({ currency: 'Choose a base currency.' })
      focusFirstInvalidField(event.currentTarget)
      return
    }
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
      <Field label="Base currency" required error={errors.currency}><CurrencySelect value={currency} onChange={value => { setCurrency(value); setErrors(previous => ({ ...previous, currency: '' })) }} className="w-full" ariaLabel="Base currency" required /></Field>
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
