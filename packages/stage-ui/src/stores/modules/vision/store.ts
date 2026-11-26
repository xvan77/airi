import type {} from 'pinia-plugin-synced'

import type {
  ModelCatalogDeploymentFilter,
  ModelCatalogPricingFilter,
  ModelCatalogSortDirection,
  ModelCatalogSortKey,
} from '../../../libs/model-catalog'
import type { ModelInfo } from '../../../libs/providers/types'

import { isAggressiveOfflineStartup } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { isUsableVisionModel } from '@proj-airi/stage-shared/vision-model-eligibility'
import { refManualReset } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import {
  filterModelCatalogRows,
  prepareModelCatalogRows,
  sortModelCatalogRows,
} from '../../../libs/model-catalog'
import { useProviderStore } from '../../providers/provider'

export const useVisionStore = defineStore('vision', () => {
  const providersStore = useProviderStore()

  // Pinia synchronization owns live cross-window state. localStorage only
  // loads and saves durable values for this synchronized store.
  const persistenceOptions = { listenToStorageChanges: false }

  const activeProvider = useLocalStorageManualReset('settings/vision/active-provider', '', persistenceOptions)
  const activeModel = useLocalStorageManualReset('settings/vision/active-model', '', persistenceOptions)
  const activeCustomModelName = useLocalStorageManualReset('settings/vision/active-custom-model', '', persistenceOptions)
  const ollamaThinkingEnabled = useLocalStorageManualReset('settings/vision/ollama-thinking-enabled', false, persistenceOptions)
  const visionEnabledByDefault = !isAggressiveOfflineStartup()
  const useForChat = useLocalStorageManualReset('settings/vision/use-for-chat', visionEnabledByDefault, persistenceOptions)
  /** Whether the vision model reads the images that tools return, such as computer-use screenshots. */
  const useForToolImages = useLocalStorageManualReset('settings/vision/use-for-tool-images', visionEnabledByDefault, persistenceOptions)
  const modelSearchQuery = refManualReset('')
  const modelFilterPricing = refManualReset<ModelCatalogPricingFilter>('all')
  const modelFilterDeployment = refManualReset<ModelCatalogDeploymentFilter>('all')
  const modelSortKey = refManualReset<ModelCatalogSortKey>('default')
  const modelSortDirection = refManualReset<ModelCatalogSortDirection>('asc')

  const supportsModelListing = computed(() => {
    return providersStore.supportsModelListing(activeProvider.value)
  })

  const providerModels = computed(() => {
    if (!activeProvider.value)
      return []

    return providersStore.getModelsForProvider(activeProvider.value)
      .filter(model => isUsableVisionModel(model))
  })

  function catalogRowsForModels(
    models: readonly ModelInfo[],
    providerId: string = activeProvider.value,
  ) {
    const query = modelSearchQuery.value.toLowerCase().trim()
    const rows = sortModelCatalogRows(
      filterModelCatalogRows(
        prepareModelCatalogRows(models, { providerId }),
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

  const visionModelSelectItems = computed(() =>
    catalogRowsForModels(providerModels.value).map(row => ({
      id: row.model.id,
      name: row.model.name,
      description: row.model.description,
      deprecated: row.model.deprecated,
      badges: row.badges,
    })),
  )

  const isLoadingActiveProviderModels = computed(() => {
    if (!activeProvider.value)
      return false

    return providersStore.isLoadingModels[activeProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    if (!activeProvider.value)
      return null

    return providersStore.modelLoadError[activeProvider.value] || null
  })

  const configured = computed(() => {
    return !!activeProvider.value && !!activeModel.value
  })

  function resetModelSelection() {
    activeModel.reset()
    activeCustomModelName.reset()
    modelSearchQuery.reset()
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

  function resetState() {
    useForChat.reset()
    useForToolImages.reset()
    activeProvider.reset()
    resetModelSelection()
  }

  return {
    useForChat,
    useForToolImages,
    activeProvider,
    activeModel,
    customModelName: activeCustomModelName,
    ollamaThinkingEnabled,
    modelSearchQuery,
    modelFilterPricing,
    modelFilterDeployment,
    modelSortKey,
    modelSortDirection,

    supportsModelListing,
    providerModels,
    visionModelSelectItems,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    configured,

    resetModelSelection,
    loadModelsForProvider,
    getModelsForProvider,
    resetState,
  }
}, {
  synced: {
    state: true,
  },
})
