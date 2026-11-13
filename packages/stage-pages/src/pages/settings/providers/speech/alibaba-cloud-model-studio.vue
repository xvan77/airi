<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { watchDebounced } from '@vueuse/core'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'

const providerId = 'alibaba-cloud-model-studio'
const defaultModel = 'cosyvoice-v1'

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { configs: providers } = storeToRefs(providerStore)

async function loadVoicesWhenConfigured() {
  const providerConfig = providerStore.getProviderConfig(providerId)
  const configSnapshot = cloneDeep(providerConfig)
  if ((await providersStore.validateProviderConfig(providerId, configSnapshot)).valid)
    await speechStore.loadVoicesForProvider(providerId)
  else
    console.error('Failed to validate provider config', providerConfig)
}

watchDebounced([
  () => providers.value[providerId]?.apiKey,
  () => providers.value[providerId]?.baseUrl,
], loadVoicesWhenConfigured, {
  debounce: 500,
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
    stageTransition:
      name: slide
</route>
