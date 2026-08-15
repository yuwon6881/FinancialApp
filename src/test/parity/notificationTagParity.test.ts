import { describe, expect, it } from 'vitest'
import { buildNotificationTag, type PushNotificationData } from '../../lib/push/notificationTag'
import { readFixture } from './runParity'

interface NotificationTagCase {
  id: string
  why: string
  input: PushNotificationData
  expected: {
    tag: string
  }
}

describe('notification tag parity', () => {
  const cases = readFixture<NotificationTagCase>('notification-tag')

  for (const { id, why, input, expected } of cases) {
    it(`[${id}] ${why}`, () => {
      const actual = buildNotificationTag(input)
      expect(actual).toBe(expected.tag)
    })
  }
})
