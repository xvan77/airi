<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCombobox } from '@proj-airi/ui'
import { watchDebounced } from '@vueuse/core'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const providerId = 'minimax-speech'
const defaultModel = 'speech-2.8-hd'

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { configs: providers } = storeToRefs(providerStore)

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value: string) => {
    if (!providers.value[providerId])
      return
    providers.value[providerId].model = value
  },
})

const modelOptions = [
  { value: 'speech-2.8-hd', label: 'Speech 2.8 HD' },
  { value: 'speech-2.8-turbo', label: 'Speech 2.8 Turbo' },
]

async function loadVoicesWhenConfigured() {
  const providerConfig = providerStore.getProviderConfig(providerId)
  // Clone nested reactive values before the synchronized action sends its arguments.
  const configSnapshot = cloneDeep(providerConfig)
  if ((await providersStore.validateProviderConfig(providerId, configSnapshot)).valid) {
    await speechStore.loadVoicesForProvider(providerId)
  }
  else {
    console.error('Failed to validate provider config', providerConfig)
  }
}

// The page must load the catalog on mount. A saved key does not change after a
// reload, so a watcher without `immediate` never asks for the voices and the
// selector stays empty.
watchDebounced([
  () => providers.value[providerId]?.apiKey,
  () => providers.value[providerId]?.baseUrl,
], loadVoicesWhenConfigured, {
  debounce: 500,
  immediate: true,
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <template #advanced-settings>
      <FieldCombobox
        v-model="model"
        :options="modelOptions"
        :label="t('settings.pages.providers.provider.minimax-speech.fields.field.model.label')"
        :description="t('settings.pages.providers.provider.minimax-speech.fields.field.model.description')"
        :placeholder="t('settings.pages.providers.provider.minimax-speech.fields.field.model.placeholder')"
        layout="horizontal"
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
