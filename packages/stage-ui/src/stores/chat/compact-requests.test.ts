import { describe, expect, it } from 'vitest'

import { isOnDeviceSlimChatProvider, shouldAttachMemoryTools, shouldIncludeChatFormatRules, usesCompactChatRequests } from './compact-requests'

describe('compact requests', () => {
  it('marks on-device chat providers for slim payloads', () => {
    expect(isOnDeviceSlimChatProvider('local-llm')).toBe(true)
    expect(isOnDeviceSlimChatProvider('groq')).toBe(false)
  })

  it('respects the compact requests toggle', () => {
    expect(usesCompactChatRequests(false, 'groq')).toBe(false)
    expect(usesCompactChatRequests(true, 'groq')).toBe(true)
  })

  it('drops format rules when compact is on', () => {
    expect(shouldIncludeChatFormatRules(true, undefined)).toBe(false)
    expect(shouldIncludeChatFormatRules(false, undefined)).toBe(true)
    expect(shouldIncludeChatFormatRules(true, 'local-llm')).toBe(false)
  })

  it('drops idle memory tools when compact is on', () => {
    expect(shouldAttachMemoryTools(true, '', true)).toBe(false)
    expect(shouldAttachMemoryTools(true, 'fact-a: hi', true)).toBe(true)
    expect(shouldAttachMemoryTools(true, '', false)).toBe(true)
  })
})
