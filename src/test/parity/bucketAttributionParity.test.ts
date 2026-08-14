import { describe, expect, it } from 'vitest'
import { bucketAmount } from '../../lib/bucketAttribution'
import { forEachCase } from './runParity'

describe('bucket attribution parity fixture', () => {
  for (const testCase of forEachCase('bucket-attribution')) {
    it(`${testCase.id}: ${testCase.why}`, () => {
      expect(bucketAmount(testCase.input.transaction, testCase.input.bucket)).toBe(testCase.expected)
    })
  }
})
