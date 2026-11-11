import type {} from 'pinia-plugin-synced'

import type {
  ModelCatalogDeploymentFilter,
  ModelCatalogPricingFilter,
  ModelCatalogSortDirection,
  ModelCatalogSortKey,
} from '../../libs/model-catalog'
import type { ModelInfo } from '../../libs/providers/types'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'

import {
  filterModelCatalogRows,
  prepareModelCatalogRows,
  sortModelCatalogRows,
} from '../../libs/model-catalog'
import { useAuthStore } from '../auth'
import { useProviderConfigStore } from '../providers/config'
import { useProviderStore } from '../providers/provider'
import { useConsciousnessSettingsStore } from './consciousness-settings'

export type ChatSetupBlocker = 'none' | 'provider-credentials' | 'select-model'

export const useConsciousnessStore = defineStore('consciousness', () => {
  const providersStore = useProviderStore()
  const providerConfigStore = useProviderConfigStore()
  const authStore = useAuthStore()
  const settingsStore = useConsciousnessSettingsStore()

  // Pinia synchronization owns live cross-window state. localStorage remains
  // durable persistence, but storage events must not reflect state back into
  // the store and publish another synchronized snapshot.
  const persistenceOptions = { listenToStorageChanges: false }

  // State
  const activeProvider = useLocalStorageManualReset<string>('settings/consciousness/active-provider', '', persistenceOptions)
  const activeModel = useLocalStorageManualReset<string>('settings/consciousness/active-model', '', persistenceOptions)
  const activeCustomModelName = useLocalStorageManualReset<string>('settings/consciousness/active-custom-model', '', persistenceOptions)
  /** Last model picked for each chat provider. Browsing another provider tab must not erase local selections. */
  const modelByProvider = useLocalStorageManualReset<Record<string, string>>('settings/consciousness/model-by-provider', {}, persistenceOptions)
  const expandedDescriptions = refManualReset<Record<string, boolean>>(() => ({}))
  const modelSearchQuery = refManualReset<string>('')
  const modelFilterPricing = refManualReset<ModelCatalogPricingFilter>('all')
  const modelFilterDeployment = refManualReset<ModelCatalogDeploymentFilter>('all')
  const modelSortKey = refManualReset<ModelCatalogSortKey>('default')
  const modelSortDirection = refManualReset<ModelCatalogSortDirection>('asc')

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.supportsModelListing(activeProvider.value)
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeProvider.value)
  })

  function isOpenRouterProvider(provider: string) {
    return providersStore.findProviderDefinition(provider)?.id === 'openrouter-ai'
  }

  const activeModelRequiresReasoning = computed(() => {
    return isOpenRouterProvider(activeProvider.value)
      && providerModels.value.find(model => model.id === activeModel.value)?.reasoning?.mandatory === true
  })

  const activeModelUsesProviderReasoningDefault = computed(() => {
    return isOpenRouterProvider(activeProvider.value)
      && !providerModels.value.some(model => model.id === activeModel.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeProvider.value] || null
  })

  const temperature = useLocalStorageManualReset<number>(
    'settings/consciousness/active-temperature',
    0.7,
    persistenceOptions,
  )

  const topP = useLocalStorageManualReset<number>(
    'settings/consciousness/active-top-p',
    1.0,
    persistenceOptions,
  )

  // Saved slider values do not imply consent to override provider defaults.
  // All request paths consume these projections; disabled fields stay undefined.
  const activeTemperature = computed(() => settingsStore.temperatureEnabled ? temperature.value : undefined)
  const activeTopP = computed(() => settingsStore.topPEnabled ? topP.value : undefined)

  function catalogRowsForModels(
    models: readonly ModelInfo[],
    diskSizeByModelId?: Readonly<Record<string, number>>,
    providerId: string = activeProvider.value,
  ) {
    const query = modelSearchQuery.value.toLowerCase().trim()
    const rows = sortModelCatalogRows(
      filterModelCatalogRows(
        prepareModelCatalogRows(models, {
          providerId,
          diskSizeByModelId,
        }),
        {
          pricing: modelFilterPricing.value,
          deployment: modelFilterDeployment.value,
        },
      ),
      modelSortKey.value,
      modelSortDirection.value,
    )

    if (!query)
      return rows

    return rows.filter(row =>
      row.model.name.toLowerCase().includes(query)
      || row.model.id.toLowerCase().includes(query)
      || (row.model.description && row.model.description.toLowerCase().includes(query)),
    )
  }

  const filteredModels = computed(() => catalogRowsForModels(providerModels.value).map(row => row.model))

  function catalogSelectItemsForModels(
    models: readonly ModelInfo[],
    diskSizeByModelId?: Readonly<Record<string, number>>,
    providerId?: string,
  ) {
    return catalogRowsForModels(models, diskSizeByModelId, providerId).map(row => ({
      id: row.model.id,
      name: row.model.name,
      description: row.model.description,
      deprecated: row.model.deprecated,
      badges: row.badges,
    }))
  }

  function rememberModelForProvider(provider: string, model: string) {
    if (!provider || !model)
      return
    if (modelByProvider.value[provider] === model)
      return
    modelByProvider.value = {
      ...modelByProvider.value,
      [provider]: model,
    }
  }

  function lastModelForProvider(provider: string) {
    return modelByProvider.value[provider] ?? ''
  }

  /**
   * Updates the provider and model that chat, cards, and runtime use.
   * Consciousness provider tabs must not assign `activeProvider` alone.
   */
  function commitChatSelection(provider: string, model: string) {
    const previousProvider = activeProvider.value
    const previousModel = activeModel.value
    if (previousProvider && previousModel && (previousProvider !== provider || previousModel !== model))
      rememberModelForProvider(previousProvider, previousModel)

    activeProvider.value = provider
    activeModel.value = model
    activeCustomModelName.value = ''

    if (provider && model)
      rememberModelForProvider(provider, model)
  }

  function resetModelSelection() {
    activeModel.reset()
    activeCustomModelName.reset()
    expandedDescriptions.reset()
    modelSearchQuery.reset()
    modelFilterPricing.reset()
    modelFilterDeployment.reset()
    modelSortKey.reset()
    modelSortDirection.reset()
  }

  async function loadModelsForProvider(provider: string) {
    if (providersStore.supportsModelListing(provider)) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }

  async function getModelsForProvider(provider: string) {
    if (providersStore.supportsModelListing(provider)) {
      return providersStore.getModelsForProvider(provider)
    }

    return []
  }

  /** Resolves a provider with the reasoning mode shared by every Consciousness input path. */
  async function getChatProviderInstance(provider: string) {
    const selectedModel = providerModels.value.find(model => model.id === activeModel.value)
    const useProviderReasoningDefault = provider === activeProvider.value
      && isOpenRouterProvider(provider)
      && (activeModelUsesProviderReasoningDefault.value || selectedModel?.reasoning?.mandatory === true)

    // OpenRouter applies the model default when reasoning is mandatory or unknown.
    if (useProviderReasoningDefault) {
      return providersStore.getChatProviderInstance(provider)
    }

    return providersStore.getChatProviderInstance(provider, {
      reasoning: settingsStore.reasoning ? 'enabled' : 'disabled',
    })
  }

  const configured = computed(() => {
    return !!activeProvider.value && !!activeModel.value
  })

  function isProviderReadyForChat(providerId: string) {
    if (!providerId)
      return false

    const definition = providersStore.findProviderDefinition(providerId)
    const stored = providerConfigStore.providers[providerId]

    if (definition?.requiresCredentials === false)
      return true

    if (!stored)
      return false

    if (stored.configuredBy === 'authentication')
      return stored.status === 'configured' && authStore.isAuthenticated

    if (stored.status === 'configured')
      return true

    const config = stored.config ?? {}
    if (definition?.validationRequiredWhen?.(config))
      return definition.validationRequiredWhen(config)

    return false
  }

  // Warm OpenRouter catalog cache when consciousness is configured.
  watch(
    [configured, activeProvider],
    async ([isConfigured, provider]) => {
      if (!isConfigured || !provider || !isOpenRouterProvider(provider))
        return
      if (!providersStore.supportsModelListing(provider))
        return
      await providersStore.fetchModelsForProvider(provider)
    },
    { immediate: true },
  )

  /** Why chat cannot send yet. Hosts use this for the setup callout copy and route. */
  const chatSetupBlocker = computed((): ChatSetupBlocker => {
    const provider = activeProvider.value
    if (!provider)
      return 'select-model'

    if (!activeModel.value && provider !== 'prompt-api')
      return 'select-model'

    if (!isProviderReadyForChat(provider))
      return 'provider-credentials'

    return 'none'
  })

  /** Whether chat can send. The `prompt-api` provider runs without a selected model. */
  const chatReady = computed(() => chatSetupBlocker.value === 'none')

  async function resetState() {
    activeProvider.reset()
    resetModelSelection()
    modelByProvider.reset()
    temperature.reset()
    topP.reset()
    await settingsStore.setTemperatureEnabled(false)
    await settingsStore.setTopPEnabled(false)
  }

  return {
    // State
    configured,
    chatSetupBlocker,
    chatReady,
    activeProvider,
    activeModel,
    activeTemperature,
    activeTopP,
    temperature,
    topP,
    customModelName: activeCustomModelName,
    expandedDescriptions,
    modelSearchQuery,
    modelFilterPricing,
    modelFilterDeployment,
    modelSortKey,
    modelSortDirection,

    // Computed
    supportsModelListing,
    providerModels,
    activeModelRequiresReasoning,
    activeModelUsesProviderReasoningDefault,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    filteredModels,
    catalogSelectItemsForModels,

    // Actions
    resetModelSelection,
    commitChatSelection,
    lastModelForProvider,
    rememberModelForProvider,
    loadModelsForProvider,
    getModelsForProvider,
    getChatProviderInstance,
    resetState,
  }
}, {
  synced: {
    state: true,
  },
})
