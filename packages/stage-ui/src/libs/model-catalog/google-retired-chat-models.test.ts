import { describe, expect, it } from 'vitest'

import { isGoogleConsciousnessIncompatibleModel } from './google-retired-chat-models'

describe('isGoogleConsciousnessIncompatibleModel', () => {
  it('hides retired Gemini chat ids for new API users', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-2.5-flash')).toBe(true)
    expect(isGoogleConsciousnessIncompatibleModel('gemini-2.5-pro')).toBe(true)
  })

  it('hides live and embedding checkpoints', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-live-2.5-flash-preview')).toBe(true)
    expect(isGoogleConsciousnessIncompatibleModel('text-embedding-004')).toBe(true)
  })

  it('keeps normal Gemini chat models available', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-3.8-flash')).toBe(false)
    expect(isGoogleConsciousnessIncompatibleModel('gemini-3.6-flash')).toBe(false)
  })
})
