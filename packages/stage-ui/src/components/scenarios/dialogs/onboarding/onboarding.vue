<script setup lang="ts">
import type { ProviderMode } from '../../../../composables/use-analytics'
import type { ProviderMetadata } from '../../../../libs/providers/metadata'
import type {
  OnboardingSetupMode,
  OnboardingStep,
  OnboardingStepGuard,
  OnboardingStepNextHandler,
  ProviderConfigData,
} from './types'

import { isCustomProvidersDisabled, isStageTamagotchi } from '@proj-airi/stage-shared'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import StepLocalChatTtsOffer from './step-local-chat-tts-offer.vue'
import StepLocalLlmSetup from './step-local-llm-setup.vue'
import StepModelSelection from './step-model-selection.vue'
import StepProviderConfiguration from './step-provider-configuration.vue'
import StepProviderSelection from './step-provider-selection.vue'
import StepWelcome from './step-welcome.vue'

import { useAnalytics } from '../../../../composables/use-analytics'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../stores/modules/consciousness'
import { useSpeechStore } from '../../../../stores/modules/speech'
import { useProviderConfigStore } from '../../../../stores/providers/config'
import { useProviderStore } from '../../../../stores/providers/provider'

const props = withDefaults(defineProps<{
  extraSteps?: OnboardingStep[]
}>(), {
  extraSteps: () => [],
})

const emit = defineEmits<Emits>()

const LOCAL_SPEECH_PROVIDER_ID = 'app-local-audio-speech'
const LOCAL_SPEECH_MODEL_ID = 'system-native-tts'

interface Emits {
  (e: 'configured'): void
  (e: 'skipped'): void
}

const step = ref(0)
const direction = ref<'next' | 'previous'>('next')
const pendingProviderConfig = ref<ProviderConfigData | null>(null)
const setupMode = ref<OnboardingSetupMode>(isStageTamagotchi() ? 'local' : 'custom')
const enableLocalTtsAfterOnboarding = ref(false)
const { trackOnboardingCompleted, trackOnboardingStarted, trackOnboardingStepCompleted } = useAnalytics()

const providersStore = useProviderStore()

const providerStore = useProviderConfigStore()
const { allChatProvidersMetadata } = storeToRefs(providersStore)
const airiCardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const {
  activeProvider,
  activeModel,
} = storeToRefs(consciousnessStore)
const { activeSpeechVoiceId } = storeToRefs(speechStore)

// Popular providers for first-time setup
const popularProviders = computed(() => {
  const popular = ['openai', 'azure-openai', 'anthropic', 'amazon-bedrock', 'google-generative-ai', 'groq', 'nvidia', 'openrouter-ai', 'ollama', 'deepseek', 'player2', 'openai-compatible']
  return allChatProvidersMetadata.value
    .filter(provider => popular.includes(provider.id))
    .sort((a, b) => popular.indexOf(a.id) - popular.indexOf(b.id))
})

// Selected provider and form data
const selectedProviderId = ref('')

// Computed selected provider
const selectedProvider = computed(() => {
  return allChatProvidersMetadata.value.find(p => p.id === selectedProviderId.value) || null
})

const selectedProviderType = computed<ProviderMode>(() => {
  if (!selectedProviderId.value)
    return 'unknown'
  return selectedProviderId.value.startsWith('official-provider') ? 'official' : 'custom'
})

// Reset validation state when provider changes
function selectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
}

const requestNextStep: OnboardingStepNextHandler = async (configData?: ProviderConfigData) => {
  pendingProviderConfig.value = configData ?? null
  await navigateNext()
}

async function saveProviderConfiguration(data: ProviderConfigData) {
  if (!selectedProvider.value)
    return

  const config: Record<string, unknown> = {}

  if (data.apiKey)
    config.apiKey = data.apiKey.trim()
  if (data.baseUrl)
    config.baseUrl = data.baseUrl.trim()
  if (data.accountId)
    config.accountId = data.accountId.trim()
  if (data.customFields) {
    for (const [key, value] of Object.entries(data.customFields)) {
      if (value)
        config[key] = value.trim()
    }
  }

  // Provider configuration is leader-owned synchronized state. Route the save
  // through synced actions so the leader persists it and replicates it back;
  // the `configs` computed projection discards direct writes on recompute.
  await providersStore.initializeProvider(selectedProvider.value.id)
  await providerStore.patchProviderConfig(selectedProvider.value.id, config)
  await providersStore.forceProviderConfigured(selectedProvider.value.id)

  activeProvider.value = selectedProvider.value.id

  try {
    await consciousnessStore.loadModelsForProvider(selectedProvider.value.id)
  }
  catch (err) {
    console.error('[onboarding] Failed to load models for provider:', err)
  }
}

async function finalizeLocalLlmProvider() {
  const providerId = 'local-llm'
  await providersStore.initializeProvider(providerId)
  await providersStore.forceProviderConfigured(providerId)
}

async function enableLocalSpeechProvider() {
  if (!isStageTamagotchi())
    return

  await providersStore.initializeProvider(LOCAL_SPEECH_PROVIDER_ID)
  await providersStore.forceProviderConfigured(LOCAL_SPEECH_PROVIDER_ID)
  await speechStore.selectProviderModel(LOCAL_SPEECH_PROVIDER_ID, LOCAL_SPEECH_MODEL_ID, '')
  const voices = await speechStore.loadVoicesForProvider(LOCAL_SPEECH_PROVIDER_ID, LOCAL_SPEECH_MODEL_ID)
  const defaultVoiceId = voices[0]?.id
  if (defaultVoiceId)
    await speechStore.selectProviderModel(LOCAL_SPEECH_PROVIDER_ID, LOCAL_SPEECH_MODEL_ID, defaultVoiceId)
}

async function persistActiveCardModuleSelections() {
  if (!activeProvider.value || !activeModel.value)
    return

  await airiCardStore.updateActiveCardConsciousness({
    provider: activeProvider.value,
    model: activeModel.value,
  })

  if (setupMode.value === 'local' && enableLocalTtsAfterOnboarding.value) {
    await airiCardStore.updateActiveCardSpeech({
      provider: LOCAL_SPEECH_PROVIDER_ID,
      model: LOCAL_SPEECH_MODEL_ID,
      voice_id: activeSpeechVoiceId.value,
    })
  }
}

const allSteps = computed<OnboardingStep[]>(() => {
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      component: StepWelcome,
      props: () => ({
        customProviderSetupEnabled: !isCustomProvidersDisabled(),
        localSetupEnabled: isStageTamagotchi(),
        onStartSetup: (mode: OnboardingSetupMode) => {
          setupMode.value = mode
        },
      }),
    },
  ]

  if (isStageTamagotchi() && setupMode.value === 'local') {
    steps.push(
      {
        id: 'local-llm-setup',
        component: StepLocalLlmSetup,
        beforeNext: async () => {
          await finalizeLocalLlmProvider()
          return true
        },
      },
      {
        id: 'local-chat-tts-offer',
        component: StepLocalChatTtsOffer,
        props: () => ({
          onChooseLocalTts: (enable: boolean) => {
            enableLocalTtsAfterOnboarding.value = enable
          },
        }),
        beforeNext: async () => {
          if (enableLocalTtsAfterOnboarding.value)
            await enableLocalSpeechProvider()
          return true
        },
      },
    )
  }
  else {
    steps.push(
      {
        id: 'provider-selection',
        component: StepProviderSelection,
        props: () => ({
          selectedProviderId: selectedProviderId.value,
          popularProviders: popularProviders.value,
          onSelectProvider: selectProvider,
        }),
      },
      {
        id: 'provider-configuration',
        component: StepProviderConfiguration,
        props: () => ({
          selectedProviderId: selectedProviderId.value,
          selectedProvider: selectedProvider.value,
        }),
        beforeNext: async () => {
          if (!pendingProviderConfig.value)
            return false

          await saveProviderConfiguration(pendingProviderConfig.value)
          pendingProviderConfig.value = null
          return true
        },
      },
      ...props.extraSteps.map(extraStep => ({
        ...extraStep,
        props: () => ({
          ...extraStep.props?.(),
        }),
      })),
      {
        id: 'model-selection',
        component: StepModelSelection,
      },
    )
  }

  return steps
})

const currentStep = computed(() => allSteps.value[step.value] ?? null)
const isLastStep = computed(() => step.value === allSteps.value.length - 1)
const currentStepProps = computed(() => currentStep.value?.props?.() ?? {})

async function handleSave() {
  trackOnboardingStepCompleted(currentStep.value?.id ?? 'unknown')
  trackOnboardingCompleted({
    selected_provider_type: setupMode.value === 'local' ? 'custom' : selectedProviderType.value,
    selected_provider_id: setupMode.value === 'local' ? 'local-llm' : (selectedProviderId.value || undefined),
    selected_use_case: setupMode.value === 'local' ? 'local_offline' : 'custom_provider',
  })
  await persistActiveCardModuleSelections()
  emit('configured')
}

async function canPassGuard(guard?: OnboardingStepGuard) {
  if (!guard)
    return true

  return await guard()
}

async function navigateNext() {
  if (!currentStep.value)
    return

  if (!(await canPassGuard(currentStep.value.beforeNext)))
    return

  if (isLastStep.value) {
    await handleSave()
    return
  }

  trackOnboardingStepCompleted(currentStep.value.id)
  direction.value = 'next'
  step.value++
}

async function navigatePrevious() {
  if (!currentStep.value || step.value <= 0)
    return

  if (!(await canPassGuard(currentStep.value.beforePrev)))
    return

  direction.value = 'previous'
  step.value--
}

onMounted(() => {
  trackOnboardingStarted({ entry: 'app_start' })
})
</script>

<template>
  <div class="onboarding-step-container" min-h-0 flex flex-1 flex-col>
    <Transition :name="direction === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
      <component
        :is="currentStep.component"
        v-if="currentStep"
        :key="currentStep.id"
        class="flex flex-1 flex-col"
        v-bind="currentStepProps"
        :on-next="requestNextStep"
        :on-previous="navigatePrevious"
      />
    </Transition>
  </div>
</template>

<style scoped>
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  will-change: transform, opacity;
}

.slide-next-enter-active {
  animation: onboarding-slide-next-in 0.2s ease-in-out both;
}

.slide-next-leave-active {
  animation: onboarding-slide-next-out 0.2s ease-in-out both;
}

.slide-prev-enter-active {
  animation: onboarding-slide-prev-in 0.2s ease-in-out both;
}

.slide-prev-leave-active {
  animation: onboarding-slide-prev-out 0.2s ease-in-out both;
}

@keyframes onboarding-slide-next-in {
  from {
    transform: translateX(2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-next-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(-2rem);
    opacity: 0;
  }
}

@keyframes onboarding-slide-prev-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-prev-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    animation-duration: 1ms;
  }
}
</style>
