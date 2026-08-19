import type { LedgerAccount } from '../types'

/**
 * "@account" mentions in the Ask AI composer.
 *
 * Typing a bank's name into a chat box tells the assistant a label; picking an account from this
 * list tells it a record. That is the whole point: the assistant is not allowed to guess between
 * two accounts, so without an exact reference the only honest thing it can do is ask which one you
 * meant -- which is what it did, and what made a two-record request take three turns and still
 * stage nothing.
 *
 * Everything here is pure so it can be tested without rendering, and the resolved id is still
 * re-validated server-side: this is a convenience for the person typing, never an authority.
 */

export interface AiAccountMention {
  token: string
  accountId: string
}

export interface AccountMentionQuery {
  /** Index of the "@" that opened this query. */
  start: number
  /** Text typed after the "@", used to filter the account list. */
  query: string
}

const MAX_MENTION_QUERY_LENGTH = 40
export const MAX_AI_ACCOUNT_MENTIONS = 6

const liveAccounts = (accounts: LedgerAccount[]) => accounts.filter(account => !account.isArchived)

/**
 * The mention query under the caret, or null when the caret is not inside one. A mention is only
 * open while the caret sits in the run of text directly after an "@" that follows whitespace or
 * the start of the field -- an email address or a "50@2" never opens the picker.
 */
export function findAccountMentionQuery(text: string, caret: number): AccountMentionQuery | null {
  const upToCaret = text.slice(0, caret)
  const at = upToCaret.lastIndexOf('@')
  if (at < 0) return null
  const before = at === 0 ? '' : upToCaret[at - 1]
  if (before && !/\s/.test(before)) return null
  const query = upToCaret.slice(at + 1)
  if (query.length > MAX_MENTION_QUERY_LENGTH) return null
  // A newline ends the mention; a space does not, because account names hold spaces.
  if (/[\r\n]/.test(query)) return null
  return { start: at, query }
}

/**
 * Whether the query has run past the account it names. Account names hold spaces, so a space
 * cannot end a mention on its own -- but once no account name continues past it, the mention is
 * finished and the picker must close. Without this, the space inserted after a pick left the list
 * open on the account just chosen, and the next Enter re-picked it instead of sending the message.
 */
export function isAccountMentionComplete(query: string, accounts: LedgerAccount[]): boolean {
  if (!/\s$/.test(query)) return false
  const needle = query.toLowerCase()
  return !liveAccounts(accounts).some(candidate => candidate.name.toLowerCase().startsWith(needle))
}

/**
 * Accounts offered for a mention query, best match first. An empty query lists everything so the
 * picker is useful the instant "@" is typed, which is how people discover the feature at all.
 */
export function matchAccountsForMention(
  accounts: LedgerAccount[],
  query: string,
  limit = 6,
): LedgerAccount[] {
  const needle = query.trim().toLowerCase()
  const live = liveAccounts(accounts)
  if (!needle) return live.slice(0, limit)
  const scored = live
    .map(account => {
      const name = account.name.toLowerCase()
      if (name === needle) return { account, score: 0 }
      if (name.startsWith(needle)) return { account, score: 1 }
      if (name.includes(needle)) return { account, score: 2 }
      if (account.bucket.toLowerCase().startsWith(needle)) return { account, score: 3 }
      return null
    })
    .filter((entry): entry is { account: LedgerAccount; score: number } => entry !== null)
    .sort((a, b) => a.score - b.score || a.account.name.localeCompare(b.account.name))
  return scored.slice(0, limit).map(entry => entry.account)
}

/** Replace the open mention query with the picked account, leaving the caret after a space. */
export function applyAccountMention(
  text: string,
  mention: AccountMentionQuery,
  account: LedgerAccount,
): { text: string; caret: number } {
  const head = text.slice(0, mention.start)
  const tail = text.slice(mention.start + 1 + mention.query.length)
  const inserted = `@${account.name} `
  return {
    text: `${head}${inserted}${tail.startsWith(' ') ? tail.slice(1) : tail}`,
    caret: head.length + inserted.length,
  }
}

/**
 * The accounts a message mentions, in the order they appear -- which is what makes "from @CIMB to
 * @RYT" directional. The longest matching account name wins so "@Maybank Savings" is not read as
 * "@Maybank".
 */
export function resolveAccountMentions(text: string, accounts: LedgerAccount[]): AiAccountMention[] {
  const live = [...liveAccounts(accounts)].sort((a, b) => b.name.length - a.name.length)
  const mentions: AiAccountMention[] = []
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@') continue
    const tail = text.slice(index + 1)
    const account = live.find(candidate =>
      candidate.name.length > 0 && tail.toLowerCase().startsWith(candidate.name.toLowerCase()))
    if (!account) continue
    if (!mentions.some(existing => existing.accountId === account.id)) {
      mentions.push({ token: account.name, accountId: account.id })
    }
    index += account.name.length
    if (mentions.length >= MAX_AI_ACCOUNT_MENTIONS) break
  }
  return mentions
}
