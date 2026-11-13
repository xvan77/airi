<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { Callout } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const providerId = 'index-tts-vllm'
const defaultModel = 'IndexTTS-1.5'
</script>

<template>
  <SpeechProviderSettings :provider-id="providerId" :default-model="defaultModel" hide-api-key>
    <template #basic-settings>
      <Callout
        theme="violet"
        :label="t('settings.pages.providers.provider.index-tts-vllm.callout_engine_title')"
      >
        {{ t('settings.pages.providers.provider.index-tts-vllm.callout_engine') }}
      </Callout>
      <Callout
        theme="violet"
        :label="t('settings.pages.providers.provider.index-tts-vllm.callout_indextts2_unavailable_title')"
      >
        {{ t('settings.pages.providers.provider.index-tts-vllm.callout_indextts2_unavailable') }}
      </Callout>
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
