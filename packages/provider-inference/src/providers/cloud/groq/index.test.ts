import type { ChatProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { ChatRequestOptions, ProviderInstance } from '../../../types'

import { describe, expect, it } from 'vitest'

import { providerGroq } from './index'

type GroqChatProvider = ChatProviderWithExtraOptions<string, ChatRequestOptions>

function isGroqChatProvider(provider: ProviderInstance): provider is GroqChatProvider {
  return 'chat' in provider && typeof provider.chat === 'function'
}

async function createGroqChatProvider(): Promise<GroqChatProvider> {
  const provider = await providerGroq.createProvider({
    apiKey: 'test',
    baseUrl: 'https://api.groq.com/openai/v1/',
  })
  if (!isGroqChatProvider(provider))
    throw new Error('Groq provider must support chat')
  return provider
}

describe('providerGroq.createProvider chat options', () => {
  it('omits reasoning_effort when Consciousness disables reasoning', async () => {
    const provider = await createGroqChatProvider()
    expect(provider.chat('openai/gpt-oss-20b', { reasoning: 'disabled' })).not.toHaveProperty('reasoningEffort')
    expect(provider.chat('openai/gpt-oss-20b')).not.toHaveProperty('reasoningEffort')
  })

  it('sends medium reasoning_effort only when reasoning is enabled', async () => {
    const provider = await createGroqChatProvider()
    expect(provider.chat('openai/gpt-oss-20b', { reasoning: 'enabled' })).toMatchObject({ reasoningEffort: 'medium' })
  })
})
