<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { Callout } from '@proj-airi/ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SpeechProviderSettings from './speech-provider-settings.vue'

import { useSpeechStore } from '../../../stores/modules/speech'
import { useProviderConfigStore } from '../../../stores/providers/config'

const props = defineProps<{
  providerId: string
}>()

const { t } = useI18n()
const speechStore = useSpeechStore()
const providerStore = useProviderConfigStore()

// Only the browser surface negotiates the CORS policy of the engine. The
// desktop application forwards its requests through the Electron main process,
// which that policy does not restrict.
const showOriginCallout = computed(() => !isStageTamagotchi())

// SpeechProviderSettings loads the catalogue on mount, but only for a
// `configured` provider. Validation can finish after that mount, so this
// watcher fills the list when the engine becomes reachable.
watch(() => providerStore.configuredProviders[props.providerId], async (configured) => {
  if (configured)
    await speechStore.loadVoicesForProvider(props.providerId)
})
</script>

<template>
  <SpeechProviderSettings :provider-id="props.providerId" default-model="default" hide-api-key>
    <!-- The Advanced section starts collapsed. An unreachable engine leaves the
         voice list empty, so its reason has to stay visible under Basic. -->
    <template #basic-settings>
      <Callout
        v-if="showOriginCallout"
        theme="violet"
        :label="t(`settings.pages.providers.provider.${props.providerId}.callout_origin_title`)"
      >
        {{ t(`settings.pages.providers.provider.${props.providerId}.callout_origin`) }}
      </Callout>
    </template>
  </SpeechProviderSettings>
</template>
