<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const providerId = 'microsoft-speech'
const defaultModel = 'v1'

// Default voice settings specific to Microsoft Speech
const defaultVoiceSettings = {
  pitch: 0,
  speed: 1.0,
  volume: 0,
}

const speechStore = useSpeechStore()
const { configs: providers } = storeToRefs(useProviderConfigStore())

const region = computed({
  get: () => providers.value[providerId]?.region as string | undefined || 'eastasia',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = { region: 'eastasia' }

    providers.value[providerId].region = value
  },
})

const apiKeyConfigured = computed(() => !!providers.value[providerId]?.apiKey)

onMounted(async () => {
  if (!region.value)
    region.value = 'eastasia'
  if (!providers.value[providerId]?.region) {
    if (!providers.value[providerId])
      providers.value[providerId] = { region: region.value }
    else
      providers.value[providerId].region = region.value
  }

  await speechStore.loadVoicesForProvider(providerId)
})

watch([apiKeyConfigured, region], async () => {
  await speechStore.loadVoicesForProvider(providerId)
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
  >
    <!-- Basic settings specific to Microsoft Speech -->
    <template #basic-settings>
      <FieldInput
        v-model="region"
        :label="t('settings.pages.providers.provider.microsoft-speech.fields.field.region.label')"
        :description="t('settings.pages.providers.provider.microsoft-speech.fields.field.region.description')"
        placeholder="eastasia"
        required
        type="text"
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
