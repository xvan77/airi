import type { Ref } from 'vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { electronLocalLlmStartServer, electronShowChatWindow } from '../../shared/eventa'

/**
 * LOGIC 2 §A.4 OTHER: open chat on cold start (when onboarding is done) and
 * start the local LLM server when that provider stayed active from the last session.
 */
export function useLogic2SectionAOtherStartup(stageReady: Ref<boolean>) {
  const onboardingStore = useOnboardingStore()
  const consciousnessStore = useConsciousnessStore()
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

  async function runStartup() {
    try {
      await showChatWindow()
    }
    catch (error) {
      console.error('[Stage] Failed to open chat on startup.', error)
    }

    if (activeProvider.value !== 'local-llm' || !activeModel.value)
      return

    try {
      await startLocalLlmServer({ modelId: activeModel.value })
      providersStore.forceProviderConfigured('local-llm')
      await providersStore.validateProvider('local-llm', { force: true })
    }
    catch (error) {
      console.error('[Stage] Failed to auto-start local LLM server.', error)
    }
  }
}
