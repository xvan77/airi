<script setup lang="ts">
import type { LocalLlmCatalogEntry } from '@proj-airi/stage-ui/libs/local-llm-catalog'
import type { ModelInfo } from '@proj-airi/stage-ui/libs/providers/types'

import { Alert, ErrorContainer, ModelCatalogFilters, RadioCardManySelect, RadioCardSimple } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { LOCAL_LLM_BASE_CATALOG } from '@proj-airi/stage-ui/libs/local-llm-catalog'
import { compareProviderCatalogOrder, parseDiskSizeBytes } from '@proj-airi/stage-ui/libs/model-catalog'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useConsciousnessSettingsStore } from '@proj-airi/stage-ui/stores/modules/consciousness-settings'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCheckbox, FieldRange, SettingsCard } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import ConsciousnessLocalLlmActions from './consciousness-local-llm-actions.vue'

import { useLocalLlmElectron } from '../../../composables/use-local-llm-electron'

const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const airiCardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const consciousnessSettingsStore = useConsciousnessSettingsStore()
const { configuredProviders } = storeToRefs(providerStore)
const { moduleChatProvidersMetadata } = storeToRefs(providersStore)
const { reasoning, temperatureEnabled, topPEnabled } = storeToRefs(consciousnessSettingsStore)
const {
  activeProvider,
  activeModel,
  customModelName,
  modelSearchQuery,
  modelFilterPricing,
  modelFilterDeployment,
  modelSortKey,
  modelSortDirection,
  activeModelRequiresReasoning,
  activeModelUsesProviderReasoningDefault,
  temperature,
  topP,
} = storeToRefs(consciousnessStore)

const { t } = useI18n()
const route = useRoute()
const { trackModelSwitched, trackProviderClick } = useAnalytics()

/** Consciousness provider tabs browse catalogs. Chat uses `activeProvider` until a model is picked. */
const browsingProvider = ref(activeProvider.value)

watch(activeProvider, (provider) => {
  if (provider)
    browsingProvider.value = provider
})

const browsingSupportsModelListing = computed(() =>
  providersStore.supportsModelListing(browsingProvider.value),
)

const browsingProviderModels = computed(() =>
  providersStore.getModelsForProvider(browsingProvider.value),
)

const isLoadingBrowsingProviderModels = computed(() =>
  providersStore.isLoadingModels[browsingProvider.value] || false,
)

const browsingProviderModelError = computed(() =>
  providersStore.modelLoadError[browsingProvider.value] || null,
)

const browsingModelSelection = computed(() => {
  if (browsingProvider.value === activeProvider.value)
    return activeModel.value
  return consciousnessStore.lastModelForProvider(browsingProvider.value)
})

const browsingManualModelDraft = ref('')

watch(browsingProvider, (provider) => {
  browsingManualModelDraft.value = provider === activeProvider.value
    ? activeModel.value
    : consciousnessStore.lastModelForProvider(provider)
}, { immediate: true })

watch(activeProvider, () => {
  if (browsingProvider.value === activeProvider.value)
    browsingManualModelDraft.value = activeModel.value
})

const sortedModuleChatProviders = computed(() =>
  [...moduleChatProvidersMetadata.value].sort(compareProviderCatalogOrder),
)

const localLlmDiskSizeByModelId = computed(() => {
  const sizes: Record<string, number> = {}
  for (const entry of LOCAL_LLM_BASE_CATALOG) {
    const bytes = parseDiskSizeBytes(entry.size)
    if (bytes != null)
      sizes[entry.filename] = bytes
  }
  return sizes
})

const localLlm = useLocalLlmElectron()
const {
  status: localLlmStatus,
  downloadedModels: localLlmDownloadedModels,
  isStartingServer: localLlmIsStartingServer,
  isDownloading: localLlmIsDownloading,
  downloadProgress: localLlmDownloadProgress,
  startPolling: startLocalLlmPolling,
  stopPolling: stopLocalLlmPolling,
  downloadModel: downloadLocalLlmModel,
  startServer: startLocalLlmServer,
  stopServer: stopLocalLlmServer,
  stopServerIfRunning: stopLocalLlmServerIfRunning,
  resolveModelToRun: resolveLocalLlmModelToRun,
} = localLlm

const localLlmServerState = computed(() => localLlmStatus.value?.state ?? 'idle')
const localLlmDownloadProgressPercent = computed(() => {
  if (localLlmDownloadProgress.value?.status === 'downloading')
    return localLlmDownloadProgress.value.progress
  return null
})

const localLlmActiveModelOnDisk = computed(() => {
  const model = browsingProvider.value === 'local-llm'
    ? browsingModelSelection.value
    : activeModel.value
  if (!model)
    return false
  return localLlmDownloadedModels.value.includes(model)
})

const localLlmModelToStart = computed(() => {
  const preferred = browsingProvider.value === 'local-llm'
    ? browsingModelSelection.value
    : activeModel.value
  return resolveLocalLlmModelToRun(preferred)
})

const localLlmModelLabelKey = computed(() => {
  if (browsingProvider.value === 'local-llm' && browsingModelSelection.value && !localLlmActiveModelOnDisk.value)
    return 'settings.pages.modules.consciousness.sections.section.provider-model-selection.latest_model_label'
  return 'settings.pages.modules.consciousness.sections.section.provider-model-selection.current_model_label'
})

const localLlmDownloadInProgress = computed(() => {
  if (localLlmIsDownloading.value)
    return true
  if (localLlmServerState.value === 'downloading_binary')
    return true
  if (localLlmDownloadProgress.value?.status === 'downloading')
    return true
  return localLlmDownloadProgressPercent.value !== null
})

const localLlmCanStartServer = computed(() =>
  Boolean(localLlmModelToStart.value) && !localLlmDownloadInProgress.value,
)

function localLlmDisplayName(filename: string) {
  const catalogEntry = LOCAL_LLM_BASE_CATALOG.find(entry => entry.filename === filename)
  if (catalogEntry)
    return catalogEntry.name
  return filename.replace(/\.gguf$/i, '').replace(/[-_]/g, ' ')
}

const localLlmDownloadedModelItems = computed((): ModelInfo[] =>
  localLlmDownloadedModels.value.map(filename => ({
    id: filename,
    name: localLlmDisplayName(filename),
    description: filename,
    provider: 'local-llm',
  })),
)

/** Local LLM: always list every GGUF on disk; merge API metadata when the server is up. */
const consciousnessDisplayModels = computed((): ModelInfo[] => {
  if (browsingProvider.value !== 'local-llm')
    return browsingProviderModels.value

  if (localLlmDownloadedModelItems.value.length === 0)
    return browsingProviderModels.value

  const merged = new Map(
    localLlmDownloadedModelItems.value.map(item => [item.id, item]),
  )
  for (const model of browsingProviderModels.value) {
    const fromDisk = merged.get(model.id)
    merged.set(model.id, {
      ...fromDisk,
      ...model,
      id: model.id,
      name: model.name ?? fromDisk?.name ?? model.id,
      description: model.description ?? fromDisk?.description ?? model.id,
    })
  }

  return [...merged.values()]
})

const consciousnessModelSelectItems = computed(() =>
  consciousnessStore.catalogSelectItemsForModels(
    consciousnessDisplayModels.value,
    browsingProvider.value === 'local-llm' ? localLlmDiskSizeByModelId.value : undefined,
    browsingProvider.value,
  ),
)

const showLocalLlmOfflineActions = computed(() =>
  browsingProvider.value === 'local-llm'
  && localLlmServerState.value !== 'running'
  && localLlmServerState.value !== 'starting',
)

async function refreshLocalLlmModels() {
  await providersStore.fetchModelsForProvider('local-llm')
  await providersStore.validateProvider('local-llm', { force: true })
  await consciousnessStore.loadModelsForProvider('local-llm')
}

async function handleLocalLlmStartServer() {
  const preferred = browsingProvider.value === 'local-llm'
    ? browsingModelSelection.value
    : activeModel.value
  const model = resolveLocalLlmModelToRun(preferred)
  if (!model)
    return
  await startLocalLlmServer(model)
  providersStore.forceProviderConfigured('local-llm')
  await refreshLocalLlmModels()
}

async function handleLocalLlmStopServer() {
  await stopLocalLlmServer()
  await refreshLocalLlmModels()
}

async function handleLocalLlmQuickDownload(entry: LocalLlmCatalogEntry) {
  await downloadLocalLlmModel({
    modelId: entry.id,
    repo: entry.repo,
    filename: entry.filename,
  })
  if (browsingProvider.value === 'local-llm')
    await selectModel(entry.filename)
  else
    consciousnessStore.rememberModelForProvider('local-llm', entry.filename)
}

watch(browsingProvider, async (provider) => {
  if (!provider)
    return

  if (provider === 'local-llm')
    startLocalLlmPolling()
  else if (localLlmServerState.value !== 'running' && localLlmServerState.value !== 'starting')
    stopLocalLlmPolling()

  await consciousnessStore.loadModelsForProvider(provider)

  if (provider === 'local-llm' && localLlmServerState.value === 'running')
    await refreshLocalLlmModels()
}, { immediate: true })

watch(localLlmServerState, async (state, previous) => {
  if (browsingProvider.value !== 'local-llm')
    return
  if (state === 'running' && previous !== 'running')
    await refreshLocalLlmModels()
})

async function persistSelection() {
  await airiCardStore.updateActiveCardConsciousness({ provider: activeProvider.value, model: activeModel.value })
}

function updateCustomModelName(value: string) {
  customModelName.value = value
}

async function selectModel(modelId: string) {
  const provider = browsingProvider.value
  if (!provider || !modelId)
    return

  const previousModelId = activeModel.value
  const loadedOnServer = localLlmStatus.value?.activeModel

  consciousnessStore.commitChatSelection(provider, modelId)
  browsingManualModelDraft.value = modelId
  await persistSelection()

  if (previousModelId !== modelId)
    trackModelSwitched(previousModelId || 'none', modelId)

  if (provider !== 'local-llm')
    await stopLocalLlmServerIfRunning()

  if (
    provider === 'local-llm'
    && localLlmServerState.value === 'running'
    && loadedOnServer
    && modelId !== loadedOnServer
    && localLlmDownloadedModels.value.includes(modelId)
  ) {
    await handleLocalLlmStartServer()
  }
}

async function commitBrowsingManualModel() {
  const model = browsingManualModelDraft.value.trim()
  if (!model)
    return
  await selectModel(model)
}

async function handleDeleteProvider(providerId: string) {
  await airiCardStore.clearProviderSelections(providerId)
  await providersStore.deleteProvider(providerId)
}

async function updateReasoning(value: boolean) {
  await consciousnessSettingsStore.setReasoning(value)
}

async function updateTemperatureEnabled(value: boolean) {
  await consciousnessSettingsStore.setTemperatureEnabled(value)
}

async function updateTopPEnabled(value: boolean) {
  await consciousnessSettingsStore.setTopPEnabled(value)
}

onMounted(() => {
  const browse = route.query.browse
  if (typeof browse === 'string' && browse.length > 0)
    browsingProvider.value = browse
})
</script>

<template>
  <SettingsCard>
    <div>
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
            {{ t('settings.pages.providers.title') }}
          </h2>
          <div text="neutral-400 dark:neutral-400">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.description') }}</span>
          </div>
        </div>
        <div max-w-full>
          <!--
          fieldset has min-width set to --webkit-min-container, in order to use over flow scroll,
          we need to set the min-width to 0.
          See also: https://stackoverflow.com/a/33737340
        -->
          <fieldset
            v-if="moduleChatProvidersMetadata.length > 0"
            flex="~ row gap-4"
            min-w-0 overflow-x-auto scroll-smooth
            role="radiogroup"
          >
            <RadioCardSimple
              v-for="metadata in sortedModuleChatProviders"
              :id="metadata.id"
              :key="metadata.id"
              v-model="browsingProvider"
              dense
              name="provider"
              :value="metadata.id"
              :title="metadata.localizedName || 'Unknown'"
              :description="metadata.localizedDescription"
              :more-info-label="t('settings.pages.modules.consciousness.model_catalog.description_show')"
              @click="trackProviderClick(metadata.id, 'consciousness')"
            >
              <template v-if="!metadata.id.startsWith('official-provider')" #topRight>
                <button
                  type="button"
                  class="rounded bg-neutral-100 p-1 text-neutral-600 transition-colors dark:bg-neutral-800/60 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700/60"
                  @click.stop.prevent="handleDeleteProvider(metadata.id)"
                >
                  <div i-solar:trash-bin-trash-bold-duotone class="text-base" />
                </button>
              </template>

              <template v-if="configuredProviders[metadata.id] === false" #bottomRight>
                <div class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-300">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.health_check_failed') }}
                </div>
              </template>
            </RadioCardSimple>
            <RouterLink
              to="/settings/providers"
              border="2px solid"
              class="h-12 w-80 flex-shrink-0 border-neutral-100 bg-white dark:border-neutral-900 hover:border-primary-500/30 dark:bg-neutral-900/20 dark:hover:border-primary-400/30"
              flex="~ col items-center justify-center"
              transition="all duration-200 ease-in-out"
              relative rounded-xl p-2
            >
              <div i-solar:add-circle-line-duotone class="text-2xl text-neutral-500 dark:text-neutral-500" />
              <div
                class="bg-dotted-neutral-200/80 dark:bg-dotted-neutral-700/50"
                absolute inset-0 z--1
                style="background-size: 10px 10px; mask-image: linear-gradient(165deg, white 30%, transparent 50%);"
              />
            </RouterLink>
          </fieldset>
          <div v-else>
            <RouterLink
              class="flex items-center gap-3 rounded-lg p-4"
              border="2 dashed neutral-200 dark:neutral-800"
              bg="neutral-50 dark:neutral-800"
              transition="colors duration-200 ease-in-out"
              to="/settings/providers"
            >
              <div i-solar:warning-circle-line-duotone class="text-2xl text-amber-500 dark:text-amber-400" />
              <div class="flex flex-col">
                <span class="font-medium">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_title') }}</span>
                <span class="text-sm text-neutral-400 dark:text-neutral-500">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_description') }}</span>
              </div>
              <div i-solar:arrow-right-line-duotone class="ml-auto text-xl text-neutral-400 dark:text-neutral-500" />
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Model selection section -->
    <div v-if="browsingProvider && browsingSupportsModelListing">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg md:text-2xl">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
          </h2>
          <div class="flex flex-col items-start gap-1 text-neutral-400 md:flex-row md:items-center md:justify-between dark:text-neutral-400">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.subtitle') }}</span>
            <div v-if="browsingModelSelection" class="flex flex-wrap items-center gap-2 text-sm text-neutral-400 font-medium dark:text-neutral-400">
              <span>{{ t(localLlmModelLabelKey) }} {{ browsingModelSelection }}</span>
              <span
                v-if="browsingProvider === 'local-llm' && !localLlmActiveModelOnDisk"
                class="border border-amber-500/30 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400"
              >
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.not_downloaded') }}
              </span>
              <span
                v-if="browsingProvider === 'local-llm' && localLlmStatus"
                class="border rounded px-2 py-0.5 text-[10px] font-bold"
                :class="localLlmServerState === 'running'
                  ? 'border-green-500/20 bg-green-500/10 text-green-500'
                  : localLlmServerState === 'starting'
                    ? 'animate-pulse border-amber-500/20 bg-amber-500/10 text-amber-500'
                    : 'border-red-500/20 bg-red-500/10 text-red-500'"
              >
                {{ localLlmServerState === 'running'
                  ? t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.status_running')
                  : localLlmServerState === 'starting'
                    ? t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.status_starting')
                    : t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.status_offline') }}
              </span>
              <button
                v-if="browsingProvider === 'local-llm' && (localLlmServerState === 'running' || localLlmServerState === 'starting')"
                type="button"
                class="flex items-center gap-1 border border-red-500/20 rounded bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500 font-bold"
                @click="handleLocalLlmStopServer"
              >
                <div class="i-solar:stop-circle-line-duotone" />
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.stop_server') }}
              </button>
              <button
                v-else-if="browsingProvider === 'local-llm' && localLlmDownloadInProgress"
                type="button"
                disabled
                class="flex cursor-not-allowed items-center gap-1 border border-amber-500/20 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold opacity-80 dark:text-amber-400"
              >
                <div class="i-solar:refresh-line-duotone animate-spin text-sm" />
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.downloading_button') }}
              </button>
              <button
                v-else-if="browsingProvider === 'local-llm' && localLlmCanStartServer"
                type="button"
                class="flex items-center gap-1 border border-green-500/20 rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600 font-bold dark:text-green-500 disabled:opacity-50"
                :disabled="localLlmIsStartingServer"
                :title="localLlmModelToStart !== browsingModelSelection ? localLlmModelToStart : undefined"
                @click="handleLocalLlmStartServer"
              >
                <div class="i-solar:play-circle-line-duotone" />
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.start_server') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div
          v-if="isLoadingBrowsingProviderModels || (browsingProvider === 'local-llm' && localLlmServerState === 'starting')"
          class="flex items-center justify-center py-4"
        >
          <div class="mr-2 animate-spin">
            <div i-solar:spinner-line-duotone text-xl />
          </div>
          <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.loading') }}</span>
        </div>

        <template v-else-if="consciousnessDisplayModels.length > 0">
          <ConsciousnessLocalLlmActions
            v-if="showLocalLlmOfflineActions"
            :active-model="browsingModelSelection"
            :server-state="localLlmServerState"
            :downloaded-models="localLlmDownloadedModels"
            :is-starting-server="localLlmIsStartingServer"
            :is-downloading="localLlmIsDownloading"
            :download-progress-percent="localLlmDownloadProgressPercent"
            :can-start-server="localLlmCanStartServer"
            :download-in-progress="localLlmDownloadInProgress"
            show-quick-download
            @start-server="handleLocalLlmStartServer"
            @stop-server="handleLocalLlmStopServer"
            @quick-download="handleLocalLlmQuickDownload"
          />
          <p
            v-if="browsingProvider === 'local-llm' && localLlmServerState !== 'running' && localLlmDownloadedModels.length > 0"
            class="text-xs text-neutral-500 dark:text-neutral-400"
          >
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.downloaded_models_hint') }}
          </p>
          <p
            v-else-if="browsingProvider === 'local-llm' && localLlmServerState === 'running'"
            class="text-xs text-neutral-500 dark:text-neutral-400"
          >
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.switch_model_reloads') }}
          </p>
          <ModelCatalogFilters
            v-model:pricing="modelFilterPricing"
            v-model:deployment="modelFilterDeployment"
            v-model:sort-key="modelSortKey"
            v-model:sort-direction="modelSortDirection"
            class="mt-2"
          />
          <RadioCardManySelect
            v-model:search-query="modelSearchQuery"
            :model-value="browsingModelSelection"
            :provider-id="browsingProvider"
            :items="consciousnessModelSelectItems"
            :searchable="true"
            :allow-custom="browsingProvider !== 'local-llm'"
            :description-collapsed-by-default="true"
            :description-toggle-label="t('settings.pages.modules.consciousness.model_catalog.description_show')"
            :description-collapse-label="t('settings.pages.modules.consciousness.model_catalog.description_hide')"
            :search-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_placeholder')"
            :search-no-results-title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results')"
            :search-no-results-description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results_description', { query: modelSearchQuery })"
            :search-results-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_results', { count: '{count}', total: '{total}' })"
            :custom-input-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.custom_model_placeholder')"
            :expand-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.expand')"
            :collapse-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.collapse')"
            expanded-class="mb-12"
            @update:model-value="selectModel"
            @update:custom-value="updateCustomModelName"
          />
        </template>

        <!-- Error state (no downloadable local models to show) -->
        <template v-else-if="browsingProviderModelError">
          <ConsciousnessLocalLlmActions
            v-if="browsingProvider === 'local-llm'"
            :active-model="browsingModelSelection"
            :server-state="localLlmServerState"
            :downloaded-models="localLlmDownloadedModels"
            :is-starting-server="localLlmIsStartingServer"
            :is-downloading="localLlmIsDownloading"
            :download-progress-percent="localLlmDownloadProgressPercent"
            :can-start-server="localLlmCanStartServer"
            :download-in-progress="localLlmDownloadInProgress"
            show-quick-download
            @start-server="handleLocalLlmStartServer"
            @stop-server="handleLocalLlmStopServer"
            @quick-download="handleLocalLlmQuickDownload"
          />
          <ErrorContainer
            v-else
            :title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.error')"
            :error="browsingProviderModelError"
          />
          <div v-if="browsingProvider !== 'local-llm'" class="mt-2">
            <label class="mb-1 block text-sm font-medium">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
            </label>
            <input
              v-model="browsingManualModelDraft" type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
              @change="commitBrowsingManualModel"
            >
          </div>
        </template>

        <template v-else-if="!(browsingProvider === 'local-llm' && localLlmServerState === 'starting')">
          <ConsciousnessLocalLlmActions
            v-if="browsingProvider === 'local-llm'"
            :active-model="browsingModelSelection"
            :server-state="localLlmServerState"
            :downloaded-models="localLlmDownloadedModels"
            :is-starting-server="localLlmIsStartingServer"
            :is-downloading="localLlmIsDownloading"
            :download-progress-percent="localLlmDownloadProgressPercent"
            :can-start-server="localLlmCanStartServer"
            :download-in-progress="localLlmDownloadInProgress"
            show-quick-download
            @start-server="handleLocalLlmStartServer"
            @stop-server="handleLocalLlmStopServer"
            @quick-download="handleLocalLlmQuickDownload"
          />
          <Alert v-else type="warning">
            <template #title>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models') }}
            </template>
            <template #content>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_description') }}
            </template>
          </Alert>

          <RadioCardManySelect
            v-if="browsingProvider !== 'local-llm'"
            v-model:search-query="modelSearchQuery"
            :model-value="browsingModelSelection"
            :provider-id="browsingProvider"
            :items="[]"
            :searchable="true"
            :allow-custom="true"
            :search-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_placeholder')"
            :search-no-results-title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results')"
            :search-no-results-description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results_description', { query: modelSearchQuery })"
            :search-results-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_results', { count: '{count}', total: '{total}' })"
            :custom-input-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.custom_model_placeholder')"
            :expand-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.expand')"
            :collapse-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.collapse')"
            @update:model-value="selectModel"
            @update:custom-value="updateCustomModelName"
          />
        </template>

        <div
          v-if="browsingProvider === 'local-llm'"
          class="flex justify-end"
        >
          <RouterLink
            to="/settings/providers/chat/local-llm"
            :class="[
              'inline-flex items-center gap-2',
              'rounded-lg px-4 py-2.5',
              'text-sm font-semibold text-white',
              'bg-amber-500 transition hover:bg-amber-600',
            ]"
          >
            <div class="i-solar:settings-line-duotone text-lg" />
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.open_settings') }}
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Provider doesn't support model listing -->
    <div v-else-if="browsingProvider && !browsingSupportsModelListing">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
          </h2>
          <div text="neutral-400 dark:neutral-500">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.subtitle') }}</span>
          </div>
        </div>

        <div
          class="flex items-center gap-3 border border-primary-200 rounded-lg bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20"
        >
          <div i-solar:info-circle-line-duotone class="text-2xl text-primary-500 dark:text-primary-400" />
          <div class="flex flex-col">
            <span class="font-medium">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported')
            }}</span>
            <span class="text-sm text-primary-600 dark:text-primary-400">{{
              t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported_description') }}</span>
          </div>
        </div>

        <!-- Manual model input for providers without model listing -->
        <div class="mt-2">
          <label class="mb-1 block text-sm font-medium">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
          </label>
          <input
            v-model="browsingManualModelDraft" type="text"
            class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
            @change="commitBrowsingManualModel"
          >
        </div>
      </div>
    </div>

    <section
      v-if="activeProvider && activeModel"
      :class="['flex', 'flex-col', 'gap-4', 'border-t', 'border-neutral-200', 'pt-4', 'dark:border-neutral-800']"
    >
      <h2 :class="['text-lg', 'text-neutral-500', 'md:text-2xl', 'dark:text-neutral-400']">
        {{ t('settings.pages.modules.consciousness.sections.section.model-options.title') }}
      </h2>

      <div
        v-if="activeModelUsesProviderReasoningDefault"
        :class="['flex', 'flex-col', 'gap-1']"
      >
        <span class="text-sm font-medium">
          {{ t('settings.pages.modules.consciousness.sections.section.model-options.thinking.label') }}
        </span>
        <span :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">
          {{ t('settings.pages.modules.consciousness.sections.section.model-options.thinking.provider-default-description') }}
        </span>
      </div>
      <FieldCheckbox
        v-else
        :model-value="reasoning || activeModelRequiresReasoning"
        :label="t('settings.pages.modules.consciousness.sections.section.model-options.thinking.label')"
        :description="activeModelRequiresReasoning ? t('settings.pages.modules.consciousness.sections.section.model-options.thinking.required-description') : undefined"
        :disabled="activeModelRequiresReasoning"
        @update:model-value="updateReasoning"
      />
    </section>
  </SettingsCard>

  <SettingsCard v-if="activeProvider" class="mt-4">
    <div :class="['flex flex-col gap-4']">
      <FieldCheckbox
        :model-value="temperatureEnabled"
        :label="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.temperature_enabled')"
        :description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.sampling_override_description')"
        @update:model-value="updateTemperatureEnabled"
      />
      <FieldRange
        v-if="temperatureEnabled"
        v-model="temperature"
        :label="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.temperature_label')"
        :description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.temperature_description')"
        :min="0"
        :max="2"
        :step="0.1"
        :format-value="value => value.toFixed(1)"
      />
      <FieldCheckbox
        :model-value="topPEnabled"
        :label="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.top_p_enabled')"
        :description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.sampling_override_description')"
        @update:model-value="updateTopPEnabled"
      />
      <FieldRange
        v-if="topPEnabled"
        v-model="topP"
        :label="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.top_p_label')"
        :description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.top_p_description')"
        :min="0"
        :max="1"
        :step="0.1"
        :format-value="value => value.toFixed(1)"
      />
    </div>
  </SettingsCard>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:ghost-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.consciousness.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
