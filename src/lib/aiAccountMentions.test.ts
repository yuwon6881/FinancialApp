import { describe, expect, it } from 'vitest'
import {
  applyAccountMention,
  findAccountMentionQuery,
  isAccountMentionComplete,
  matchAccountsForMention,
  resolveAccountMentions,
  tokenizeAccountMentions,
} from './aiAccountMentions'
import type { LedgerAccount } from '../types'

const account = (id: string, name: string, bucket: LedgerAccount['bucket'], isArchived = false): LedgerAccount => ({
  id,
  name,
  bucket,
  kind: 'Bank',
  isArchived,
  remaining: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const accounts = [
  account('acct-cimb', 'CIMB', 'Essentials'),
  account('acct-ryt', 'RYT', 'Essentials'),
  account('acct-may', 'Maybank', 'Growth'),
  account('acct-may-save', 'Maybank Savings', 'Growth'),
  account('acct-old', 'Old Account', 'Rewards', true),
]

describe('findAccountMentionQuery', () => {
  it('opens on an @ that starts a word', () => {
    expect(findAccountMentionQuery('transfer 50 from @cim', 21)).toEqual({ start: 17, query: 'cim' })
  })

  it('stays open across a space, because account names hold spaces', () => {
    expect(findAccountMentionQuery('@Maybank Sav', 12)).toEqual({ start: 0, query: 'Maybank Sav' })
  })

  it('ignores an @ inside a word so an email is never a mention', () => {
    expect(findAccountMentionQuery('me@example.com', 14)).toBeNull()
  })

  it('closes at a newline', () => {
    expect(findAccountMentionQuery('@cimb\nnext line', 15)).toBeNull()
  })
})

describe('matchAccountsForMention', () => {
  it('lists every live account for an empty query so the feature is discoverable', () => {
    expect(matchAccountsForMention(accounts, '').map(a => a.id))
      .toEqual(['acct-cimb', 'acct-ryt', 'acct-may', 'acct-may-save'])
  })

  it('never offers an archived account', () => {
    expect(matchAccountsForMention(accounts, 'old')).toHaveLength(0)
  })

  it('ranks an exact name above a prefix above a contained match', () => {
    expect(matchAccountsForMention(accounts, 'maybank').map(a => a.id))
      .toEqual(['acct-may', 'acct-may-save'])
  })

  it('matches a bucket name too', () => {
    expect(matchAccountsForMention(accounts, 'growth').map(a => a.id))
      .toEqual(['acct-may', 'acct-may-save'])
  })
})

describe('applyAccountMention', () => {
  it('replaces the query with the account name and leaves one trailing space', () => {
    const mention = findAccountMentionQuery('transfer 50 from @cim', 21)!
    expect(applyAccountMention('transfer 50 from @cim', mention, accounts[0]))
      .toEqual({ text: 'transfer 50 from @CIMB ', caret: 23 })
  })

  it('keeps the text that already followed the caret', () => {
    const mention = findAccountMentionQuery('@cim to RYT', 4)!
    expect(applyAccountMention('@cim to RYT', mention, accounts[0]).text).toBe('@CIMB to RYT')
  })
})

describe('resolveAccountMentions', () => {
  it('returns mentions in the order they appear, which is what makes a transfer directional', () => {
    expect(resolveAccountMentions('transfer 50 from @CIMB to @RYT', accounts))
      .toEqual([
        { token: 'CIMB', accountId: 'acct-cimb' },
        { token: 'RYT', accountId: 'acct-ryt' },
      ])
  })

  it('prefers the longest matching name so a two-word account is not read as its first word', () => {
    expect(resolveAccountMentions('@Maybank Savings 40', accounts))
      .toEqual([{ token: 'Maybank Savings', accountId: 'acct-may-save' }])
  })

  it('ignores an archived account and unknown text', () => {
    expect(resolveAccountMentions('@Old Account and @Nowhere', accounts)).toEqual([])
  })

  it('reports each account once even when named twice', () => {
    expect(resolveAccountMentions('@CIMB then @CIMB again', accounts)).toHaveLength(1)
  })

  it('does not resolve an account prefix inside a longer token', () => {
    expect(resolveAccountMentions('@CIMB-extra and me@CIMB', accounts)).toEqual([])
  })
})

describe('tokenizeAccountMentions', () => {
  it('preserves text while identifying repeated exact account references for presentation', () => {
    expect(tokenizeAccountMentions('Move from @CIMB to @RYT, then @CIMB.', accounts)).toEqual([
      { text: 'Move from ' },
      { text: '@CIMB', accountId: 'acct-cimb', accountName: 'CIMB' },
      { text: ' to ' },
      { text: '@RYT', accountId: 'acct-ryt', accountName: 'RYT' },
      { text: ', then ' },
      { text: '@CIMB', accountId: 'acct-cimb', accountName: 'CIMB' },
      { text: '.' },
    ])
  })
})

describe('isAccountMentionComplete', () => {
  it('closes the mention once no account name continues past the space', () => {
    expect(isAccountMentionComplete('RYT ', accounts)).toBe(true)
  })

  it('stays open across a space that a longer account name continues', () => {
    expect(isAccountMentionComplete('Maybank ', accounts)).toBe(false)
  })

  it('is never complete while the user is still inside the name', () => {
    expect(isAccountMentionComplete('RY', accounts)).toBe(false)
  })
})
