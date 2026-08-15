import { describe, expect, it } from 'vitest'
import {
  readPushChannelIntent,
  withChannel,
  writePushChannelIntent,
} from './channelIntent'

describe('push channel intent repair key', () => {
  it('preserves one channel across revisions and clears only when both are off', () => {
    const account = ' someone@example.com '

    writePushChannelIntent(account, { billReminders: true, categoryAlerts: false })

    const afterAlertsEnabled = withChannel(
      readPushChannelIntent(account),
      'categoryAlerts',
      true,
    )
    writePushChannelIntent(account, afterAlertsEnabled)

    expect(readPushChannelIntent('SOMEONE@EXAMPLE.COM')).toEqual({
      billReminders: true,
      categoryAlerts: true,
    })

    const afterBillsDisabled = withChannel(
      readPushChannelIntent(account),
      'billReminders',
      false,
    )
    writePushChannelIntent(account, afterBillsDisabled)

    expect(readPushChannelIntent(account)).toEqual({
      billReminders: false,
      categoryAlerts: true,
    })
    expect(localStorage.getItem('push_channel_intent:SOMEONE@EXAMPLE.COM')).not.toBeNull()

    writePushChannelIntent(
      account,
      withChannel(readPushChannelIntent(account), 'categoryAlerts', false),
    )

    expect(localStorage.getItem('push_channel_intent:SOMEONE@EXAMPLE.COM')).toBeNull()
    expect(readPushChannelIntent(account)).toEqual({
      billReminders: false,
      categoryAlerts: false,
    })
  })
})
