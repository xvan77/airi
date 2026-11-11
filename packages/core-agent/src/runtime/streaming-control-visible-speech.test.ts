import { describe, expect, it } from 'vitest'

import { stripStreamingControlMarkersFromVisibleSpeech } from './streaming-control-visible-speech'

describe('stripStreamingControlMarkersFromVisibleSpeech', () => {
  it('removes well-formed ACT, DELAY, and CALL markers', () => {
    const input = 'Hi <|ACT {"emotion":"happy"}|><|DELAY 1|> there <|CALL ["x"]|>!'
    expect(stripStreamingControlMarkersFromVisibleSpeech(input, { collapseSpace: true })).toBe('Hi there !')
  })

  it('removes malformed ACT markers without the opening delimiter', () => {
    const input = 'ACT {"emotion":"curious"}|>\nHey hey!'
    expect(stripStreamingControlMarkersFromVisibleSpeech(input).trim()).toBe('Hey hey!')
  })

  it('removes escaped marker forms', () => {
    const input = 'Hello<{\'|\'}ACT {"emotion":"neutral"}{\'|\'}> world'
    expect(stripStreamingControlMarkersFromVisibleSpeech(input)).toBe('Hello world')
  })

  it('hides a trailing partial malformed ACT while streaming', () => {
    const input = 'Sounds good! ACT {"emotion":"happy","intensity":0.6'
    expect(stripStreamingControlMarkersFromVisibleSpeech(input).trim()).toBe('Sounds good!')
  })
})
