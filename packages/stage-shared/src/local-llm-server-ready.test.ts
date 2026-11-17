// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { installLocalLlmServerReadyProbe, waitForLocalLlmServerReady } from './local-llm-server-ready'

describe('waitForLocalLlmServerReady', () => {
  afterEach(() => {
    installLocalLlmServerReadyProbe(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses an installed probe instead of fetch', async () => {
    const probe = vi.fn().mockResolvedValue(true)
    installLocalLlmServerReadyProbe(probe)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(waitForLocalLlmServerReady({ timeoutMs: 500 })).resolves.toBe(true)
    expect(probe).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns true when the models endpoint responds with HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    await expect(waitForLocalLlmServerReady({ timeoutMs: 1_000, pollMs: 10 })).resolves.toBe(true)
  })

  it('polls through HTTP 503 until the server is ready', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(waitForLocalLlmServerReady({ timeoutMs: 1_000, pollMs: 10 })).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
