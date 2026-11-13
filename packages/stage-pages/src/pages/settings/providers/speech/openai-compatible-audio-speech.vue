<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { getDefinedProvider } from '@proj-airi/stage-ui/libs'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { FieldInput } from '@proj-airi/ui'
import { computedAsync } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { configs: providers } = storeToRefs(useProviderConfigStore())
const { t } = useI18n()

const defaultVoiceSettings = {
  speed: 1.0,
}

const providerId = 'openai-compatible-audio-speech'
const defaultModel = 'tts-1'
const defaultVoice = 'alloy'

const model = computed({
  get: () => {
    const raw = providers.value[providerId]?.model as string | undefined | null
    return raw ?? ''
  },
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
      const config = newConfig as Record<string, unknown>
      if (config.model == null && model.value !== defaultModel)
        model.value = defaultModel
    }
    else {
      model.value = defaultModel
    }
  },
  { deep: true, immediate: true },
)

onMounted(() => {
  providers.value[providerId] ??= {}
  providers.value[providerId].model ??= defaultModel
  providers.value[providerId].voice ??= defaultVoice
})

const apiKeyPlaceholder = computedAsync(async () => {
  const definition = getDefinedProvider(providerId)
  if (!definition?.createProviderConfig)
    return 'sk-...'

  const schema = await definition.createProviderConfig({ t }) as { shape?: (() => Record<string, { meta?: () => { placeholderLocalized?: string } }>) | Record<string, { meta?: () => { placeholderLocalized?: string } }> }
  const shape = typeof schema?.shape === 'function' ? schema.shape() : schema?.shape
  const apiKeySchema = shape?.apiKey
  if (!apiKeySchema)
    return 'sk-...'

  const meta = typeof apiKeySchema.meta === 'function' ? apiKeySchema.meta() : undefined
  return typeof meta?.placeholderLocalized === 'string' ? meta.placeholderLocalized : 'sk-...'
}, 'sk-...')
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
    :placeholder="apiKeyPlaceholder"
  >
    <template #advanced-settings>
      <FieldInput
        v-model="model"
        label="Model"
        description="Enter the TTS model to use for speech generation"
        placeholder="tts-1"
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
