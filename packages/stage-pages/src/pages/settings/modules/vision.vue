<script setup lang="ts">
import { Alert, ErrorContainer, ModelCatalogFilters, RadioCardManySelect, RadioCardSimple } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { ensurePricingSourcesFresh } from '@proj-airi/stage-ui/libs/model-catalog'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessSettingsStore } from '@proj-airi/stage-ui/stores/modules/consciousness-settings'
import { useVisionActivityStore, useVisionProcessingStore, useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { FieldCheckbox, FieldRange, SettingsCard } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const airiCardStore = useAiriCardStore()
const consciousnessSettingsStore = useConsciousnessSettingsStore()
const visionStore = useVisionStore()
const visionProcessingStore = useVisionProcessingStore()
const visionActivityStore = useVisionActivityStore()
const { providers: storedProviders } = storeToRefs(providerStore)
const { moduleVisionProvidersMetadata } = storeToRefs(providersStore)
const { showProviderHealth } = storeToRefs(consciousnessSettingsStore)
const {
  useForChat,
  useForToolImages,
  activeProvider,
  activeModel,
  customModelName,
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
} = storeToRefs(visionStore)
const { captureIntervalMs } = storeToRefs(visionProcessingStore)
const {
  captureCount,
  contextUpdateCount,
  lastCaptureAt,
  lastContextUpdateAt,
  inferenceCount,
  failedInferenceCount,
  lastInference,
} = storeToRefs(visionActivityStore)

const { t, locale } = useI18n()
const { trackProviderClick } = useAnalytics()

const VISION_PROVIDER_ID_PREFIX = 'vision-'

onMounted(() => {
  void ensurePricingSourcesFresh()
})

watch(activeProvider, async (provider) => {
  if (!provider)
    return

  await visionStore.loadModelsForProvider(provider)
}, { immediate: true })

const activeProviderSettingsPath = computed(() => {
  if (!activeProvider.value)
    return '/settings/providers#vision'

  const sourceId = activeProvider.value.startsWith(VISION_PROVIDER_ID_PREFIX)
    ? activeProvider.value.slice(VISION_PROVIDER_ID_PREFIX.length)
    : activeProvider.value
  return `/settings/providers/vision/${sourceId}`
})

async function selectProvider(provider: string) {
  await airiCardStore.selectActiveCardVisionProvider(provider)
}

async function persistSelection() {
  await airiCardStore.updateActiveCardVision({ provider: activeProvider.value, model: activeModel.value })
}

function updateCustomModelName(value: string) {
  customModelName.value = value
}

async function handleDeleteProvider(providerId: string) {
  await airiCardStore.clearProviderSelections(providerId)
  await providersStore.deleteProvider(providerId)
}

async function updateShowProviderHealth(value: boolean) {
  await consciousnessSettingsStore.setShowProviderHealth(value)
}

function providerHealthFailed(providerId: string) {
  return storedProviders.value[providerId]?.status === 'invalid'
}

const formattedLastCapture = computed(() => formatRelativeTime(lastCaptureAt.value))
const formattedLastContextUpdate = computed(() => formatRelativeTime(lastContextUpdateAt.value))
const formattedLastInferenceDuration = computed(() => lastInference.value
  ? new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'millisecond', unitDisplay: 'short' }).format(lastInference.value.durationMs)
  : '')
const formattedLastInference = computed(() => formatRelativeTime(lastInference.value?.at ?? null))
const lastInferenceProviderName = computed(() => {
  const providerId = lastInference.value?.provider
  return moduleVisionProvidersMetadata.value.find(metadata => metadata.id === providerId)?.localizedName ?? providerId
})
const isOllamaVisionProvider = computed(() => activeProvider.value === 'vision-ollama')
const failedInferenceCountClass = computed(() => failedInferenceCount.value > 0
  ? 'text-red-500'
  : 'text-neutral-600 dark:text-neutral-200')

function canDeleteProvider(providerId: string) {
  return !providerId.startsWith('official-provider') && !providerId.startsWith('vision-official-provider')
}

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp)
    return t('settings.pages.modules.vision.stats.never')

  const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSeconds < 60)
    return formatter.format(-diffSeconds, 'second')
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60)
    return formatter.format(-diffMinutes, 'minute')
  return formatter.format(-Math.floor(diffMinutes / 60), 'hour')
}
</script>

<template>
  <div :class="['flex', 'flex-col', 'gap-6']">
    <SettingsCard>
      <div :class="['flex', 'flex-col', 'gap-4']">
        <div>
          <div :class="['flex', 'items-center', 'justify-between', 'gap-4']">
            <h2 :class="['text-lg', 'text-neutral-500', 'md:text-2xl', 'dark:text-neutral-500']">
              {{ t('settings.pages.providers.title') }}
            </h2>
            <RouterLink
              :to="activeProviderSettingsPath"
              :class="[
                'inline-flex',
                'shrink-0',
                'items-center',
                'gap-2',
                'rounded-lg',
                'bg-amber-500',
                'px-4',
                'py-2.5',
                'text-sm',
                'font-semibold',
                'text-white',
                'transition',
                'hover:bg-amber-600',
              ]"
            >
              <div :class="['text-lg', 'i-solar:settings-line-duotone']" />
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.open_provider_settings') }}
            </RouterLink>
          </div>
          <div :class="['text-neutral-400', 'dark:text-neutral-400']">
            <span>{{ t('settings.pages.modules.vision.sections.section.provider-selection.description') }}</span>
          </div>
        </div>
        <div :class="['max-w-full']">
          <fieldset
            v-if="moduleVisionProvidersMetadata.length > 0"
            :class="['flex', 'min-w-0', 'flex-row', 'gap-4', 'overflow-x-auto', 'scroll-smooth']"
            role="radiogroup"
          >
            <RadioCardSimple
              v-for="metadata in moduleVisionProvidersMetadata"
              :id="metadata.id"
              :key="metadata.id"
              :model-value="activeProvider"
              dense
              name="provider"
              :value="metadata.id"
              :title="metadata.localizedName || 'Unknown'"
              :description="metadata.localizedDescription"
              :more-info-label="t('settings.pages.modules.consciousness.model_catalog.description_show')"
              @update:model-value="selectProvider"
              @click="trackProviderClick(metadata.id, 'vision')"
            >
              <template v-if="canDeleteProvider(metadata.id)" #topRight>
                <button
                  type="button"
                  :class="[
                    'rounded',
                    'bg-neutral-100',
                    'p-1',
                    'text-neutral-600',
                    'transition-colors',
                    'hover:bg-neutral-200',
                    'dark:bg-neutral-800/60',
                    'dark:text-neutral-300',
                    'dark:hover:bg-neutral-700/60',
                  ]"
                  @click.stop.prevent="handleDeleteProvider(metadata.id)"
                >
                  <div :class="['text-base', 'i-solar:trash-bin-trash-bold-duotone']" />
                </button>
              </template>

              <template v-if="showProviderHealth && providerHealthFailed(metadata.id)" #bottomRight>
                <div
                  :class="[
                    'rounded',
                    'bg-amber-100',
                    'px-2',
                    'py-0.5',
                    'text-xs',
                    'font-medium',
                    'text-amber-700',
                    'dark:bg-amber-900/30',
                    'dark:text-amber-300',
                  ]"
                >
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.health_check_failed') }}
                </div>
              </template>
            </RadioCardSimple>
            <RouterLink
              to="/settings/providers#vision"
              :class="[
                'relative',
                'h-12',
                'w-80',
                'flex-shrink-0',
                'rounded-xl',
                'border-2',
                'border-neutral-100',
                'bg-white',
                'p-2',
                'transition',
                'duration-200',
                'ease-in-out',
                'hover:border-primary-500/30',
                'dark:border-neutral-900',
                'dark:bg-neutral-900/20',
                'dark:hover:border-primary-400/30',
                'flex',
                'flex-col',
                'items-center',
                'justify-center',
              ]"
            >
              <div :class="['text-2xl', 'text-neutral-500', 'dark:text-neutral-500', 'i-solar:add-circle-line-duotone']" />
              <div
                :class="['absolute', 'inset-0', 'z--1', 'bg-dotted-neutral-200/80', 'dark:bg-dotted-neutral-700/50']"
                :style="{ 'background-size': '10px 10px', 'mask-image': 'linear-gradient(165deg, white 30%, transparent 50%)' }"
              />
            </RouterLink>
          </fieldset>
          <div v-else>
            <RouterLink
              to="/settings/providers#vision"
              :class="[
                'flex',
                'items-center',
                'gap-3',
                'rounded-lg',
                'border-2',
                'border-dashed',
                'border-neutral-200',
                'bg-neutral-50',
                'p-4',
                'transition',
                'duration-200',
                'ease-in-out',
                'dark:border-neutral-800',
                'dark:bg-neutral-800',
              ]"
            >
              <div :class="['text-2xl', 'text-amber-500', 'dark:text-amber-400', 'i-solar:warning-circle-line-duotone']" />
              <div :class="['flex', 'flex-col']">
                <span :class="['font-medium']">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_title') }}
                </span>
                <span :class="['text-sm', 'text-neutral-400', 'dark:text-neutral-500']">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_description') }}
                </span>
              </div>
              <div :class="['ml-auto', 'text-xl', 'text-neutral-400', 'dark:text-neutral-500', 'i-solar:arrow-right-line-duotone']" />
            </RouterLink>
          </div>
        </div>
      </div>
    </SettingsCard>

    <SettingsCard v-if="activeProvider && supportsModelListing">
      <div :class="['flex', 'flex-col', 'gap-4']">
        <div>
          <h2 :class="['text-lg', 'md:text-2xl']">
            {{ t('settings.pages.modules.vision.sections.section.provider-model-selection.title') }}
          </h2>
          <div :class="['text-neutral-400', 'dark:text-neutral-400']">
            <span>{{ t('settings.pages.modules.vision.sections.section.provider-model-selection.subtitle') }}</span>
          </div>
        </div>

        <div v-if="isLoadingActiveProviderModels" :class="['flex', 'items-center', 'justify-center', 'py-4']">
          <div :class="['mr-2', 'animate-spin']">
            <div :class="['text-xl', 'i-solar:spinner-line-duotone']" />
          </div>
          <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.loading') }}</span>
        </div>

        <ErrorContainer
          v-else-if="activeProviderModelError"
          :title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.error')"
          :error="activeProviderModelError"
        />

        <template v-else-if="providerModels.length === 0 && !isLoadingActiveProviderModels">
          <Alert type="warning">
            <template #title>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models') }}
            </template>
            <template #content>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_description') }}
            </template>
          </Alert>
          <RadioCardManySelect
            v-model="activeModel"
            v-model:search-query="modelSearchQuery"
            :provider-id="activeProvider"
            :items="[]"
            :searchable="true"
            :allow-custom="true"
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
            @update:model-value="persistSelection"
            @update:custom-value="updateCustomModelName"
          />
        </template>

        <template v-else-if="providerModels.length > 0">
          <ModelCatalogFilters
            v-model:pricing="modelFilterPricing"
            v-model:deployment="modelFilterDeployment"
            v-model:sort-key="modelSortKey"
            v-model:sort-direction="modelSortDirection"
            :class="['min-w-0', 'flex-1']"
          />
          <RadioCardManySelect
            v-model="activeModel"
            v-model:search-query="modelSearchQuery"
            :provider-id="activeProvider"
            :items="visionModelSelectItems"
            :searchable="true"
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
            @update:model-value="persistSelection"
            @update:custom-value="updateCustomModelName"
          />
        </template>
      </div>
    </SettingsCard>

    <SettingsCard v-else-if="activeProvider && !supportsModelListing">
      <div :class="['flex', 'flex-col', 'gap-4']">
        <div>
          <h2 :class="['text-lg', 'text-neutral-500', 'md:text-2xl', 'dark:text-neutral-400']">
            {{ t('settings.pages.modules.vision.sections.section.provider-model-selection.title') }}
          </h2>
          <div :class="['text-neutral-400', 'dark:text-neutral-500']">
            <span>{{ t('settings.pages.modules.vision.sections.section.provider-model-selection.subtitle') }}</span>
          </div>
        </div>

        <div
          :class="[
            'flex',
            'items-center',
            'gap-3',
            'rounded-lg',
            'border',
            'border-primary-200',
            'bg-primary-50',
            'p-4',
            'dark:border-primary-800',
            'dark:bg-primary-900/20',
          ]"
        >
          <div :class="['text-2xl', 'text-primary-500', 'dark:text-primary-400', 'i-solar:info-circle-line-duotone']" />
          <div :class="['flex', 'flex-col']">
            <span :class="['font-medium']">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported') }}
            </span>
            <span :class="['text-sm', 'text-primary-600', 'dark:text-primary-400']">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported_description') }}
            </span>
          </div>
        </div>

        <div :class="['mt-2']">
          <label :class="['mb-1', 'block', 'text-sm', 'font-medium']">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
          </label>
          <input
            v-model="activeModel"
            type="text"
            :class="[
              'w-full',
              'rounded',
              'border',
              'border-neutral-300',
              'bg-white',
              'px-3',
              'py-2',
              'dark:border-neutral-700',
              'dark:bg-neutral-900',
            ]"
            :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
            @input="persistSelection"
          >
        </div>
      </div>
    </SettingsCard>

    <SettingsCard>
      <section :class="['flex', 'flex-col', 'gap-4']">
        <h2 :class="['text-lg', 'text-neutral-500', 'md:text-2xl', 'dark:text-neutral-400']">
          {{ t('settings.pages.modules.vision.sections.section.model-options.title') }}
        </h2>
        <FieldCheckbox
          v-model="useForChat"
          :label="t('stage.chat.images.use-vision')"
          :description="t('stage.chat.images.use-vision-description')"
        />
        <FieldCheckbox
          v-model="useForToolImages"
          :label="t('settings.pages.modules.vision.tool-images.label')"
          :description="t('settings.pages.modules.vision.tool-images.description')"
        />
        <FieldCheckbox
          v-if="isOllamaVisionProvider"
          v-model="ollamaThinkingEnabled"
          :label="t('settings.pages.modules.vision.ollama.thinking.label')"
          :description="t('settings.pages.modules.vision.ollama.thinking.description')"
        />
        <FieldCheckbox
          :model-value="showProviderHealth"
          :label="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.show_provider_health.label')"
          :description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.show_provider_health.description')"
          @update:model-value="updateShowProviderHealth"
        />
      </section>
    </SettingsCard>

    <SettingsCard>
      <div :class="['flex', 'flex-col', 'gap-4']">
        <div>
          <h2 :class="['text-lg', 'text-neutral-500', 'md:text-2xl', 'dark:text-neutral-400']">
            {{ t('settings.pages.modules.vision.capture.title') }}
          </h2>
          <div :class="['text-neutral-400', 'dark:text-neutral-400']">
            {{ t('settings.pages.modules.vision.capture.description') }}
          </div>
        </div>

        <FieldRange
          v-model="captureIntervalMs"
          :label="t('settings.pages.modules.vision.capture.interval.label')"
          :description="t('settings.pages.modules.vision.capture.interval.description')"
          :min="500"
          :max="15000"
          :step="250"
          :format-value="value => `${(value / 1000).toFixed(2)}s`"
        />

        <div :class="['grid', 'gap-4', 'md:grid-cols-3']">
          <div :class="['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'dark:border-neutral-800', 'dark:bg-neutral-900']">
            <div :class="['text-xs', 'uppercase', 'tracking-wide', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.captures') }}
            </div>
            <div :class="['text-sm', 'font-medium', 'text-neutral-600', 'dark:text-neutral-200']">
              {{ captureCount }}
            </div>
            <div :class="['text-xs', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.last-update', { time: formattedLastCapture }) }}
            </div>
          </div>

          <div :class="['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'dark:border-neutral-800', 'dark:bg-neutral-900']">
            <div :class="['text-xs', 'uppercase', 'tracking-wide', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.context-updates') }}
            </div>
            <div :class="['text-sm', 'font-medium', 'text-neutral-600', 'dark:text-neutral-200']">
              {{ contextUpdateCount }}
            </div>
            <div :class="['text-xs', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.last-update', { time: formattedLastContextUpdate }) }}
            </div>
          </div>

          <div :class="['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'dark:border-neutral-800', 'dark:bg-neutral-900']">
            <div :class="['text-xs', 'uppercase', 'tracking-wide', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.inferences') }}
            </div>
            <div :class="['text-sm', 'font-medium', 'text-neutral-600', 'dark:text-neutral-200']">
              {{ inferenceCount }}
            </div>
            <div :class="['text-xs', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.inferences-description') }}
            </div>
          </div>

          <div :class="['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'dark:border-neutral-800', 'dark:bg-neutral-900']">
            <div :class="['text-xs', 'uppercase', 'tracking-wide', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.failed-inferences') }}
            </div>
            <div :class="['text-sm', 'font-medium', failedInferenceCountClass]">
              {{ failedInferenceCount }}
            </div>
            <div :class="['text-xs', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.since-start') }}
            </div>
          </div>

          <div :class="['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'p-3', 'dark:border-neutral-800', 'dark:bg-neutral-900']">
            <div :class="['text-xs', 'uppercase', 'tracking-wide', 'text-neutral-400']">
              {{ t('settings.pages.modules.vision.stats.last-inference') }}
            </div>
            <div :class="['text-sm', 'font-medium', 'text-neutral-600', 'dark:text-neutral-200']">
              {{ formattedLastInference }}
            </div>
            <div v-if="lastInference" :class="['text-xs', 'text-neutral-400']">
              {{ lastInferenceProviderName }} / {{ lastInference.model }} · {{ formattedLastInferenceDuration }}
            </div>
            <div
              v-if="lastInference?.error"
              :class="['mt-1', 'flex', 'items-start', 'gap-1', 'text-xs', 'text-red-500']"
            >
              <div :class="['mt-0.5', 'shrink-0', 'i-solar:danger-triangle-bold-duotone']" />
              <span :class="['max-h-40', 'overflow-y-auto', 'whitespace-pre-wrap']">
                <span :class="['font-medium']">{{ t('settings.pages.modules.vision.stats.error') }}</span>
                {{ lastInference.error }}
              </span>
            </div>
            <div
              v-else-if="lastInference"
              :class="['mt-1', 'max-h-40', 'overflow-y-auto', 'whitespace-pre-wrap', 'text-xs', 'text-neutral-500']"
            >
              {{ lastInference.text }}
            </div>
          </div>
        </div>
      </div>
    </SettingsCard>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.vision.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
