import { describe, expect, it } from 'vitest'

import {
  isExcludedFromConsciousnessCatalog,
  isSpeechOrAudioCatalogModel,
} from './consciousness-catalog-exclusions'
import { isGoogleConsciousnessIncompatibleModel } from './google-retired-chat-models'

describe('isSpeechOrAudioCatalogModel', () => {
  it('matches TTS and audio markers on any provider', () => {
    expect(isSpeechOrAudioCatalogModel({ id: 'gpt-4o-audio-preview', name: 'GPT-4o Audio' })).toBe(true)
    expect(isSpeechOrAudioCatalogModel({ id: 'vendor/flash-tts-v2', name: 'Flash TTS' })).toBe(true)
    expect(isSpeechOrAudioCatalogModel({ id: 'some-model', name: 'Text-to-speech demo' })).toBe(true)
    expect(isSpeechOrAudioCatalogModel({ id: 'openai/whisper-audio-stt', name: 'Whisper' })).toBe(true)
  })

  it('keeps normal chat models', () => {
    expect(isSpeechOrAudioCatalogModel({ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' })).toBe(false)
    expect(isSpeechOrAudioCatalogModel({ id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' })).toBe(false)
  })
})

describe('isExcludedFromConsciousnessCatalog', () => {
  it('applies speech rules before provider-specific rules', () => {
    expect(isExcludedFromConsciousnessCatalog(
      { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS' },
      'google-generative-ai',
    )).toBe(true)
    expect(isExcludedFromConsciousnessCatalog(
      { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS' },
      'openrouter-ai',
    )).toBe(true)
  })

  it('still applies Google-only exclusions for text chat ids', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-2.5-flash')).toBe(true)
    expect(isExcludedFromConsciousnessCatalog(
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      'google-generative-ai',
    )).toBe(true)
    expect(isExcludedFromConsciousnessCatalog(
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      'openrouter-ai',
    )).toBe(false)
  })
})
