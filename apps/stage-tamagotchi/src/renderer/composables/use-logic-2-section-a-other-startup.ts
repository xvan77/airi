import type { Ref } from 'vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { waitForLocalLlmServerReady } from '@proj-airi/stage-shared'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useConsciousnessSettingsStore } from '@proj-airi/stage-ui/stores/modules/consciousness-settings'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { electronLocalLlmStartServer, electronShowChatWindow } from '../../shared/eventa'

/** How long auto-start waits for llama-server to accept /v1/models after spawn. */
const LOCAL_LLM_AUTO_START_READY_TIMEOUT_MS = 120_000

/**
 * LOGIC 2 §A.4 OTHER: open chat on cold start (when onboarding is done) and
 * start the local LLM server when that provider stayed active from the last session.
 */
export function useLogic2SectionAOtherStartup(stageReady: Ref<boolean>) {
  const onboardingStore = useOnboardingStore()
  const consciousnessStore = useConsciousnessStore()
  const consciousnessSettingsStore = useConsciousnessSettingsStore()
  const providersStore = useProviderStore()
  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const showChatWindow = useElectronEventaInvoke(electronShowChatWindow)
  const startLocalLlmServer = useElectronEventaInvoke(electronLocalLlmStartServer)

  let ran = false

  watch(
    () => [stageReady.value, onboardingStore.needsOnboarding] as const,
    ([ready, needsOnboarding]) => {
      if (ran || !ready || needsOnboarding)
        return
      ran = true
      void runStartup()
    },
    { immediate: true },
  )

  async function openChatWhenReady() {
    try {
      await showChatWindow()
    }
    catch (error) {
      console.error('[Stage] Failed to open chat on startup.', error)
    }
  }

  async function runStartup() {
    await openChatWhenReady()

    if (activeProvider.value === 'local-llm')
      await consciousnessSettingsStore.ensureCompactRequestsForOnDeviceProvider('local-llm')

    if (activeProvider.value !== 'local-llm' || !activeModel.value)
      return

    try {
      await startLocalLlmServer({ modelId: activeModel.value })
      const ready = await waitForLocalLlmServerReady({ timeoutMs: LOCAL_LLM_AUTO_START_READY_TIMEOUT_MS })
      if (!ready) {
        console.warn('[Stage] Local LLM server did not become ready before the auto-start timeout.')
        return
      }
      providersStore.forceProviderConfigured('local-llm')
      await providersStore.validateProvider('local-llm', { force: true })
    }
    catch (error) {
      console.error('[Stage] Failed to auto-start local LLM server.', error)
    }
  }
}
