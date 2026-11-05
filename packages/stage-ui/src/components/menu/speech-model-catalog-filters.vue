<script setup lang="ts">
import type { SpeechCatalogSortDirection, SpeechCatalogSortKey } from '../../libs/speech-catalog'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  disableClearDownloads?: boolean
}>(), {
  disableClearDownloads: false,
})
const emit = defineEmits<{
  clearDownloads: []
}>()
const sortKey = defineModel<SpeechCatalogSortKey>('sortKey', { required: true })
const sortDirection = defineModel<SpeechCatalogSortDirection>('sortDirection', { required: true })

const { t } = useI18n()

const sortOptions = ['disk', 'quant', 'backend'] as const satisfies readonly SpeechCatalogSortKey[]

const sortDirectionMark = computed(() => sortDirection.value === 'asc' ? '↑' : '↓')

function selectSort(option: SpeechCatalogSortKey) {
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
    <div class="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex flex-row flex-wrap items-center gap-2">
        <span class="text-neutral-400 font-medium dark:text-neutral-500">
          {{ t('settings.pages.modules.speech.model_catalog.filters.sort') }}
        </span>
        <div class="flex flex-row flex-wrap items-center gap-1">
          <button
            v-for="opt in sortOptions"
            :key="opt"
            type="button"
            class="rounded-md px-2 py-0.5 transition-all"
            :class="sortKey === opt
              ? 'bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700 dark:bg-neutral-800 dark:hover:text-neutral-300'"
            @click="selectSort(opt)"
          >
            {{ t(`settings.pages.modules.speech.model_catalog.sort.${opt}`) }}
            <span v-if="sortKey === opt" class="ml-0.5">{{ sortDirectionMark }}</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        :class="[
          'shrink-0 rounded-md border px-2.5 py-0.5 font-medium transition-all',
          'border-amber-500/35 bg-amber-50 text-amber-800',
          'hover:border-amber-500/55 hover:bg-amber-100',
          'dark:border-amber-500/30 dark:bg-amber-900/25 dark:text-amber-200',
          'dark:hover:border-amber-400/45 dark:hover:bg-amber-900/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ]"
        :disabled="props.disableClearDownloads"
        @click="emit('clearDownloads')"
      >
        {{ t('settings.pages.modules.speech.model_catalog.clear_downloads') }}
      </button>
    </div>
  </div>
</template>
