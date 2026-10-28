import { describe, expect, it } from 'vitest'

import { formatTimePrefix, stripPromptTimePrefix, takeSpeechAfterPromptTimePrefixEcho } from './datetime-prefix'

/**
 * @example
 * formatTimePrefix(new Date(2026, 3, 25, 18, 47).getTime())
 */
describe('formatTimePrefix', () => {
  /**
   * @example
   * Timestamp prefixes use `[YYYY-MM-DD HH:MM] ` with a trailing space.
   */
  it('wraps `[YYYY-MM-DD HH:MM]` with trailing space', () => {
    const ts = new Date(2026, 3, 25, 18, 47, 0).getTime()
    expect(formatTimePrefix(ts)).toBe('[2026-04-25 18:47] ')
  })

  /**
   * @example
   * Single-digit date parts are zero-padded.
   */
  it('zero-pads month, day, hour, and minute', () => {
    const ts = new Date(2026, 0, 5, 3, 7, 0).getTime()
    expect(formatTimePrefix(ts)).toBe('[2026-01-05 03:07] ')
  })

  /**
   * @example
   * Same-minute timestamps share the same prompt prefix.
   */
  it('shares the same prefix across timestamps in the same minute', () => {
    const a = new Date(2026, 3, 25, 18, 47, 12).getTime()
    const b = new Date(2026, 3, 25, 18, 47, 58).getTime()
    expect(formatTimePrefix(a)).toBe(formatTimePrefix(b))
  })
})

describe('stripPromptTimePrefix', () => {
  it('removes a leading prompt time prefix', () => {
    expect(stripPromptTimePrefix('[2026-10-27 22:45] hi')).toBe('hi')
  })

  it('removes repeated mirrored prefixes', () => {
    expect(stripPromptTimePrefix('[2026-10-27 22:45] [2026-10-27 22:45] hello')).toBe('hello')
  })
})

describe('takeSpeechAfterPromptTimePrefixEcho', () => {
  it('strips a prefix from one chunk', () => {
    const state = { hold: '', resolved: false, trimLeadingSpace: false }
    expect(takeSpeechAfterPromptTimePrefixEcho(state, '[2026-10-27 23:05] hey')).toBe('hey')
    expect(state.resolved).toBe(true)
  })

  it('buffers a split prefix across chunks', () => {
    const state = { hold: '', resolved: false, trimLeadingSpace: false }
    expect(takeSpeechAfterPromptTimePrefixEcho(state, '[2026-10-27 23:05]')).toBe('')
    expect(takeSpeechAfterPromptTimePrefixEcho(state, ' hey')).toBe('hey')
  })

  it('passes through normal text after the prefix is handled', () => {
    const state = { hold: '', resolved: false, trimLeadingSpace: false }
    takeSpeechAfterPromptTimePrefixEcho(state, '[2026-10-27 23:05] hi')
    expect(takeSpeechAfterPromptTimePrefixEcho(state, ' there')).toBe(' there')
  })
})
