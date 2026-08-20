import { Fragment } from 'react'
import type { LedgerAccount } from '../../types'
import { tokenizeAccountMentions } from '../../lib/aiAccountMentions'

const AI_MARKDOWN_TOKEN = /(\*\*[^*\r\n]+?\*\*|__[^_\r\n]+?__)/g

type MentionStyle = 'composer' | 'user' | 'assistant'

const mentionClass: Record<MentionStyle, string> = {
  composer: 'rounded-sm bg-accent/20 font-black text-accent-ink',
  user: 'rounded-md border border-primary-foreground/30 bg-primary-foreground/15 px-1 py-0.5 font-black text-primary-foreground',
  assistant: 'rounded-md border border-accent/25 bg-accent/15 px-1 py-0.5 font-black text-accent-ink',
}

export function AccountMentionText({
  content,
  accounts,
  style,
}: {
  content: string
  accounts: LedgerAccount[]
  style: MentionStyle
}) {
  return (
    <>
      {tokenizeAccountMentions(content, accounts).map((part, index) => part.accountId ? (
        <span
          key={`${part.accountId}-${index}`}
          className={mentionClass[style]}
          data-account-mention={part.accountId}
          title={`Account: ${part.accountName}`}
        >
          {part.text}
        </span>
      ) : <Fragment key={index}>{part.text}</Fragment>)}
    </>
  )
}

/** Safe, intentionally small reply formatter: bold emphasis and known account references only. */
export function AiMessageContent({
  content,
  accounts,
  role,
}: {
  content: string
  accounts: LedgerAccount[]
  role: 'user' | 'assistant'
}) {
  if (role === 'user') return <AccountMentionText content={content} accounts={accounts} style="user" />

  return (
    <>
      {content.split(AI_MARKDOWN_TOKEN).map((part, index) => {
        const isBold = (part.startsWith('**') && part.endsWith('**'))
          || (part.startsWith('__') && part.endsWith('__'))
        const text = isBold ? part.slice(2, -2) : part
        return isBold
          ? <strong key={index}><AccountMentionText content={text} accounts={accounts} style="assistant" /></strong>
          : <Fragment key={index}><AccountMentionText content={text} accounts={accounts} style="assistant" /></Fragment>
      })}
    </>
  )
}
