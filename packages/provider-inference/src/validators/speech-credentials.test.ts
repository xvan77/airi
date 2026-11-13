import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSpeechCredentialValidator, probeSpeechCredentialRequest, probeSpeechVoiceCatalog } from './speech-credentials'

const mockT = vi.fn((key: string) => key)

describe('probeSpeechCredentialRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts HTTP 200', async () => {
    await expect(probeSpeechCredentialRequest(new URL('https://example.com/v1/models'))).resolves.toBeUndefined()
  })

  // ROOT CAUSE:
  //
  // Cloud speech treated a nonempty API key as valid. Gemini answers a junk
  // key with HTTP 400, so the chat helper (401/403/5xx) would also pass it.
  //
  // We fail every non-OK credential probe unless the caller opts into HTTP 404
  // for OpenAI-compatible TTS servers with no /models route.
  it('rejects HTTP 400 from a refused Gemini key', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"API key not valid."}}', { status: 400 }))

    await expect(probeSpeechCredentialRequest(new URL('https://example.com/v1beta/models')))
      .rejects
      .toThrow('HTTP 400')
  })

  it('rejects HTTP 401', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(probeSpeechCredentialRequest(new URL('https://example.com/v1/models')))
      .rejects
      .toThrow('HTTP 401')
  })

  it('rejects HTTP 404 by default', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))

    await expect(probeSpeechCredentialRequest(new URL('https://example.com/v1/models')))
      .rejects
      .toThrow('HTTP 404')
  })

  it('accepts HTTP 404 when the caller allows a missing models route', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))

    await expect(probeSpeechCredentialRequest(
      new URL('https://example.com/v1/models'),
      {},
      { acceptNotFound: true },
    )).resolves.toBeUndefined()
  })

  it('rejects a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(probeSpeechCredentialRequest(new URL('https://example.com/v1/models')))
      .rejects
      .toThrow('Speech credential check failed')
  })
})

describe('createSpeechCredentialValidator', () => {
  it('marks a refused probe invalid', async () => {
    const create = createSpeechCredentialValidator<{ apiKey: string }>({
      id: 'test:check-credentials',
      probe: async () => {
        throw new Error('Speech credential check failed: HTTP 400')
      },
    })
    const validator = create({ t: mockT })

    const result = await validator.validator(
      { apiKey: 'junk' },
      {} as never,
      {},
      { t: mockT },
    )

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('HTTP 400')
  })

  it('marks an accepted probe valid', async () => {
    const create = createSpeechCredentialValidator<{ apiKey: string }>({
      id: 'test:check-credentials',
      probe: async () => {},
    })
    const validator = create({ t: mockT })

    const result = await validator.validator(
      { apiKey: 'ok' },
      {} as never,
      {},
      { t: mockT },
    )

    expect(result.valid).toBe(true)
  })
})

describe('probeSpeechVoiceCatalog', () => {
  it('fails when listVoices is missing', async () => {
    await expect(probeSpeechVoiceCatalog({}, {} as never, {}))
      .rejects
      .toThrow('voice catalog is unavailable')
  })

  it('calls listVoices with the config and provider', async () => {
    const listVoices = vi.fn(async () => [])
    const provider = {} as never

    await probeSpeechVoiceCatalog({ apiKey: 'ok' }, provider, { listVoices })

    expect(listVoices).toHaveBeenCalledWith({ apiKey: 'ok' }, provider)
  })
})
