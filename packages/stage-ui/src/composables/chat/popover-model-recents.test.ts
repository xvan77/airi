import { describe, expect, it } from 'vitest'

import {
  pushChatModelRecent,
  pushSpeechModelRecent,
} from './popover-model-recents'

describe('popover model recents', () => {
  it('moves the latest chat selection to the front and caps the list', () => {
    const first = pushChatModelRecent([], 'openai', 'gpt-4o-mini')
    const second = pushChatModelRecent(first, 'groq', 'llama')

    expect(second[0]).toEqual(expect.objectContaining({ provider: 'groq', model: 'llama' }))
    expect(second[1]?.provider).toBe('openai')

    const reshuffled = pushChatModelRecent(second, 'openai', 'gpt-4o-mini')
    expect(reshuffled[0]?.provider).toBe('openai')
    expect(reshuffled).toHaveLength(2)
  })

  it('dedupes speech entries by provider, model, and voice', () => {
    const seeded = pushSpeechModelRecent([], 'kokoro-local', 'model-a', 'voice-1')
    const again = pushSpeechModelRecent(
      [...seeded, { provider: 'x', model: 'm', voiceId: 'v', usedAt: 1 }],
      'kokoro-local',
      'model-a',
      'voice-1',
    )

    expect(again).toHaveLength(2)
    expect(again[0]?.voiceId).toBe('voice-1')
  })
})
