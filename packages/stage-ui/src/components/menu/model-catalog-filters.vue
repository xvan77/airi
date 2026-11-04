<script setup lang="ts">
import type {
  ModelCatalogDeploymentFilter,
  ModelCatalogPricingFilter,
  ModelCatalogSortDirection,
  ModelCatalogSortKey,
} from '../../libs/model-catalog'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const pricing = defineModel<ModelCatalogPricingFilter>('pricing', { required: true })
const deployment = defineModel<ModelCatalogDeploymentFilter>('deployment', { required: true })
const sortKey = defineModel<ModelCatalogSortKey>('sortKey', { required: true })
const sortDirection = defineModel<ModelCatalogSortDirection>('sortDirection', { required: true })

const { t } = useI18n()

const pricingOptions = ['all', 'free', 'paid'] as const satisfies readonly ModelCatalogPricingFilter[]
const deploymentOptions = ['all', 'local', 'cloud'] as const satisfies readonly ModelCatalogDeploymentFilter[]
const sortOptions = ['default', 'params', 'context', 'disk', 'quant', 'price'] as const satisfies readonly ModelCatalogSortKey[]

const sortDirectionMark = computed(() => sortDirection.value === 'asc' ? '↑' : '↓')

function selectSort(option: ModelCatalogSortKey) {
  if (sortKey.value === option) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = option
    sortDirection.value = 'asc'
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 text-xs">
    <div class="flex flex-row flex-wrap items-center gap-3">
      <div class="flex flex-row flex-wrap items-center gap-2">
        <span class="text-neutral-400 font-medium dark:text-neutral-500">
          {{ t('settings.pages.modules.consciousness.model_catalog.filters.pricing') }}
        </span>
        <div class="flex flex-row items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          <button
            v-for="opt in pricingOptions"
            :key="opt"
            type="button"
            class="rounded-md px-2 py-0.5 transition-all"
            :class="pricing === opt
              ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-neutral-700 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="pricing = opt"
          >
            {{ t(`settings.pages.providers.filters.${opt}`) }}
          </button>
        </div>
      </div>

      <div class="flex flex-row flex-wrap items-center gap-2">
        <span class="text-neutral-400 font-medium dark:text-neutral-500">
          {{ t('settings.pages.modules.consciousness.model_catalog.filters.deployment') }}
        </span>
        <div class="flex flex-row items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          <button
            v-for="opt in deploymentOptions"
            :key="opt"
            type="button"
            class="rounded-md px-2 py-0.5 transition-all"
            :class="deployment === opt
              ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-neutral-700 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="deployment = opt"
          >
            {{ t(`settings.pages.providers.filters.${opt}`) }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-row flex-wrap items-center gap-2">
      <span class="text-neutral-400 font-medium dark:text-neutral-500">
        {{ t('settings.pages.modules.consciousness.model_catalog.filters.sort') }}
      </span>
      <div class="flex flex-row flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
        <button
          v-for="opt in sortOptions"
          :key="opt"
          type="button"
          class="rounded-md px-2 py-0.5 transition-all"
          :class="sortKey === opt
            ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-neutral-700 dark:text-primary-400'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
          @click="selectSort(opt)"
        >
          {{ t(`settings.pages.modules.consciousness.model_catalog.sort.${opt}`) }}
          <span v-if="sortKey === opt" class="ml-0.5" aria-hidden="true">{{ sortDirectionMark }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
