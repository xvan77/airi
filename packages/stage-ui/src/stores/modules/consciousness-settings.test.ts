// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConsciousnessSettingsStore } from './consciousness-settings'

describe('consciousness settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('turns model reasoning off by default', () => {
    const store = useConsciousnessSettingsStore()

    expect(store.reasoning).toBe(false)
  })

  it('turns stage act off by default', () => {
    const store = useConsciousnessSettingsStore()

    expect(store.stageActEnabled).toBe(false)
  })

  it('turns compact requests off by default', () => {
    const store = useConsciousnessSettingsStore()

    expect(store.compactRequests).toBe(false)
    expect(store.compactRequestsAuto).toBe(false)
  })

  it('enables compact requests from a limit error', async () => {
    const store = useConsciousnessSettingsStore()
    await store.enableCompactRequestsFromLimitError()

    expect(store.compactRequests).toBe(true)
    expect(store.compactRequestsAuto).toBe(true)
    expect(localStorage.getItem('settings/consciousness/compact-requests')).toBe('true')
  })

  it('loads the persisted value', () => {
    localStorage.setItem('settings/consciousness/reasoning', 'true')
    const store = useConsciousnessSettingsStore()

    expect(store.reasoning).toBe(true)
  })

  it('persists changes through store actions', async () => {
    const store = useConsciousnessSettingsStore()
    await store.setReasoning(true)

    expect(store.reasoning).toBe(true)
    expect(localStorage.getItem('settings/consciousness/reasoning')).toBe('true')

    await store.resetState()

    expect(store.reasoning).toBe(false)
    expect(localStorage.getItem('settings/consciousness/reasoning')).toBe('false')
  })

  it('ignores storage events because Pinia owns cross-window synchronization', () => {
    const store = useConsciousnessSettingsStore()

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'settings/consciousness/reasoning',
      newValue: 'true',
    }))

    expect(store.reasoning).toBe(false)
  })
})
