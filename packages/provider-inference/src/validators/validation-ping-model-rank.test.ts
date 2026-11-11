import { describe, expect, it } from 'vitest'

import { sortValidationPingModels, validationPingModelWeight } from './validation-ping-model-rank'

describe('validationPingModelWeight', () => {
  it('ranks lite flash models below full flash and pro', () => {
    expect(validationPingModelWeight('gemini-3.1-flash-lite')).toBeLessThan(validationPingModelWeight('gemini-3.8-flash'))
    expect(validationPingModelWeight('gemini-3.8-flash')).toBeLessThan(validationPingModelWeight('gemini-3.8-pro'))
  })
})

describe('sortValidationPingModels', () => {
  it('orders heavy ids after light ids regardless of input order', () => {
    expect(sortValidationPingModels([
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
    ])).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-2.5-pro',
    ])
  })
})
