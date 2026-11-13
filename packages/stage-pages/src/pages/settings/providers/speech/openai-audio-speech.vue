<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCombobox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const { configs: providers } = storeToRefs(useProviderConfigStore())

const defaultVoiceSettings = {
  speed: 1.0,
}

const providerId = 'openai-audio-speech'
const defaultModel = 'gpt-4o-mini-tts'

// Model selection
const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

// Load models and voices
const providerModels = computed(() => {
  return providersStore.getModelsForProvider(providerId)
})

const isLoadingModels = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

onMounted(async () => {
  await providersStore.loadModelsForConfiguredProviders()
  await providersStore.fetchModelsForProvider(providerId)
  // OpenAI does not list voices over the API. The catalog is in provider metadata.
  await speechStore.loadVoicesForProvider(providerId)
})

watch(model, async () => {
  const providerConfig = useProviderConfigStore().getProviderConfig(providerId)
  providerConfig.model = model.value
  await speechStore.loadVoicesForProvider(providerId)
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
  >
    <!-- Voice settings specific to OpenAI -->
    <template #advanced-settings>
      <FieldCombobox
        v-model="model"
        label="Model"
        description="Select the TTS model to use for speech generation"
        :options="providerModels.map(m => ({ value: m.id, label: m.name }))"
        :disabled="isLoadingModels || providerModels.length === 0"
        placeholder="Select a model..."
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
  </route>
