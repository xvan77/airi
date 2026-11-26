<script setup lang="ts">
import { LOCAL_LLM_BASE_CATALOG } from '@proj-airi/stage-ui/libs/local-llm-catalog'
import { useI18n } from 'vue-i18n'

defineProps<{
  isDownloading: boolean
}>()

const emit = defineEmits<{
  quickDownload: [entry: typeof LOCAL_LLM_BASE_CATALOG[number]]
}>()

const { t } = useI18n()
</script>

<template>
  <div :class="['flex flex-col gap-2']">
    <span :class="['text-xs text-neutral-600 font-medium dark:text-neutral-300']">
      {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.local_llm.quick_download') }}
    </span>
    <div :class="['flex flex-wrap gap-2']">
      <button
        v-for="entry in LOCAL_LLM_BASE_CATALOG"
        :key="entry.id"
        type="button"
        :class="[
          'border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold transition',
          'dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-900',
        ]"
        :disabled="isDownloading"
        @click="emit('quickDownload', entry)"
      >
        {{ entry.name }}
      </button>
    </div>
  </div>
</template>
