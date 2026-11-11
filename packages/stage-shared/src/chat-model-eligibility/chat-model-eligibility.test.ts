import { describe, expect, it } from 'vitest'

import { isGoogleConsciousnessIncompatibleModel } from './google-retired-chat-models'
import {
  isExcludedFromConsciousnessCatalog,
  isExcludedFromUsableChatModel,
  isModerationCatalogModel,
  isSpeechOrAudioCatalogModel,
  isUsableChatModel,
} from './index'

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

  it('matches bare OpenAI whisper ids', () => {
    expect(isSpeechOrAudioCatalogModel({ id: 'whisper-1', name: 'Whisper' })).toBe(true)
  })
})

describe('isGoogleConsciousnessIncompatibleModel', () => {
  it('hides retired Gemini chat ids for new API users', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-2.5-flash')).toBe(true)
    expect(isGoogleConsciousnessIncompatibleModel('gemini-2.5-pro')).toBe(true)
  })

  it('hides live and embedding checkpoints', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-live-2.5-flash-preview')).toBe(true)
    expect(isGoogleConsciousnessIncompatibleModel('text-embedding-004')).toBe(true)
  })

  it('keeps normal Gemini chat models available', () => {
    expect(isGoogleConsciousnessIncompatibleModel('gemini-3.8-flash')).toBe(false)
    expect(isGoogleConsciousnessIncompatibleModel('gemini-3.6-flash')).toBe(false)
  })
})

describe('isModerationCatalogModel', () => {
  it('hides safeguard and moderation checkpoints', () => {
    expect(isModerationCatalogModel({ id: 'openai/gpt-oss-safeguard-20b', name: 'Safety GPT OSS 20B' })).toBe(true)
    expect(isModerationCatalogModel({ id: 'text-moderation-latest', name: 'Moderation' })).toBe(true)
    expect(isModerationCatalogModel({ id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B' })).toBe(false)
  })
})

describe('isExcludedFromUsableChatModel', () => {
  it('applies speech rules before provider-specific rules', () => {
    expect(isExcludedFromUsableChatModel(
      { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS' },
      'google-generative-ai',
    )).toBe(true)
    expect(isExcludedFromUsableChatModel(
      { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS' },
      'openrouter-ai',
    )).toBe(true)
  })

  it('still applies Google-only exclusions for text chat ids', () => {
    expect(isExcludedFromUsableChatModel(
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      'google-generative-ai',
    )).toBe(true)
    expect(isExcludedFromUsableChatModel(
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      'openrouter-ai',
    )).toBe(false)
  })

  it('hides image and embedding checkpoints on every provider', () => {
    expect(isExcludedFromUsableChatModel({ id: 'dall-e-3', name: 'DALL·E 3' }, 'openai')).toBe(true)
    expect(isExcludedFromUsableChatModel({ id: 'text-embedding-3-small', name: 'Embedding' }, 'openai')).toBe(true)
    expect(isExcludedFromUsableChatModel({ id: 'grok-imagine-image', name: 'Grok Imagine Image' }, 'xai')).toBe(true)
    expect(isExcludedFromUsableChatModel({ id: 'gpt-4o-mini', name: 'GPT-4o mini' }, 'openai')).toBe(false)
  })

  it('hides moderation models on every provider', () => {
    expect(isExcludedFromUsableChatModel(
      { id: 'openai/gpt-oss-safeguard-20b', name: 'Safety GPT OSS 20B' },
      'groq',
    )).toBe(true)
  })

  it('exposes usable chat as the inverse', () => {
    expect(isUsableChatModel({ id: 'gemini-3.8-flash', name: 'Gemini' }, 'google-generative-ai')).toBe(true)
    expect(isUsableChatModel({ id: 'gemini-2.5-flash', name: 'Gemini' }, 'google-generative-ai')).toBe(false)
    expect(isExcludedFromConsciousnessCatalog(
      { id: 'gemini-2.5-flash', name: 'Gemini' },
      'google-generative-ai',
    )).toBe(true)
  })
})
