import type {} from 'pinia-plugin-synced'

import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

function loadEnabled(key: string) {
  // Non-renderer runtimes have no durable settings owner. They use the product
  // default until a synchronized renderer snapshot arrives.
  if (typeof localStorage === 'undefined')
    return false

  return localStorage.getItem(`settings/consciousness/${key}`) === 'true'
}

function persistEnabled(key: string, value: boolean) {
  if (typeof localStorage === 'undefined')
    return

  localStorage.setItem(`settings/consciousness/${key}`, String(value))
}

/**
 * Stores request policies for the consciousness module.
 *
 * Consciousness chat request preparation reads this state before inference.
 * Each provider maps the reasoning value to its own request fields.
 */
export const useConsciousnessSettingsStore = defineStore('consciousness-settings', () => {
  // Pinia owns live cross-window state. Only synchronized actions write the
  // durable value, so a follower cannot persist an uncommitted proposal.
  const reasoning = shallowRef(loadEnabled('reasoning'))
  /** Stage ACT and runtime emotion tokens in chat. Off by default to keep requests small. */
  const stageActEnabled = shallowRef(loadEnabled('stage-act-enabled'))
  /** Drops format rules, toolset prompts, and idle memory tools to shrink provider requests. */
  const compactRequests = shallowRef(loadEnabled('compact-requests'))
  /** True when compact requests turned on after a payload limit error. */
  const compactRequestsAuto = shallowRef(loadEnabled('compact-requests-auto'))
  const temperatureEnabled = shallowRef(loadEnabled('temperature-enabled'))
  const topPEnabled = shallowRef(loadEnabled('top-p-enabled'))

  async function setReasoning(value: boolean) {
    reasoning.value = value
    persistEnabled('reasoning', value)
  }

  async function setStageActEnabled(value: boolean) {
    stageActEnabled.value = value
    persistEnabled('stage-act-enabled', value)
  }

  async function setCompactRequests(value: boolean) {
    compactRequests.value = value
    persistEnabled('compact-requests', value)
    if (!value) {
      compactRequestsAuto.value = false
      persistEnabled('compact-requests-auto', false)
    }
  }

  async function enableCompactRequestsFromLimitError() {
    if (compactRequests.value)
      return
    compactRequests.value = true
    compactRequestsAuto.value = true
    persistEnabled('compact-requests', true)
    persistEnabled('compact-requests-auto', true)
  }

  async function setTemperatureEnabled(value: boolean) {
    temperatureEnabled.value = value
    persistEnabled('temperature-enabled', value)
  }

  async function setTopPEnabled(value: boolean) {
    topPEnabled.value = value
    persistEnabled('top-p-enabled', value)
  }

  async function resetState() {
    await setReasoning(false)
    await setStageActEnabled(false)
    await setCompactRequests(false)
    await setTemperatureEnabled(false)
    await setTopPEnabled(false)
  }

  return {
    reasoning,
    stageActEnabled,
    compactRequests,
    compactRequestsAuto,
    temperatureEnabled,
    topPEnabled,
    setReasoning,
    setStageActEnabled,
    setCompactRequests,
    enableCompactRequestsFromLimitError,
    setTemperatureEnabled,
    setTopPEnabled,
    resetState,
  }
}, {
  synced: {
    actions: ['resetState', 'setReasoning', 'setStageActEnabled', 'setCompactRequests', 'enableCompactRequestsFromLimitError', 'setTemperatureEnabled', 'setTopPEnabled'],
    state: true,
  },
})
