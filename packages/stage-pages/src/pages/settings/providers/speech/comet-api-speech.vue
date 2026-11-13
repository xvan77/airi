<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'

const { configs: providers } = storeToRefs(useProviderConfigStore())

const defaultVoiceSettings = {
  speed: 1.0,
}

const providerId = 'comet-api-speech'
const defaultModel = 'tts'

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

watch(
  () => providers.value[providerId],
  (newConfig) => {
    if (newConfig) {
      if (!newConfig.model && model.value !== defaultModel)
        model.value = defaultModel
    }
    else {
      model.value = defaultModel
    }
  },
  { deep: true, immediate: true },
)

onMounted(() => {
  if (!providers.value[providerId])
    providers.value[providerId] = {}
  if (!providers.value[providerId].model)
    providers.value[providerId].model = defaultModel
  if (!providers.value[providerId].voice)
    providers.value[providerId].voice = 'alloy'
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
  >
    <template #advanced-settings>
      <FieldInput
        v-model="model"
        label="Model"
        description="Enter the TTS model to use for speech generation"
        placeholder="gpt-4o-mini-tts"
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
