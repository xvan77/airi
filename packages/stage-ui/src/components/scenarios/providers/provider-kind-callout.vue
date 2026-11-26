<script setup lang="ts">
import { Callout } from '@proj-airi/ui'
import { computedAsync } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  providerDefinitionIdForSettings,
  resolveProviderSettingsKind,
} from '../../../libs/provider-settings-kind'
import { selectProviderMetadata } from '../../../libs/providers/metadata'
import { useProviderConfigStore } from '../../../stores/providers/config'
import { useProviderStore } from '../../../stores/providers/provider'

const props = defineProps<{
  providerId: string
}>()

const { t, te } = useI18n()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()

const definitionId = computed(() => providerDefinitionIdForSettings(props.providerId))

const settingsKind = computedAsync(async () => {
  const definition = providersStore.getProviderDefinition(props.providerId)
  const stored = providerStore.configs[props.providerId] ?? {}
  const meta = await selectProviderMetadata(definition, t, { id: props.providerId })
  return resolveProviderSettingsKind(definition, { ...meta.defaultConfig, ...stored })
}, 'cloud' as const)

const callout = computed(() => {
  const id = definitionId.value
  const kind = settingsKind.value
  if (kind === 'cloud')
    return null

  const base = `settings.pages.providers.provider.${id}`
  const inAppTitle = `${base}.callout_in_app_title`
  const inAppBody = `${base}.callout_in_app`
  const engineTitle = `${base}.callout_engine_title`
  const engineBody = `${base}.callout_engine`

  if (kind === 'in-app' && te(inAppBody)) {
    return {
      label: te(inAppTitle) ? t(inAppTitle) : undefined,
      body: t(inAppBody),
    }
  }
  if (kind === 'external' && te(engineBody)) {
    return {
      label: te(engineTitle) ? t(engineTitle) : undefined,
      body: t(engineBody),
    }
  }
  return null
})
</script>

<template>
  <Callout
    v-if="callout"
    theme="violet"
    :label="callout.label"
  >
    {{ callout.body }}
  </Callout>
</template>
