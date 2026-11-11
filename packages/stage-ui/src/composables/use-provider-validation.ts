import type { ChatPingRunHandles, ProviderChatPingProgressEvent } from '@proj-airi/provider-inference'
import type { RemovableRef } from '@vueuse/core'

import type { ProviderMode } from './use-analytics'

import { errorMessageFrom } from '@moeru/std'
import { computedAsync, useDebounceFn } from '@vueuse/core'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { formatProviderPingFailureReason } from '../libs/provider-connection-error-message'
import { selectProviderMetadata } from '../libs/providers/metadata'
import { useProviderConfigStore } from '../stores/providers/config'
import { useProviderStore } from '../stores/providers/provider'
import { useAnalytics } from './use-analytics'

/**
 * Classifies provider ids into bounded analytics buckets.
 */
function providerModeForAnalytics(providerId: string): ProviderMode {
  if (!providerId)
    return 'unknown'

  return providerId.startsWith('official-provider') || providerId.startsWith('vision-official-provider')
    ? 'official'
    : 'custom'
}

export function useProviderValidation(providerId: string) {
  const { t } = useI18n()
  const router = useRouter()
  const providersStore = useProviderStore()
  const providerStore = useProviderConfigStore()
  const {
    trackProviderConnectionTestCompleted,
    trackProviderConnectionTestStarted,
  } = useAnalytics()
  const { configs: providers } = storeToRefs(providerStore) as { configs: RemovableRef<Record<string, any>> }

  const providerMetadata = computedAsync(async () => {
    const definition = providersStore.getProviderDefinition(providerId)
    return await selectProviderMetadata(definition, t, {
      id: providerId,
      configured: providerStore.getProvider(providerId)?.status === 'configured',
    })
  }, undefined)

  // --- Internal Computed Properties for Credentials ---
  const credentials = computed(() => providers.value[providerId] || {})

  const apiKey = computed({
    get: () => credentials.value.apiKey || '',
    set: (value) => {
      if (!providers.value[providerId])
        providers.value[providerId] = {}
      providers.value[providerId].apiKey = value
    },
  })

  const baseUrl = computed({
    get: () => credentials.value.baseUrl || '',
    set: (value) => {
      if (!providers.value[providerId])
        providers.value[providerId] = {}
      providers.value[providerId].baseUrl = value
    },
  })

  const accountId = computed({
    get: () => credentials.value.accountId || '',
    set: (value) => {
      if (!providers.value[providerId])
        providers.value[providerId] = {}
      providers.value[providerId].accountId = value
    },
  })
  // --- End of Internal Computed Properties ---

  const debounceTime = 500
  const isValidating = ref(0)
  const isValid = ref(false)
  const validationMessage = ref('')

  // Manual chat ping check state (settings pages only)
  const hasManualValidators = computedAsync(
    async () => await providersStore.hasManualProviderValidators(providerId),
    false,
  )
  const isManualTesting = ref(false)
  const manualTestPassed = ref(false)
  const manualTestMessage = ref('')
  const manualTestProgressLines = ref<string[]>([])
  const chatPingRunHandles = ref<ChatPingRunHandles | undefined>()

  function formatChatPingProgressLine(event: ProviderChatPingProgressEvent): string {
    switch (event.phase) {
      case 'start':
        return t('settings.dialogs.onboarding.chatPingStart')
      case 'try':
        return t('settings.dialogs.onboarding.chatPingTryingModel', {
          attempt: event.attempt,
          model: event.modelId ?? '',
        })
      case 'retry':
        if (event.userSkippedModel) {
          return t('settings.dialogs.onboarding.chatPingRetryUserSkipped', {
            model: event.modelId ?? '',
          })
        }
        return t('settings.dialogs.onboarding.chatPingRetryNextModel', {
          attempt: event.attempt + 1,
        })
      case 'success':
        return t('settings.dialogs.onboarding.chatPingSuccess', {
          model: event.modelId ?? '',
        })
      default:
        return ''
    }
  }

  function handleChatPingProgress(event: ProviderChatPingProgressEvent) {
    manualTestProgressLines.value = [...manualTestProgressLines.value, formatChatPingProgressLine(event)]
  }

  function cancelManualPing() {
    chatPingRunHandles.value?.runAbortController.abort()
  }

  function skipToNextPingModel() {
    chatPingRunHandles.value?.attemptAbortController.abort()
  }

  function providerConnectionTestAnalyticsBase() {
    return {
      provider_id: providerId,
      provider_mode: providerModeForAnalytics(providerId),
    }
  }

  /**
   * `validateProviderConfig` is a synchronized action. A follower renderer posts
   * its arguments over a BroadcastChannel.
   *
   * `structuredClone` rejects a Vue reactive proxy. A shallow copy keeps the
   * nested values as proxies, so this copy must be deep.
   */
  function configToValidate(): Record<string, any> {
    const config = cloneDeep(credentials.value)
    if (config.apiKey)
      config.apiKey = config.apiKey.trim()
    if (config.baseUrl)
      config.baseUrl = config.baseUrl.trim()

    return config
  }

  async function validateConfiguration() {
    if (!providerMetadata.value)
      return

    isValidating.value++
    validationMessage.value = ''
    const startValidationTimestamp = performance.now()
    let finalValidationMessage = ''

    try {
      // Settings pages always skip chat ping check during automatic validation
      // to avoid unexpected API billing. Users can trigger it manually.
      const validationResult = await providersStore.validateProviderConfig(providerId, configToValidate(), {
        skipChatPingCheck: true,
      })
      isValid.value = validationResult.valid

      const needsManualPing = await providersStore.hasManualProviderValidators(providerId)
      if (isValid.value && !needsManualPing) {
        providerStore.setProviderStatus(providerId, 'configured')
        providerStore.markProviderAdded(providerId)
      }
      else if (isValid.value && needsManualPing) {
        // Auto checks skip chat ping. Do not mark configured until Ping API succeeds.
        providerStore.setProviderStatus(providerId, 'invalid')
      }
      else {
        providerStore.setProviderStatus(providerId, 'invalid')
      }

      if (!isValid.value) {
        finalValidationMessage = formatProviderPingFailureReason(validationResult.reason, t)
      }
    }
    catch (error) {
      isValid.value = false
      providerStore.setProviderStatus(providerId, 'invalid')
      finalValidationMessage = t('settings.dialogs.onboarding.validationError', {
        error: errorMessageFrom(error) ?? 'Generic error (993b5ad7)',
      })
    }
    finally {
      setTimeout(() => {
        isValidating.value--
        validationMessage.value = finalValidationMessage
      }, Math.max(0, debounceTime - (performance.now() - startValidationTimestamp)))
    }
  }

  async function runManualTest() {
    if (!providerMetadata.value)
      return

    isManualTesting.value = true
    manualTestMessage.value = ''
    manualTestProgressLines.value = []
    chatPingRunHandles.value = {
      runAbortController: new AbortController(),
      attemptAbortController: new AbortController(),
    }
    const handles = chatPingRunHandles.value
    const startedAt = performance.now()
    trackProviderConnectionTestStarted(providerConnectionTestAnalyticsBase())

    try {
      const result = await providersStore.validateProviderConfigLocal(providerId, configToValidate(), {
        onlyChatPingCheck: true,
        onChatPingProgress: handleChatPingProgress,
        chatPingRunHandles: handles,
      })
      manualTestPassed.value = result.valid
      if (result.valid) {
        providerStore.setProviderStatus(providerId, 'configured')
        providerStore.markProviderAdded(providerId)
        trackProviderConnectionTestCompleted({
          ...providerConnectionTestAnalyticsBase(),
          duration_ms: Math.round(performance.now() - startedAt),
          success: true,
        })
      }
      else {
        if (handles.runAbortController.signal.aborted) {
          manualTestMessage.value = t('settings.dialogs.onboarding.chatPingCanceled')
          trackProviderConnectionTestCompleted({
            ...providerConnectionTestAnalyticsBase(),
            error_code: 'user_canceled',
            duration_ms: Math.round(performance.now() - startedAt),
            success: false,
          })
        }
        else {
          manualTestMessage.value = formatProviderPingFailureReason(result.reason, t)
          trackProviderConnectionTestCompleted({
            ...providerConnectionTestAnalyticsBase(),
            error_code: 'validation_failed',
            duration_ms: Math.round(performance.now() - startedAt),
            success: false,
          })
        }
        providerStore.setProviderStatus(providerId, 'invalid')
      }
    }
    catch (error) {
      manualTestPassed.value = false
      if (handles.runAbortController.signal.aborted) {
        manualTestMessage.value = t('settings.dialogs.onboarding.chatPingCanceled')
      }
      else {
        manualTestMessage.value = errorMessageFrom(error) ?? 'Generic error (e56ae24f)'
      }
      trackProviderConnectionTestCompleted({
        ...providerConnectionTestAnalyticsBase(),
        error_code: handles.runAbortController.signal.aborted ? 'user_canceled' : 'provider_error',
        duration_ms: Math.round(performance.now() - startedAt),
        success: false,
      })
    }
    finally {
      isManualTesting.value = false
      chatPingRunHandles.value = undefined
    }
  }

  async function shouldValidateConfiguration() {
    const definition = providersStore.getProviderDefinition(providerId)
    return await definition.validationRequiredWhen?.(credentials.value) ?? false
  }

  const debouncedValidateConfiguration = useDebounceFn(async () => {
    if (!await shouldValidateConfiguration()) {
      isValid.value = false
      providerStore.setProviderStatus(providerId, 'unconfigured')
      validationMessage.value = ''
      isValidating.value = 0
      return
    }
    validateConfiguration()
  }, debounceTime)

  onMounted(async () => {
    await providersStore.initializeProvider(providerId)
    if (await shouldValidateConfiguration()) {
      await validateConfiguration()
    }
  })

  // The synced config store re-applies fresh object snapshots (new references,
  // identical content) after every synced action. Watching a serialized signature
  // instead of the deep object prevents equivalent snapshots from re-triggering
  // validation, which would otherwise loop with markProviderAdded().
  const credentialsSignature = computed(() => JSON.stringify(credentials.value))

  watch(credentialsSignature, () => {
    debouncedValidateConfiguration()
    // Reset manual test state when credentials actually change
    manualTestPassed.value = false
    manualTestMessage.value = ''
    manualTestProgressLines.value = []
  })

  function handleResetSettings() {
    const defaultOptions = providerMetadata.value?.defaultConfig ?? {}
    providers.value[providerId] = { ...defaultOptions }
    isValid.value = false
    validationMessage.value = ''
    isValidating.value = 0
    manualTestPassed.value = false
    manualTestMessage.value = ''
  }

  function forceValid() {
    if (hasManualValidators.value)
      return

    isValid.value = true
    validationMessage.value = ''
    manualTestPassed.value = true
    manualTestMessage.value = ''
    manualTestProgressLines.value = []
    providersStore.forceProviderConfigured(providerId)
  }

  return {
    t,
    router,
    providerMetadata,
    apiKey,
    baseUrl,
    accountId,
    isValidating,
    isValid,
    validationMessage,
    handleResetSettings,
    forceValid,
    // Manual test generation
    hasManualValidators,
    isManualTesting,
    manualTestPassed,
    manualTestMessage,
    manualTestProgressLines,
    runManualTest,
    cancelManualPing,
    skipToNextPingModel,
  }
}
