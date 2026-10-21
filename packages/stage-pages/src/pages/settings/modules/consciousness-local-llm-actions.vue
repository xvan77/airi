<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LOCAL_LLM_BASE_CATALOG } from '../../../lib/local-llm-catalog'

const props = defineProps<{
  activeModel: string
  showQuickDownload?: boolean
  serverState: string
  downloadedModels: string[]
  isStartingServer: boolean
  isDownloading: boolean
  downloadProgressPercent: number | null
  canStartServer: boolean
  downloadInProgress: boolean
}>()

const emit = defineEmits<{
  startServer: []
  stopServer: []
  quickDownload: [entry: typeof LOCAL_LLM_BASE_CATALOG[number]]
}>()

const { t } = useI18n()

const isRunning = computed(() => props.serverState === 'running' || props.serverState === 'starting')
</script>

<template>
  <div
    class="flex flex-col gap-3 border border-amber-500/20 rounded-xl bg-amber-500/5 p-4 text-neutral-900 dark:bg-amber-900/10 dark:text-neutral-100"
  >
    <div class="flex items-start gap-3">
      <div class="i-solar:warning-circle-bold-duotone shrink-0 text-2xl text-amber-500" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-bold">
          {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.offline_title') }}
        </span>
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.offline_description') }}
        </span>
        <span
          v-if="downloadProgressPercent !== null"
          class="text-xs text-amber-600 dark:text-amber-400"
        >
          {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.downloading', { progress: downloadProgressPercent }) }}
        </span>
      </div>
    </div>

    <div v-if="showQuickDownload && downloadedModels.length === 0" class="flex flex-col gap-2">
      <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
        {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.quick_download') }}
      </span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="entry in LOCAL_LLM_BASE_CATALOG"
          :key="entry.id"
          type="button"
          class="border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold transition dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-900"
          :disabled="isDownloading"
          @click="emit('quickDownload', entry)"
        >
          {{ entry.name }}
        </button>
      </div>
    </div>

    <div class="mt-1 flex flex-wrap items-center justify-end gap-2">
      <button
        v-if="isRunning"
        type="button"
        class="flex items-center gap-1 border border-red-500/20 rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-500 font-bold transition hover:bg-red-500/20"
        @click="emit('stopServer')"
      >
        <div class="i-solar:stop-circle-line-duotone" />
        {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.stop_server') }}
      </button>
      <button
        v-else-if="downloadInProgress"
        type="button"
        disabled
        class="flex cursor-not-allowed items-center gap-1 border border-amber-500/20 rounded bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 font-bold opacity-80 dark:text-amber-400"
      >
        <div class="i-solar:refresh-line-duotone animate-spin text-sm" />
        {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.downloading_button') }}
      </button>
      <button
        v-else-if="canStartServer"
        type="button"
        class="flex items-center gap-1 border border-green-500/20 rounded bg-green-500/10 px-3 py-1.5 text-xs text-green-600 font-bold transition disabled:cursor-not-allowed hover:bg-green-500/20 dark:text-green-500 disabled:opacity-50"
        :disabled="isStartingServer"
        @click="emit('startServer')"
      >
        <div class="i-solar:play-circle-line-duotone" />
        {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.start_server') }}
      </button>
    </div>
  </div>
</template>
