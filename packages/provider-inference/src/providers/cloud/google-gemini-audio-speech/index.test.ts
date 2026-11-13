import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { providerGoogleGeminiAudioSpeech } from './index'

describe('providerGoogleGeminiAudioSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends Gemini TTS requests through the SDK without duplicating the API version path', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ inlineData: { data: 'AAABAA==', mimeType: 'audio/pcm;rate=24000' } }],
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = await providerGoogleGeminiAudioSpeech.createProvider({
      apiKey: 'test-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    }) as SpeechProviderWithExtraOptions<string, { model?: string }>
    const options = provider.speech('gemini-2.5-flash-preview-tts')
    const response = await options.fetch!(new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent'), {
      method: 'POST',
      body: JSON.stringify({
        input: 'Hello there',
        model: options.model,
        temperature: 0.4,
        voice: 'Kore',
      }),
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent')
    expect(response.headers.get('Content-Type')).toBe('audio/wav')

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>
      generationConfig: {
        responseModalities: string[]
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } }
        temperature: number
      }
    }

    expect(requestBody.contents[0]?.parts[0]?.text).toBe('Hello there')
    expect(requestBody.generationConfig.responseModalities).toEqual(['AUDIO'])
    expect(requestBody.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore')
    expect(requestBody.generationConfig.temperature).toBe(0.4)
  })

  it('asks chat TTS to synthesize one Gemini request at a time', () => {
    // ROOT CAUSE:
    //
    // Chat splits a reply into TTS segments and synthesizes up to 4 at once.
    // Test Voice sends one request. Gemini then answers the extra chat
    // requests with HTTP 429 while the playground still works.
    //
    // We fixed this by declaring ttsMaxConcurrent 1 on Gemini speech.
    expect(providerGoogleGeminiAudioSpeech.capabilities?.speech?.ttsMaxConcurrent).toBe(1)
  })

  it('does not call Gemini when the speech request has no voice', async () => {
    // ROOT CAUSE:
    //
    // Gemini TTS used Kore when voice was empty. Test Voice and chat still
    // called generateContent, and Google returned a 429 JSON banner even
    // though the list had no selected voice.
    //
    // Missing voice now fails locally. Gemini is not contacted.
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const provider = await providerGoogleGeminiAudioSpeech.createProvider({
      apiKey: 'test-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    }) as SpeechProviderWithExtraOptions<string, { model?: string }>
    const options = provider.speech('gemini-2.5-flash-preview-tts')

    await expect(options.fetch!(new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent'), {
      method: 'POST',
      body: JSON.stringify({
        input: 'Hello there',
        model: options.model,
      }),
    })).rejects.toThrow('Missing voice for Gemini TTS')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  async function validateCredentials(status: number, body = '') {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(body, { status }))
    vi.stubGlobal('fetch', fetchMock)

    const config = { apiKey: 'junk-key', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/' }
    const validator = await providerGoogleGeminiAudioSpeech.validators!.validateProvider![0]({ t: key => key })
    const provider = await providerGoogleGeminiAudioSpeech.createProvider(config)
    const result = await validator.validator(
      config,
      provider,
      providerGoogleGeminiAudioSpeech.extraMethods ?? {},
      { t: key => key },
    )

    return { fetchMock, result }
  }

  // ROOT CAUSE:
  //
  // Gemini speech only checked that the API key field was nonempty. A junk
  // string passed, and settings showed Configuration validation success.
  //
  // We fixed this by GETting /models with x-goog-api-key. Gemini answers a
  // refused key with HTTP 400, which this probe treats as invalid.
  it('rejects a nonempty but refused Gemini API key', async () => {
    const { fetchMock, result } = await validateCredentials(400, '{"error":{"message":"API key not valid."}}')

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('HTTP 400')
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://generativelanguage.googleapis.com/v1beta/models')
    expect(fetchMock.mock.calls[0]![1]?.headers).toEqual({ 'x-goog-api-key': 'junk-key' })
  })

  it('accepts a Gemini API key the models list allows', async () => {
    const { result } = await validateCredentials(200, '{"models":[]}')

    expect(result.valid).toBe(true)
  })

  it('creates a speech client when the stored config has no API key yet', async () => {
    // ROOT CAUSE:
    //
    // listProviderModels always calls createProvider. Gemini then did
    // config.apiKey.trim() before the static TTS list ran, so Speech showed
    // No models available even though Test Voice already had a key.
    expect(providerGoogleGeminiAudioSpeech.createProvider({} as { apiKey: string })).toEqual({
      speech: expect.any(Function),
    })
  })
})
