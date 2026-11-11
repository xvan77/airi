import type { ChatProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { ChatRequestOptions, ProviderInstance } from '../../../types'

import { describe, expect, it } from 'vitest'

import { googleModelSupportsReasoningEffort, providerGoogleGenerativeAI } from './index'

type GoogleChatProvider = ChatProviderWithExtraOptions<string, ChatRequestOptions>

function isGoogleChatProvider(provider: ProviderInstance): provider is GoogleChatProvider {
  return 'chat' in provider && typeof provider.chat === 'function'
}

async function createGoogleChatProvider(): Promise<GoogleChatProvider> {
  const provider = await providerGoogleGenerativeAI.createProvider({
    apiKey: 'test-key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  })
  if (!isGoogleChatProvider(provider))
    throw new Error('Google provider must support chat')
  return provider
}

describe('googleModelSupportsReasoningEffort', () => {
  it('excludes Gemma models', () => {
    expect(googleModelSupportsReasoningEffort('models/gemma-2-9b-it')).toBe(false)
    expect(googleModelSupportsReasoningEffort('gemma-4-31b-it')).toBe(false)
    expect(googleModelSupportsReasoningEffort('gemini-3.8-flash')).toBe(true)
  })
})

describe('providerGoogleGenerativeAI.createProvider chat options', () => {
  it('omits reasoning effort when Consciousness disables reasoning', async () => {
    const provider = await createGoogleChatProvider()
    expect(provider.chat('gemini-3.8-flash', { reasoning: 'disabled' })).not.toHaveProperty('reasoningEffort')
    expect(provider.chat('models/gemma-2-9b-it', { reasoning: 'disabled' })).not.toHaveProperty('reasoningEffort')
  })

  it('omits reasoning effort for Gemma even when reasoning is enabled', async () => {
    const provider = await createGoogleChatProvider()
    expect(provider.chat('models/gemma-2-9b-it', { reasoning: 'enabled' })).not.toHaveProperty('reasoningEffort')
  })

  it('sets reasoning effort only for reasoning-capable Gemini models', async () => {
    const provider = await createGoogleChatProvider()
    expect(provider.chat('gemini-3.8-flash', { reasoning: 'enabled' })).toMatchObject({ reasoningEffort: 'medium' })
    expect(provider.chat('gemini-3.8-flash')).not.toHaveProperty('reasoningEffort')
  })
})
