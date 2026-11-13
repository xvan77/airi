<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldInput } from '@proj-airi/ui'
import { watchDebounced } from '@vueuse/core'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const providerId = 'volcengine'
const defaultModel = 'v1'

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { configs: providers } = storeToRefs(providerStore)
const { t } = useI18n()

// Additional settings specific to Volcengine (appId)
const appId = computed({
  get: () => (providers.value[providerId]?.app as any)?.appId as string | undefined || '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}

    providers.value[providerId].app = {
      appId: value,
    }
  },
})

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

watchDebounced([
  () => providers.value[providerId]?.apiKey,
  () => providers.value[providerId]?.baseUrl,
  appId,
], loadVoicesWhenConfigured, {
  debounce: 500,
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <!-- Voice settings specific to ElevenLabs -->
    <template #basic-settings>
      <div flex="~ col gap-4">
        <FieldInput
          v-model="appId"
          :label="t('settings.pages.providers.provider.volcengine.fields.field.appId.label')"
          :description="t('settings.pages.providers.provider.volcengine.fields.field.appId.description')"
          required
        />
      </div>
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
  </route>
