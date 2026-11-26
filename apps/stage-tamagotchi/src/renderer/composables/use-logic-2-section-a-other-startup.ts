import type { Ref } from 'vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { electronLocalLlmStartServer, electronShowChatWindow } from '../../shared/eventa'

/**
 * LOGIC 2 §A.4 OTHER: open chat on cold start (when onboarding is done) and
 * start the local LLM server when that provider stayed active from the last session.
 *
 * Provider and model can hydrate after the stage is ready (synced Pinia, first
 * install apply). Chat opens once. Local LLM start retries when selection becomes ready.
 *
 * After local onboarding, the chosen GGUF is saved on the default character
 * profile. The live chat selection can still be empty on the next cold start.
 * Fall back to that saved first-install choice so the server still starts.
 */
export function useLogic2SectionAOtherStartup(stageReady: Ref<boolean>) {
  const onboardingStore = useOnboardingStore()
  const consciousnessStore = useConsciousnessStore()
  const airiCardStore = useAiriCardStore()
  const providersStore = useProviderStore()
  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const { ready: cardReady } = storeToRefs(airiCardStore)
  const showChatWindow = useElectronEventaInvoke(electronShowChatWindow)
  const startLocalLlmServer = useElectronEventaInvoke(electronLocalLlmStartServer)

  let chatOpened = false
  let localLlmStartInFlight: string | undefined
  let localLlmStartedForModel: string | undefined

  function resolveChatSelection(): { provider: string, model: string } {
    if (activeProvider.value === 'local-llm' && activeModel.value)
      return { provider: activeProvider.value, model: activeModel.value }

    const cardModules = airiCardStore.activeCard?.extensions?.airi?.modules?.consciousness
    if (cardModules?.provider === 'local-llm' && cardModules.model) {
      if (!activeProvider.value || !activeModel.value)
        consciousnessStore.commitChatSelection(cardModules.provider, cardModules.model)
      return { provider: cardModules.provider, model: cardModules.model }
    }

    return { provider: activeProvider.value, model: activeModel.value }
  }

  watch(
    () => [
      stageReady.value,
      onboardingStore.needsOnboarding,
      cardReady.value,
      activeProvider.value,
      activeModel.value,
      airiCardStore.activeCard?.extensions?.airi?.modules?.consciousness?.provider,
      airiCardStore.activeCard?.extensions?.airi?.modules?.consciousness?.model,
    ] as const,
    ([ready, needsOnboarding]) => {
      if (!ready || needsOnboarding)
        return
      const { provider, model } = resolveChatSelection()
      void ensureStartup(provider, model)
    },
    { immediate: true },
  )

  async function ensureStartup(provider: string, model: string) {
    if (!chatOpened) {
      chatOpened = true
      try {
        await showChatWindow()
      }
      catch (error) {
        chatOpened = false
        console.error('[Stage] Failed to open chat on startup.', error)
      }
    }

    if (provider !== 'local-llm' || !model)
      return
    if (localLlmStartedForModel === model || localLlmStartInFlight === model)
      return

    localLlmStartInFlight = model
    try {
      await startLocalLlmServer({ modelId: model })
      providersStore.forceProviderConfigured('local-llm')
      await providersStore.validateProvider('local-llm', { force: true })
      localLlmStartedForModel = model
    }
    catch (error) {
      console.error('[Stage] Failed to auto-start local LLM server.', error)
    }
    finally {
      if (localLlmStartInFlight === model)
        localLlmStartInFlight = undefined
    }
  }
}
