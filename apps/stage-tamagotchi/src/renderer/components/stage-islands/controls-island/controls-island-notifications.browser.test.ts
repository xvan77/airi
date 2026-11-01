import en from '@proj-airi/i18n/locales/en'

import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { page } from 'vitest/browser'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ControlsIsland from './index.vue'

import { controlsIslandPlacementKey } from './use-controls-island-placement'

import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

const authState = vi.hoisted(() => ({
  credits: { value: 0 },
  isAuthenticated: { value: false },
  needsLogin: { value: false },
  sessionVersion: { value: 0 },
  token: { value: null as string | null },
  user: { value: null as { createdAt: Date, email: string, emailVerified: boolean, id: string, name: string, updatedAt: Date } | null },
  userId: { value: 'local' },
  onAuthenticated: () => () => {},
  onLogout: () => () => {},
}))

vi.mock('@proj-airi/electron-vueuse', () => ({
  useElectronEventaContext: () => ref({ on: vi.fn(() => vi.fn()), emit: vi.fn() }),
  useElectronEventaInvoke: () => vi.fn().mockResolvedValue(false),
  useElectronMouseInElement: () => ({ isOutside: ref(false) }),
}))

vi.mock('@moeru/eventa', async importOriginal => ({
  ...await importOriginal<typeof import('@moeru/eventa')>(),
  defineInvoke: () => vi.fn(),
}))

vi.mock('@proj-airi/stage-ui/stores/auth', async () => {
  const { reactive, ref } = await import('vue')
  authState.credits = ref(0)
  authState.isAuthenticated = ref(false)
  authState.needsLogin = ref(false)
  authState.sessionVersion = ref(0)
  authState.token = ref(null)
  authState.user = ref(null)
  authState.userId = ref('local')

  const store = reactive(authState)
  return { useAuthStore: () => store }
})

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function mountIsland() {
  const dock = ref<'bottom-right'>('bottom-right')
  return render(ControlsIsland, {
    global: {
      provide: {
        [controlsIslandPlacementKey as symbol]: {
          dock,
          isTop: computed(() => false),
          isLeft: computed(() => false),
          motionPhase: ref('idle'),
        },
      },
      plugins: [createPinia(), i18n],
      directives: { 'track-button': {} },
    },
  })
}

describe('controls Island notifications', () => {
  beforeEach(async () => {
    await page.viewport(900, 640)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    authState.isAuthenticated.value = false
    authState.token.value = null
    authState.user.value = null
  })

  it('does not expose the overflow menu or notifications entry', async () => {
    authState.token.value = 'user-1-token'
    authState.user.value = { id: 'user-1', name: 'Neko', email: 'neko@example.test', emailVerified: true, createdAt: new Date(), updatedAt: new Date() }
    authState.isAuthenticated.value = true
    mountIsland()

    expect(document.querySelector('[data-testid="controls-menu"]')).toBeNull()
    expect(document.querySelector('[data-testid="controls-island-notifications"]')).toBeNull()
    expect(document.querySelector('[data-testid="controls-island-notifications-dot"]')).toBeNull()
  })
})
