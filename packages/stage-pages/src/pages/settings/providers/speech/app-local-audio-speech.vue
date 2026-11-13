<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { onMounted } from 'vue'

const providerId = 'app-local-audio-speech'
const defaultModel = 'system-native-tts'
const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()

onMounted(async () => {
  await providersStore.fetchModelsForProvider(providerId)
  const config = providerStore.getProviderConfig(providerId)
  if (!config.model)
    config.model = defaultModel
  await speechStore.loadVoicesForProvider(providerId)
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  />
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
