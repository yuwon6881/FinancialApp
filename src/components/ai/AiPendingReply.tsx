import type { LedgerAccount } from '../../types'
import type { AiPendingReply as PendingReply } from './useAiTurnStream'
import { AiMessageContent } from './AiMessageContent'

// The assistant bubble for the turn in flight: what it is looking up, then its reply as it
// streams. The finished answer replaces this bubble, so its text is never the record.
export function AiPendingReply({ reply, accounts }: { reply: PendingReply; accounts: LedgerAccount[] }) {
  return (
    <div className="flex justify-start" data-testid="ai-pending-reply">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-xl border border-border/50 bg-card px-3 py-2 text-xs leading-relaxed text-foreground shadow-xs">
        {reply.text
          ? <AiMessageContent content={reply.text} accounts={accounts} role="assistant" />
          : <span className="text-muted-foreground">{reply.status ? `${reply.status}…` : 'Thinking…'}</span>}
      </div>
    </div>
  )
}
