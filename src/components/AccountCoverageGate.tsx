import { useState } from 'react'
import { CheckCircle2, CircleAlert, LockKeyhole, Plus, RotateCcw, Wallet } from 'lucide-react'
import type { LedgerAccount } from '../types'
import { AuthCard, AuthHeader, AuthLoadingState, AuthShell } from './ui/AuthLayout'
import { AlertBanner } from './ui/AlertBanner'
import { Button } from './ui/Button'
import { AccountFormSheet } from './settings/accounts/AccountFormSheet'
import type { LedgerAccountInput } from '../app/financialData/accountActions'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { LEDGER_ACCOUNT_BUCKETS } from '../lib/ledgerAccountCoverage'

interface AccountCoverageGateProps {
  accounts: LedgerAccount[]
  currency: string
  loading: boolean
  error?: string | null
  hideSensitive: boolean
  formatSensitive: (value: number) => React.ReactNode
  onAddAccount: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRetry: () => void
}


export function AccountCoverageGate({
  accounts,
  currency,
  loading,
  error,
  hideSensitive,
  formatSensitive,
  onAddAccount,
  onUpdateAccount,
  onRetry,
}: AccountCoverageGateProps) {
  const [formBucket, setFormBucket] = useState<LedgerAccount['bucket'] | null>(null)
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null)

  if (loading && accounts.length === 0) return <AuthLoadingState label="Loading your account setup…" />

  const openForm = (bucket: LedgerAccount['bucket'], account: LedgerAccount | null = null) => {
    setEditingAccount(account)
    setFormBucket(bucket)
  }

  const closeForm = () => {
    setFormBucket(null)
    setEditingAccount(null)
  }

  return (
    <AuthShell>
      <AuthCard className="max-w-2xl">
        <AuthHeader
          icon={<span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10"><LockKeyhole className="size-6 text-accent-ink" /></span>}
          title="Set up your four accounts"
          description="Before you record money, tell us which account holds each budget bucket. This keeps every ledger entry traceable."
        />

        {error && (
          <div className="space-y-3">
            <AlertBanner variant="error">{error}</AlertBanner>
            <Button type="button" variant="secondary" className="w-full" onClick={onRetry}>
              <RotateCcw className="size-4" aria-hidden="true" /> Try again
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-accent-ink/20 bg-accent/15 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">You need one open account in every bucket.</p>
          <p className="mt-1">You can add more accounts later. Existing balances stay where they are; this setup only makes the account placement explicit.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {LEDGER_ACCOUNT_BUCKETS.map(bucket => {
            const rows = accounts.filter(account => account.bucket === bucket.name)
            const live = rows.filter(account => !account.isArchived)
            const complete = accounts.some(account => account.bucket === bucket.name && !account.isArchived && !account.isPendingSync)
            const pending = live.some(account => account.isPendingSync)
            return (
              <section key={bucket.name} className={complete ? 'rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4' : 'rounded-2xl border border-border/60 bg-muted/10 p-4'} aria-labelledby={'account-gate-' + bucket.name}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={'account-gate-' + bucket.name} className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <span className={'rounded-md border px-1.5 py-0.5 text-xs ' + getCategoryBadgeClass(bucket.name)}>{bucket.name}</span>
                      {complete && <CheckCircle2 className="size-4 text-emerald-500" aria-label="Complete" />}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">{bucket.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{live.length} open</span>
                </div>

                <div className="mt-3 space-y-2">
                  {rows.length === 0 && <p className="text-xs text-muted-foreground">No account yet.</p>}
                  {rows.map(account => (
                    <div key={account.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Wallet className="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                        <span className={'truncate text-xs font-semibold ' + (account.isArchived ? 'text-muted-foreground line-through' : 'text-foreground')}>{account.name}</span>
                        {account.isArchived && <span className="shrink-0 text-xs text-muted-foreground">Closed</span>}
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {hideSensitive ? 'Hidden' : formatSensitive(account.remaining)}
                      </span>
                    </div>
                  ))}
                </div>

                {pending && <p className="mt-2 text-xs font-semibold text-amber-500">Saving this account… waiting for server confirmation.</p>}
                {!complete && rows.some(account => account.isArchived) && (
                  <Button type="button" variant="secondary" size="sm" className="mt-3 min-h-11 w-full justify-center" onClick={() => openForm(bucket.name, rows.find(account => account.isArchived) ?? null)}>
                    Reopen an account
                  </Button>
                )}
                {!complete && !pending && (
                  <Button type="button" variant="secondary" size="sm" className="mt-3 min-h-11 w-full justify-center" onClick={() => openForm(bucket.name)}>
                    <Plus className="size-3.5" aria-hidden="true" /> Add account
                  </Button>
                )}
              </section>
            )
          })}
        </div>

        <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p>Once all four accounts are confirmed, the rest of the app will open. Closed accounts remain available for history.</p>
        </div>

        <AccountFormSheet
          isOpen={formBucket !== null}
          account={editingAccount}
          defaultBucket={formBucket ?? 'Essentials'}
          currency={currency}
          onClose={closeForm}
          onSave={async input => {
            if (editingAccount) await onUpdateAccount(editingAccount.id, { ...input, isArchived: false })
            else await onAddAccount({ ...input, bucket: formBucket ?? input.bucket, openingAmount: input.openingAmount ?? 0, isArchived: false })
          }}
        />
      </AuthCard>
    </AuthShell>
  )
}
