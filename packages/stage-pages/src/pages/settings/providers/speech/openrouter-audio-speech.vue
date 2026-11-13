<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCombobox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const { configs: providers } = storeToRefs(useProviderConfigStore())

const providerId = 'openrouter-audio-speech'
const defaultModel = 'openai/gpt-audio-mini'

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

const providerModels = computed(() => providersStore.getModelsForProvider(providerId))
const isLoadingModels = computed(() => providersStore.isLoadingModels[providerId] || false)

onMounted(async () => {
  await providersStore.loadModelsForConfiguredProviders()
  await providersStore.fetchModelsForProvider(providerId)
  await speechStore.loadVoicesForProvider(providerId)
})
</script>

<template>
  <SpeechProviderSettings :provider-id="providerId" :default-model="defaultModel">
    <template #advanced-settings>
      <FieldCombobox
        v-model="model"
        label="Model"
        description="Select the audio-capable model to use for speech generation"
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
