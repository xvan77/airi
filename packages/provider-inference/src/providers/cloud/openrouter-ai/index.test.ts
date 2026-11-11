import type { ChatProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { ChatRequestOptions } from '../../../types'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { providerOpenRouterAI } from './index'

describe('providerOpenRouterAI', () => {
  it('maps AIRI reasoning modes to OpenRouter request fields', async () => {
    const provider = await providerOpenRouterAI.createProvider({
      apiKey: 'test-key',
    }) as ChatProviderWithExtraOptions<string, ChatRequestOptions>

    expect(provider.chat('openai/gpt-test', { reasoning: 'disabled' })).toMatchObject({
      reasoning: { effort: 'none' },
    })
    expect(provider.chat('openai/gpt-test', { reasoning: 'enabled' })).toMatchObject({
      reasoning: { effort: 'medium' },
    })
  })

  it('sends Authorization on chat when fetch is customized for attribution headers', async () => {
    const provider = await providerOpenRouterAI.createProvider({
      apiKey: 'sk-or-test',
    }) as ChatProviderWithExtraOptions<string, ChatRequestOptions>
    const chat = provider.chat('recursive/flint-v1.0:free')
    expect(chat.fetch).toBeTypeOf('function')
    expect(chat.apiKey).toBe('sk-or-test')
    expect(new Headers(chat.headers).get('Authorization')).toBe('Bearer sk-or-test')

    let authorization: string | null = null
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('Authorization')
      return new Response('{}', { status: 200 })
    }))

    await chat.fetch!(new URL('https://openrouter.ai/api/v1/chat/completions'), { method: 'POST' })
    expect(authorization).toBe('Bearer sk-or-test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
})
