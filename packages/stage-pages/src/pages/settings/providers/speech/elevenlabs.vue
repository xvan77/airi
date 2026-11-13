<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCheckbox, FieldRange } from '@proj-airi/ui'
import { watchDebounced } from '@vueuse/core'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const providerId = 'elevenlabs'
const defaultModel = 'eleven_multilingual_v2'

// Default voice settings specific to ElevenLabs
const defaultVoiceSettings = {
  similarityBoost: 0.75,
  stability: 0.5,
  speed: 1.0,
  style: 0,
  useSpeakerBoost: true,
}

const style = ref<number>(0)
const stability = ref<number>(0.5)
const similarityBoost = ref<number>(0.75)
const useSpeakerBoost = ref<boolean>(false)

const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { configs: providers } = storeToRefs(providerStore)
const { t } = useI18n()

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

watch(style, async () => {
  const providerConfig = providerStore.getProviderConfig(providerId)
  providerConfig.style = style.value
})

watch(stability, async () => {
  const providerConfig = providerStore.getProviderConfig(providerId)
  providerConfig.stability = stability.value
})

watch(similarityBoost, async () => {
  const providerConfig = providerStore.getProviderConfig(providerId)
  providerConfig.similarityBoost = similarityBoost.value
})

watch(useSpeakerBoost, async () => {
  const providerConfig = providerStore.getProviderConfig(providerId)
  providerConfig.useSpeakerBoost = useSpeakerBoost.value
})

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
    :additional-settings="defaultVoiceSettings"
  >
    <!-- Voice settings specific to ElevenLabs -->
    <template #advanced-settings>
      <div flex="~ col gap-4">
        <FieldRange
          v-model="style"
          :label="t('settings.pages.providers.provider.elevenlabs.fields.field.style.label')"
          :description="t('settings.pages.providers.provider.elevenlabs.fields.field.style.description')"
          :min="0"
          :max="1" :step="0.01"
        />

        <!-- Stability control - specific to ElevenLabs -->
        <FieldRange
          v-model="stability"
          :label="t('settings.pages.providers.provider.elevenlabs.fields.field.stability.label')"
          :description="t('settings.pages.providers.provider.elevenlabs.fields.field.stability.description')"
          :min="0"
          :max="1" :step="0.01"
        />

        <!-- Similarity Boost control - specific to ElevenLabs -->
        <FieldRange
          v-model="similarityBoost"
          :label="t('settings.pages.providers.provider.elevenlabs.fields.field.simularity-boost.label')"
          :description="t('settings.pages.providers.provider.elevenlabs.fields.field.simularity-boost.description')"
          :min="0"
          :max="1" :step="0.01"
        />

        <!-- Speaker Boost checkbox - specific to ElevenLabs -->
        <FieldCheckbox
          v-model="useSpeakerBoost"
          :label="t('settings.pages.providers.provider.elevenlabs.fields.field.speaker-boost.label')"
          :description="t('settings.pages.providers.provider.elevenlabs.fields.field.speaker-boost.description')"
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
