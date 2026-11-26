import en from '@proj-airi/i18n/locales/en'

import { createPinia, disposePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import TranscriberPage from './transcriber.vue'

import 'virtual:uno.css'

const pinias: ReturnType<typeof createPinia>[] = []

afterEach(() => {
  cleanup()
  pinias.splice(0).forEach(pinia => disposePinia(pinia))
  vi.restoreAllMocks()
  localStorage.clear()
})

async function renderTranscriber() {
  const pinia = createPinia()
  pinias.push(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/settings/modules/hearing/transcriber')

  return render(TranscriberPage, {
    global: {
      plugins: [pinia, router, createI18n({ legacy: false, locale: 'en', messages: { en }, missingWarn: false, fallbackWarn: false })],
    },
  })
}

describe('speech recognition settings', () => {
  it('shows the microphone, the providers, and the playground without the overview controls', async () => {
    const screen = await renderTranscriber()

    await expect.element(screen.getByText('Input device')).toBeVisible()
    await expect.element(screen.getByTestId('hearing-playground-monitor-toggle')).toBeVisible()
    expect(screen.getByTestId('hearing-input-mode').query()).toBeNull()
    expect(screen.getByTestId('hearing-auto-send').query()).toBeNull()
  })

  it('links to Hearing more options under the provider and model controls', async () => {
    const screen = await renderTranscriber()

    await expect.element(screen.getByTestId('hearing-more-options')).toHaveAttribute('href', '/settings/modules/hearing/more')
    await expect.element(screen.getByTestId('hearing-more-options')).toHaveTextContent('More options')
  })

  it('does not open the microphone when the page opens', async () => {
    const capture = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
    const screen = await renderTranscriber()

    await expect.element(screen.getByTestId('hearing-playground-monitor-toggle')).toBeVisible()
    expect(capture).not.toHaveBeenCalled()
  })
})
