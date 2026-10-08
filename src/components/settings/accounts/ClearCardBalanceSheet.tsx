import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CreditCard } from 'lucide-react'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { ModalActions } from '../../ui/ModalActions'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import type { LedgerAccount, Transaction, TransactionCategory } from '../../../types'
import {
  cardOwed,
  cardPaymentSources,
  defaultRebateCategory,
  planCardSettlement,
  type CardRemainder,
} from '../../../lib/creditCards'
import { roundMoney } from '../../../lib/money'
import { formatCurrencyVal, maskCurrencyInput } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { getTodayDateString } from '../../ledger/transaction-form/transactionFormMapping'

interface ClearCardBalanceSheetProps {
  card: LedgerAccount | null
  accounts: LedgerAccount[]
  categories: TransactionCategory[]
  currency: string
  onClose: () => void
  onConfirm: (transactions: Array<Omit<Transaction, 'id'>>) => void
}

const REMAINDER_OPTIONS: ReadonlyArray<{ value: CardRemainder; label: string; detail: string }> = [
  { value: 'rebate', label: 'The bank took it off', detail: 'A rebate or cashback. The card is cleared.' },
  { value: 'owed', label: 'I still owe it', detail: 'A part payment. The rest stays on the card.' },
]

export function ClearCardBalanceSheet({
  card,
  accounts,
  categories,
  currency,
  onClose,
  onConfirm,
}: ClearCardBalanceSheetProps) {
  const [sourceId, setSourceId] = useState('')
  const [amount, setAmount] = useState('')
  const [remainder, setRemainder] = useState<CardRemainder | null>(null)
  const [rebateCategory, setRebateCategory] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const sources = useMemo(() => (card ? cardPaymentSources(card, accounts) : []), [accounts, card])
  const rebateCategories = useMemo(
    () => categories.filter(category =>
      !category.isPendingDelete
      && category.type !== 'outflow'
      && !['transfer', 'adjustment'].includes(category.name.trim().toLowerCase())),
    [categories],
  )
  const owed = card ? cardOwed(card) : 0

  useEffect(() => {
    if (!card) return
    setSourceId(sources[0]?.id ?? '')
    setAmount(owed > 0 ? owed.toFixed(2) : '')
    setRemainder(null)
    setRebateCategory(defaultRebateCategory(categories))
    setShowErrors(false)
    // Reset only when a different card opens; live balance updates must not wipe what was typed.
  }, [card?.id])

  if (!card) return null

  const source = sources.find(candidate => candidate.id === sourceId)
  const parsedAmount = amount.trim() ? Number(amount) : Number.NaN
  const rest = Number.isFinite(parsedAmount) ? roundMoney(owed - parsedAmount) : 0
  const plan = planCardSettlement({
    card,
    source,
    amountPaid: parsedAmount,
    remainder,
    rebateCategory,
    date: getTodayDateString(),
  })
  const errorFor = (field: 'source' | 'amount' | 'remainder' | 'category') =>
    !plan.ok && plan.field === field && (showErrors || field === 'amount' && Number.isFinite(parsedAmount))
      ? plan.message
      : undefined
  const money = (value: number) => formatCurrencyVal(value, currency)
  const willClear = plan.ok && plan.stillOwed === 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!plan.ok) {
      setShowErrors(true)
      return
    }
    onConfirm(plan.transactions)
    onClose()
  }

  return (
    <BottomSheet
      isOpen
      title="Clear card balance"
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      footer={(
        <ModalActions>
          <Button variant="secondary" type="button" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button variant="primary" type="submit" form="clear-card-balance-form" disabled={sources.length === 0} className="rounded-xl shadow-md">
            {remainder === 'owed' && rest > 0 ? 'Record payment' : 'Clear balance'}
          </Button>
        </ModalActions>
      )}
    >
      <form id="clear-card-balance-form" noValidate onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl border ${getCategoryBadgeClass(card.bucket)}`} aria-hidden="true">
            <CreditCard className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-xs font-bold text-foreground">{card.name}</p>
            <p className="text-xs text-muted-foreground">
              Owed today <span className="font-semibold text-foreground">{money(owed)}</span>
            </p>
          </div>
        </div>

        {sources.length === 0 ? (
          <p role="alert" className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
            Add an account to Essentials or Rewards to pay this card from. A payment out of Stability or Growth goes through the ledger form.
          </p>
        ) : (
          <div className="space-y-3.5">
            <FormField label="Pay from" required error={errorFor('source')} hint="Only Essentials and Rewards accounts are listed.">
              <CustomSelect
                value={sourceId}
                onChange={setSourceId}
                options={sources.map(option => ({
                  value: option.id,
                  label: option.bucket === card.bucket ? option.name : `${option.name} (${option.bucket})`,
                  badge: money(option.remaining),
                }))}
                ariaLabel="Account the payment comes from"
                className="w-full"
              />
            </FormField>

            <FormField
              label={`Amount paid (${currency})`}
              required
              error={errorFor('amount')}
              hint="What left your account. Lower it if the bank took some off."
            >
              <SmartAmountInput
                value={amount}
                onChange={event => setAmount(maskCurrencyInput(event.target.value, amount))}
                placeholder={owed.toFixed(2)}
              />
            </FormField>

            {rest > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0 && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
                <p id="card-remainder-label" className="text-sm font-semibold text-foreground">
                  What about the other {money(rest)}?
                </p>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="card-remainder-label">
                  {REMAINDER_OPTIONS.map(option => {
                    const selected = remainder === option.value
                    return (
                      <Button
                        key={option.value}
                        variant="tertiary"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRemainder(option.value)}
                        className={`flex h-auto w-full items-start justify-start gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                          selected
                            ? 'border-primary/60 bg-primary/10 hover:bg-primary/10'
                            : 'border-border/60 bg-card/60 hover:bg-muted/40'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-border'}`}
                        >
                          {selected && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        <span className="min-w-0 space-y-0.5">
                          <span className="block text-xs font-semibold text-foreground">{option.label}</span>
                          <span className="block whitespace-normal text-xs font-normal text-muted-foreground">{option.detail}</span>
                        </span>
                      </Button>
                    )
                  })}
                </div>
                {errorFor('remainder') && <p role="alert" className="text-xs text-destructive">{errorFor('remainder')}</p>}

                {remainder === 'rebate' && (
                  <FormField
                    label="Record the rebate as"
                    required
                    error={errorFor('category')}
                    hint={rebateCategories.length === 0
                      ? 'Add an inflow category in Categories & Limits first.'
                      : `Adds ${money(rest)} back to ${card.bucket} and shows in your reports.`}
                  >
                    <CustomSelect
                      value={rebateCategory}
                      onChange={setRebateCategory}
                      options={rebateCategories.map(category => ({ value: category.name, label: category.name }))}
                      placeholder="Choose a category"
                      ariaLabel="Rebate category"
                      className="w-full"
                    />
                  </FormField>
                )}
              </div>
            )}

            {plan.ok && source && (
              <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                <dl className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="min-w-0 truncate text-muted-foreground">{source.name}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-foreground">
                    {money(source.remaining)}
                    <ArrowRight className="size-3 text-muted-foreground" aria-label="becomes" />
                    {money(roundMoney(source.remaining - parsedAmount))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="min-w-0 truncate text-muted-foreground">{card.name} owes</dt>
                  <dd className="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-foreground">
                    {money(owed)}
                    <ArrowRight className="size-3 text-muted-foreground" aria-label="becomes" />
                    {money(plan.stillOwed)}
                  </dd>
                </div>
                {plan.rebate > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="min-w-0 truncate text-muted-foreground">Rebate · {rebateCategory}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-foreground">+{money(plan.rebate)}</dd>
                  </div>
                )}
                </dl>
                <p className="pt-1 text-muted-foreground">
                  {willClear ? 'The card will be fully paid off. ' : ''}Paying a card moves money between your accounts, so it is not counted as spending again.
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
