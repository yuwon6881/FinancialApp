import React, { useEffect, useState } from 'react'
import { Mail, CheckCircle2, Trash2 } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'

interface EmailSectionProps {
  hideSensitive: boolean
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

export const EmailSection: React.FC<EmailSectionProps> = ({ hideSensitive, onToast }) => {
  const [email, setEmail] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [emailInput, setEmailInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const loadStatus = async () => {
    try {
      const status = await api.getTwoFactorStatus()
      setEmail(status.email)
      setVerified(status.emailVerified)
      setAwaitingCode(Boolean(status.email) && !status.emailVerified)
    } catch (err) {
      console.error(err)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleBindEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hideSensitive || !emailInput.trim()) return
    setBusy(true)
    try {
      await api.bindEmail(emailInput.trim())
      setEmail(emailInput.trim())
      setVerified(false)
      setAwaitingCode(true)
      setResendCooldown(60)
      onToast?.('Verification code sent to your email.', 'Check your inbox', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Failed to send verification code.', 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeInput.trim()) return
    setBusy(true)
    try {
      const result = await api.verifyEmail(codeInput.trim())
      if (result.verified) {
        setVerified(true)
        setAwaitingCode(false)
        setCodeInput('')
        onToast?.('Email verified.', 'Success', 'success')
      } else {
        onToast?.(result.message || 'Incorrect code.', 'Error', 'error')
      }
    } catch (err: any) {
      onToast?.(err.message || 'Failed to verify code.', 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await api.resendEmailCode()
      setResendCooldown(60)
      onToast?.('Verification code resent.', 'Check your inbox', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Failed to resend code.', 'Error', 'error')
    }
  }

  const handleUnbind = async () => {
    if (hideSensitive) return
    try {
      await api.unbindEmail()
      setEmail(null)
      setVerified(false)
      setAwaitingCode(false)
      setEmailInput('')
      onToast?.('Email removed.', 'Removed', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Failed to remove email.', 'Error', 'error')
    }
  }

  if (!loaded) return null

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
        <Mail className="size-5 text-blue-500 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Email</h3>
          <p className="text-[11px] text-muted-foreground">Bind a verified email address to this account.</p>
        </div>
      </div>

      {email && verified && (
        <div className="flex items-center justify-between gap-2 bg-muted/20 border border-border/40 px-3 py-2.5 rounded-xl text-xs">
          <span className="flex items-center gap-2 text-foreground font-semibold truncate">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span className="truncate">{email}</span>
          </span>
          <button
            type="button"
            onClick={handleUnbind}
            disabled={hideSensitive}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition shrink-0 disabled:opacity-40"
            title="Remove this email"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {email && awaitingCode && (
        <form onSubmit={handleVerifyCode} className="space-y-2.5">
          <p className="text-[11px] text-muted-foreground">Enter the code sent to <span className="font-semibold text-foreground">{email}</span>.</p>
          <input
            type="text"
            autoFocus
            required
            placeholder="123456"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            className="w-full px-3.5 py-2 text-sm text-center tracking-[0.3em] bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-muted/50 disabled:opacity-40 transition cursor-pointer"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {busy ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      )}

      {!email && (
        <form onSubmit={handleBindEmail} className="space-y-2.5">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            disabled={hideSensitive}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={busy || hideSensitive}
            className="press-scale w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
          >
            {busy ? 'Sending...' : 'Send verification code'}
          </button>
        </form>
      )}
    </section>
  )
}
