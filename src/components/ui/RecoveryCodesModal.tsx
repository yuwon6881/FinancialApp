import { Checkbox } from './Checkbox'
import { Button } from './Button'
import React, { useState } from 'react'
import { KeyRound, Copy, CheckCircle2 } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

interface RecoveryCodesModalProps {
  isOpen: boolean
  codes: string[]
  onAcknowledge: () => void
}

// Shown exactly once right after 2FA is enabled (or codes are regenerated) -- these codes are
// never retrievable again, only their hashes are stored server-side, so the user must save them
// now or lose access to their account if they lose their authenticator device.
export const RecoveryCodesModal: React.FC<RecoveryCodesModalProps> = ({ isOpen, codes, onAcknowledge }) => {
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail (permissions, insecure context) -- the codes are still
      // visible on screen to copy manually, so this is non-fatal.
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => undefined}
      maxWidthClassName="max-w-sm"
      title={
        <div className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <KeyRound className="size-5" />
          </span>
          <span>Save your recovery codes</span>
        </div>
      }
      footer={
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-0.5 size-3.5 accent-blue-600 cursor-pointer"
            />
            I've saved these codes somewhere safe.
          </label>
          <Button variant="tertiary"
            type="button"
            disabled={!acknowledged}
            onClick={onAcknowledge}
            className="press-scale w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each code can be used once to sign in if you lose access to your authenticator app.
          They won't be shown again.
        </p>
        <div className="grid grid-cols-2 gap-2 bg-muted/20 border border-border/40 rounded-xl p-3 font-mono text-xs">
          {codes.map(code => (
            <div key={code} className="text-foreground text-center py-1">{code}</div>
          ))}
        </div>
        <Button variant="tertiary"
          type="button"
          onClick={handleCopyAll}
          className="press-scale w-full inline-flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition cursor-pointer"
        >
          {copied ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy all codes'}
        </Button>
      </div>
    </BottomSheet>
  )
}
