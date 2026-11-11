import { describe, expect, it } from 'vitest'

import { nonChatModelIdMatches } from './non-chat-model-markers'

describe('nonChatModelIdMatches', () => {
  it('matches Grok imagine media models', () => {
    expect(nonChatModelIdMatches('grok-imagine-image-2.0')).toBe(true)
    expect(nonChatModelIdMatches('grok-imagine-video-1.5-lite')).toBe(true)
  })

  it('keeps common text chat ids', () => {
    expect(nonChatModelIdMatches('grok-3')).toBe(false)
    expect(nonChatModelIdMatches('gpt-4o-mini')).toBe(false)
    expect(nonChatModelIdMatches('openai/gpt-oss-20b')).toBe(false)
  })
})
