import type { Message } from '@xsai/shared-chat'

import { describe, expect, it } from 'vitest'

import { normalizeLlamaServerChatMessages } from './llama-server-chat'

describe('normalizeLlamaServerChatMessages', () => {
  it('merges consecutive user messages and combines system prompts', () => {
    const messages: Message[] = [
      { role: 'system', content: 'Persona' },
      { role: 'system', content: 'Tools' },
      { role: 'user', content: 'Context block' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'Again' },
    ]

    const normalized = normalizeLlamaServerChatMessages(messages)

    expect(normalized.map(message => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ])
    expect(normalized[0]?.content).toBe('Persona\n\nTools')
    expect(normalized[1]?.content).toBe('Context block\n\nHello')
  })

  it('maps tool output to user and prepends a user turn when history starts with assistant', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Greeting from card' },
      { role: 'user', content: 'Hi' },
    ]

    const normalized = normalizeLlamaServerChatMessages(messages)

    expect(normalized.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ])
    expect(normalized[0]?.content).toBe('')
    expect(normalized[1]?.content).toBe('Greeting from card')
  })
})
