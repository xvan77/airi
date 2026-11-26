import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isPromptApiSupportedHost } from './prompt-api-runtime'

vi.mock('@proj-airi/stage-shared', () => ({
  isStageTamagotchi: vi.fn(() => false),
}))

describe('isPromptApiSupportedHost', () => {
  beforeEach(() => {
    vi.mocked(isStageTamagotchi).mockReturnValue(false)
    Reflect.deleteProperty(globalThis, 'LanguageModel')
  })

  it('is false on Tamagotchi even when LanguageModel exists', () => {
    vi.mocked(isStageTamagotchi).mockReturnValue(true)
    Object.defineProperty(globalThis, 'LanguageModel', { value: {}, configurable: true })
    expect(isPromptApiSupportedHost()).toBe(false)
  })

  it('is true on web when LanguageModel exists', () => {
    vi.mocked(isStageTamagotchi).mockReturnValue(false)
    Object.defineProperty(globalThis, 'LanguageModel', { value: {}, configurable: true })
    expect(isPromptApiSupportedHost()).toBe(true)
  })

  it('is false on web when LanguageModel is missing', () => {
    expect(isPromptApiSupportedHost()).toBe(false)
  })
})
