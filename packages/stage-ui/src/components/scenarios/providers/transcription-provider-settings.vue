<script setup lang="ts">
import { computedAsync, useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  ProviderAdvancedSettings,
  ProviderApiKeyInput,
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderKindCallout,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  ProviderValidationAlerts,
} from '.'
import { useProviderSettingsPolicy } from '../../../composables/use-provider-settings-policy'
import { useProviderValidation } from '../../../composables/use-provider-validation'
import { selectProviderMetadata } from '../../../libs/providers/metadata'
import { useProviderConfigStore } from '../../../stores/providers/config'
import { useProviderStore } from '../../../stores/providers/provider'

const props = defineProps<{
  providerId: string
  defaultModel?: string
  additionalSettings?: Record<string, any>
  placeholder?: string
  hideApiKey?: boolean
  suppressValidationAlerts?: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const { configs: providers } = storeToRefs(providerStore)

const {
  isValidating,
  isValid,
  validationMessage,
  hasManualValidators,
  isManualTesting,
  manualTestPassed,
  manualTestMessage,
  manualTestProgressLines,
  runManualTest,
  cancelManualPing,
  skipToNextPingModel,
} = useProviderValidation(props.providerId)

const { showApiKey: policyShowApiKey, suppressValidationAlerts: policySuppressValidationAlerts } = useProviderSettingsPolicy(props.providerId)

const showApiKeyField = computed(() => !props.hideApiKey && policyShowApiKey.value)
const showValidationAlerts = computed(() => !props.suppressValidationAlerts && !policySuppressValidationAlerts.value)

const providerMetadata = computedAsync(async () => {
  const definition = providersStore.getProviderDefinition(props.providerId)
  return await selectProviderMetadata(definition, t, { id: props.providerId })
}, undefined)

const apiKey = computed({
  get: () => providers.value[props.providerId]?.apiKey as string | undefined || '',
  set: (value) => {
    if (!providers.value[props.providerId])
      providers.value[props.providerId] = {}

    providers.value[props.providerId].apiKey = value
  },
})

const baseUrl = computed({
  get: () => providers.value[props.providerId]?.baseUrl as string | undefined
    || providerMetadata.value?.defaultConfig.baseUrl as string | undefined
    || '',
  set: (value) => {
    if (!providers.value[props.providerId])
      providers.value[props.providerId] = {}

    providers.value[props.providerId].baseUrl = value
  },
})

const debouncedPatch = useDebounceFn((patch: Record<string, unknown>) => {
  void providerStore.patchProviderConfig(props.providerId, patch)
}, 500)

watch(apiKey, (value) => {
  if (showApiKeyField.value)
    void debouncedPatch({ apiKey: value })
})

watch(baseUrl, (value) => {
  void debouncedPatch({
    baseUrl: value || providerMetadata.value?.defaultConfig.baseUrl || '',
  })
})

onMounted(async () => {
  await providersStore.initializeProvider(props.providerId)
})

function handleResetTranscriptionSettings() {
  apiKey.value = ''
  baseUrl.value = providerMetadata.value?.defaultConfig.baseUrl as string | undefined || ''
}

function goToHearingSelection() {
  router.push({ path: '/settings/modules/hearing/transcriber', query: { browse: props.providerId } })
}
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName ?? ''"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :on-back="() => router.back()"
  >
    <div flex="~ col md:row gap-6">
      <ProviderSettingsContainer class="w-full md:w-[40%]">
        <ProviderBasicSettings
          :title="t('settings.pages.providers.common.section.basic.title')"
          :description="t('settings.pages.providers.common.section.basic.description')"
          :on-reset="handleResetTranscriptionSettings"
        >
          <ProviderKindCallout :provider-id="props.providerId" />
          <ProviderApiKeyInput
            v-if="showApiKeyField"
            v-model="apiKey"
            :provider-name="providerMetadata?.localizedName ?? ''"
            :placeholder="props.placeholder || 'API Key'"
          />
          <slot name="basic-settings" />
        </ProviderBasicSettings>

        <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
          <ProviderBaseUrlInput
            v-model="baseUrl"
            :placeholder="providerMetadata?.defaultConfig.baseUrl as string || ''"
            required
          />
          <slot name="advanced-settings" />
        </ProviderAdvancedSettings>

        <ProviderValidationAlerts
          v-if="showValidationAlerts"
          :is-valid="isValid"
          :is-validating="isValidating"
          :validation-message="validationMessage"
          :has-manual-validators="hasManualValidators"
          :is-manual-testing="isManualTesting"
          :manual-test-passed="manualTestPassed"
          :manual-test-message="manualTestMessage"
          :manual-test-progress-lines="manualTestProgressLines"
          :on-run-test="runManualTest"
          :on-go-to-model-selection="goToHearingSelection"
          :on-cancel-manual-ping="cancelManualPing"
          :on-skip-next-ping-model="skipToNextPingModel"
        />
      </ProviderSettingsContainer>

      <div flex="~ col gap-6" class="w-full md:w-[60%]">
        <div w-full rounded-xl>
          <slot name="playground" />
        </div>
      </div>
    </div>
  </ProviderSettingsLayout>
</template>
