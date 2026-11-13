<script setup lang="ts">
import {
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { Callout } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

const providerId = 'player2-speech'
const defaultModel = 'v1'
const { t } = useI18n()
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    hide-api-key
  >
    <template #basic-settings>
      <Callout
        theme="violet"
        :label="t('settings.pages.providers.provider.player2.callout_engine_title')"
      >
        {{ t('settings.pages.providers.provider.player2.callout_engine') }}
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
