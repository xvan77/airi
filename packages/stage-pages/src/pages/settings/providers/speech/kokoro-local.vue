<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { cloneDeep } from 'es-toolkit'
import { onMounted, ref } from 'vue'

const providerId = 'kokoro-local'
const defaultModel = 'kokoro-82m'
const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()

const voicesLoading = ref(false)

onMounted(async () => {
  try {
    voicesLoading.value = true
    await providersStore.fetchModelsForProvider(providerId)

    const config = providerStore.getProviderConfig(providerId)
    if (!config.model)
      config.model = defaultModel

    const configSnapshot = cloneDeep(config)
    const validationResult = await providersStore.validateProviderConfig(providerId, configSnapshot)
    if (validationResult.valid) {
      await providersStore.loadProviderModel(providerId, configSnapshot)
      await speechStore.loadVoicesForProvider(providerId)
    }
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
    hide-api-key
  />
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
