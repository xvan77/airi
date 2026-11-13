import en from '@proj-airi/i18n/locales/en'

import { PiniaColada } from '@pinia/colada'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { createPinia, disposePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { page } from 'vitest/browser'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import MinimaxSpeechPage from './minimax-speech.vue'

import 'virtual:uno.css'

const providerId = 'minimax-speech'

/** The account catalog the stubbed `get_voice` endpoint returns. */
const voiceCatalog = {
  system_voice: [
    { voice_id: 'English_Graceful_Lady', voice_name: 'Graceful Lady' },
    { voice_id: 'Spanish_WiseScholar', voice_name: 'Wise Scholar' },
    { voice_id: 'Chinese (Mandarin)_News_Anchor', voice_name: 'News Anchor' },
  ],
  voice_cloning: [],
  voice_generation: [],
  base_resp: { status_code: 0, status_msg: 'success' },
}

const savedCredentials = { apiKey: 'saved-minimax-key', baseUrl: 'https://api.minimax.io' }

function storeConfiguredProvider(config: Record<string, unknown>) {
  localStorage.setItem('settings/providers/configured', JSON.stringify({
    [providerId]: {
      id: providerId,
      definitionId: providerId,
      config,
      status: 'configured',
      configuredBy: 'user',
    },
  }))
}

function storedConfig() {
  const stored = localStorage.getItem('settings/providers/configured')
  if (!stored)
    return undefined
  return JSON.parse(stored)[providerId]?.config
}

async function renderPage(store: ReturnType<typeof createPinia>) {
  await page.viewport(1100, 1100)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  return await render(MinimaxSpeechPage, {
    global: {
      plugins: [store, PiniaColada, router, createI18n({ legacy: false, locale: 'en', messages: { en } })],
      directives: { motion: {} },
    },
  })
}

describe('minimax speech settings page', () => {
  const stores: Array<ReturnType<typeof createPinia>> = []
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    localStorage.clear()
    stores.length = 0
    pinia = createPinia()
    stores.push(pinia)
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify(voiceCatalog),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
  })

  afterEach(() => {
    for (const store of stores)
      disposePinia(store)
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  // The page must read the account catalog through the get_voice endpoint, so a
  // Spanish voice reaches the selector. A stored key must produce a populated
  // catalog without the user retyping it.
  //
  // This test does not reproduce the empty selector reported by the user. That
  // failure needs a real browser session.
  it('lists the account voices when the key is already saved', async () => {
    storeConfiguredProvider(savedCredentials)

    await renderPage(pinia)

    await expect.poll(() => useSpeechStore(pinia).availableVoices[providerId]?.length, { timeout: 5000 })
      .toBeGreaterThan(0)

    const requestedUrls = vi.mocked(globalThis.fetch).mock.calls.map(call => String(call[0]))

    expect(requestedUrls.some(url => url.includes('/v1/get_voice'))).toBe(true)
  })

  // ROOT CAUSE:
  //
  // The settings page wrote the credentials but never validated them. The
  // status stayed `unconfigured`, and the module filter dropped the provider.
  //
  // The user edit is the explicit validation trigger. The MiniMax validator
  // only checks that the key is not empty, so the test needs no network.
  it('marks the provider configured after the user enters a valid API key', async () => {
    storeConfiguredProvider({ ...savedCredentials, apiKey: '' })

    await renderPage(pinia)

    await page.getByPlaceholder('API Key').fill('user-entered-key')

    await expect.poll(() => storedConfig()?.apiKey, { timeout: 4000 }).toBe('user-entered-key')
    await expect.poll(() => {
      const stored = localStorage.getItem('settings/providers/configured')
      if (!stored)
        return undefined
      return JSON.parse(stored)[providerId]?.status
    }, { timeout: 4000 }).toBe('configured')
  })

  // Voice pick moved to Speech. This page must not keep a playground selector.
  it('does not show a playground voice selector', async () => {
    storeConfiguredProvider(savedCredentials)

    await renderPage(pinia)

    await expect.poll(() => useSpeechStore(pinia).availableVoices[providerId]?.length, { timeout: 5000 })
      .toBeGreaterThan(0)
    await expect.element(page.getByRole('combobox', { name: /Select preferred voice/ })).not.toBeInTheDocument()
  }, 30_000)
})
