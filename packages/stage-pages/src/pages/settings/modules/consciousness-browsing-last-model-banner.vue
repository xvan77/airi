<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  modelId: string
}>()

const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    :class="[
      'inline-flex max-w-full flex-row flex-wrap items-center gap-x-1 gap-y-1 rounded-xl border border-amber-500/25',
      'bg-amber-500/5 p-2.5',
      'dark:border-amber-500/20 dark:bg-amber-900/10',
    ]"
  >
    <span
      :class="[
        'text-xs leading-snug font-medium text-neutral-500 dark:text-neutral-400',
      ]"
    >
      {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.browsing_last_model.label') }}
    </span>
    <span
      :class="[
        'ml-0.5 break-all font-mono text-xs text-neutral-800 dark:text-neutral-100',
      ]"
      :title="modelId"
    >
      {{ modelId }}
    </span>
    <button
      type="button"
      :class="[
        'ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1',
        'text-xs font-semibold text-white',
        'bg-amber-500 transition hover:bg-amber-600',
      ]"
      @click="emit('select')"
    >
      <div class="i-solar:check-circle-line-duotone text-base" aria-hidden="true" />
      {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.browsing_last_model.select') }}
    </button>
  </div>
</template>
