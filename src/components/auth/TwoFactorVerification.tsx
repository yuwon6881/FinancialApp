import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { AuthShell, AuthCard, AuthHeader } from '../ui/AuthLayout'
import { AlertBanner } from '../ui/AlertBanner'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

export interface TwoFactorVerificationProps {
  error: string | null
  errors: Record<string, string>
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  twoFactorCode: string
  setTwoFactorCode: (value: string) => void
  twoFactorLoading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  onBackToLogin: () => void
}

export const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  error,
  errors,
  setErrors,
  twoFactorCode,
  setTwoFactorCode,
  twoFactorLoading,
  onSubmit,
  onBackToLogin,
}) => {
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={<span className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10"><ShieldCheck className="size-6 text-blue-500" /></span>}
          title="Two-factor verification"
          description="Enter the code from your authenticator app, or use one of your recovery codes."
        />

        {error && (
          <AlertBanner variant="error">{error}</AlertBanner>
        )}

        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Verification code"
            required
            error={errors.twoFactorCode}
            labelClassName="uppercase tracking-wider"
          >
            <Input
              type="text"
              inputMode="numeric"
              autoFocus
              disabled={twoFactorLoading}
              placeholder="123456"
              value={twoFactorCode}
              onChange={e => {
                setTwoFactorCode(e.target.value)
                if (errors.twoFactorCode) setErrors(previous => ({ ...previous, twoFactorCode: '' }))
              }}
              autoComplete="one-time-code"
              className="text-center tracking-[0.3em]"
            />
          </FormField>

          <Button
            type="submit"
            size="lg"
            disabled={twoFactorLoading}
            className="w-full rounded-xl py-3 shadow-lg shadow-primary/15"
          >
            {twoFactorLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              'Verify'
            )}
          </Button>

          <Button
            type="button"
            variant="unstyled"
            onClick={onBackToLogin}
            className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            Back to login
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  )
}
