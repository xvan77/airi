import { describe, expect, it } from 'vitest'

import { resolveChatSpeechSelection } from './speech-selection'

describe('resolveChatSpeechSelection', () => {
  it('uses Speech module TTS when the card still names OpenRouter', () => {
    // ROOT CAUSE:
    //
    // Test Voice reads activeSpeechProvider (Gemini). Chat TTS preferred the
    // card speech row, which still named openrouter-audio-speech, and posted
    // /chat/completions until OpenRouter returned 402 Payment Required.
    //
    // Chat now uses the Speech module selection when it is a real provider.
    expect(resolveChatSpeechSelection(
      { provider: 'openrouter-audio-speech', model: 'openai/gpt-audio-mini', voice_id: 'ash' },
      {
        provider: 'google-gemini-audio-speech',
        model: 'gemini-2.5-flash-preview-tts',
        voiceId: 'Zephyr',
      },
    )).toEqual({
      provider: 'google-gemini-audio-speech',
      model: 'gemini-2.5-flash-preview-tts',
      voice_id: 'Zephyr',
    })
  })

  it('keeps card speech when the Speech module is unset', () => {
    expect(resolveChatSpeechSelection(
      { provider: 'openrouter-audio-speech', model: 'openai/gpt-audio-mini', voice_id: 'ash' },
      { provider: 'speech-noop', model: '', voiceId: '' },
    )).toEqual({
      provider: 'openrouter-audio-speech',
      model: 'openai/gpt-audio-mini',
      voice_id: 'ash',
    })
  })
})
