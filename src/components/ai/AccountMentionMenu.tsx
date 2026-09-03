import { Button } from '../ui/Button'
import type { LedgerAccount } from '../../types'

interface AccountMentionMenuProps {
  accounts: LedgerAccount[]
  activeIndex: number
  onPick: (account: LedgerAccount) => void
  onHoverIndex: (index: number) => void
}

/**
 * The account picker that opens on "@" in the Ask AI composer.
 *
 * It is a `listbox` the textarea points at with `aria-activedescendant` rather than a menu that
 * takes focus: the caret must stay in the message while the list is open, or picking an account
 * would end the sentence the user is halfway through typing.
 *
 * Balances are deliberately absent. The composer is reachable in sensitive mode, and a picker that
 * printed every account's balance would reveal exactly what the mask withholds -- the account name
 * and bucket are all that is needed to point at one.
 */
export const AccountMentionMenu: React.FC<AccountMentionMenuProps> = ({
  accounts,
  activeIndex,
  onPick,
  onHoverIndex,
}) => (
  <ul
    id="ai-account-mentions"
    role="listbox"
    aria-label="Ledger accounts"
    className="absolute bottom-full left-0 z-20 mb-2 max-h-60 w-full max-w-sm overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-card p-1 shadow-lg"
  >
    {accounts.map((account, index) => (
      <li key={account.id} role="none">
        <Button
          variant="tertiary"
          type="button"
          id={`ai-account-mention-${account.id}`}
          role="option"
          aria-selected={index === activeIndex}
          // The textarea keeps focus, so the pick has to happen before the browser moves it.
          onMouseDown={event => { event.preventDefault(); onPick(account) }}
          onMouseEnter={() => onHoverIndex(index)}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer sm:min-h-9 ${
            index === activeIndex ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{account.name}</span>
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{account.bucket}</span>
        </Button>
      </li>
    ))}
  </ul>
)
