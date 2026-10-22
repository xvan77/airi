<script setup lang="ts">
import type { SpeechProvider } from '@xsai-ext/providers/utils'

import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const providerId = 'app-local-audio-speech'
const defaultModel = 'system-native-tts'
const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { t } = useI18n()

const availableVoices = computed(() => speechStore.availableVoices[providerId] || [])
const voicesLoading = ref(false)

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const provider = await providersStore.getProviderInstance(providerId) as SpeechProvider
  if (!provider)
    throw new Error('Failed to initialize speech provider')

  const config = providerStore.getProviderConfig(providerId)
  return speechStore.speech(provider, defaultModel, input, voiceId, { ...config })
}

onMounted(async () => {
  try {
    voicesLoading.value = true
    await providersStore.fetchModelsForProvider(providerId)
    const config = providerStore.getProviderConfig(providerId)
    if (!config.model)
      config.model = defaultModel
    await speechStore.loadVoicesForProvider(providerId)
  }
  finally {
    voicesLoading.value = false
  }
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="true"
        :voices-loading="voicesLoading"
        :default-text="t('settings.pages.providers.provider.app-local-audio-speech.playground.default-text')"
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.app-local-audio-speech.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.provider.app-local-audio-speech.description
  stageTransition:
    name: slide
</route>
