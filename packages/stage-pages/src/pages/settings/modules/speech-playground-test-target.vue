<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelId: string
  voiceName: string
  mismatchesBrowse: boolean
  needsVoiceSelection: boolean
}>()

const { t } = useI18n()

const hintText = computed(() => {
  if (props.needsVoiceSelection)
    return t('settings.pages.modules.speech.sections.section.playground.testing.select_voice_first')
  if (props.mismatchesBrowse)
    return t('settings.pages.modules.speech.sections.section.playground.testing.not_the_list')
  return ''
})
</script>

<template>
  <div
    :class="[
      'inline-flex max-w-full flex-col gap-1 rounded-xl border px-2.5 py-1.5',
      hintText
        ? 'border-amber-500/25 bg-amber-500/5 dark:border-amber-500/20 dark:bg-amber-900/10'
        : 'border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/40',
    ]"
  >
    <div :class="['flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5']">
      <span
        :class="[
          'shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400',
        ]"
      >
        {{ t('settings.pages.modules.speech.sections.section.playground.testing.label') }}
      </span>
      <span
        v-if="modelId || voiceName"
        :class="['min-w-0 text-xs']"
      >
        <span :class="['text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.modules.speech.sections.section.playground.testing.model') }}
        </span>
        <span
          :class="[
            'ml-1 break-all font-mono text-neutral-800 dark:text-neutral-100',
          ]"
          :title="modelId"
        >
          {{ modelId }}
        </span>
      </span>
      <span
        v-if="modelId || voiceName"
        :class="['min-w-0 text-xs']"
      >
        <span :class="['text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.modules.speech.sections.section.playground.testing.voice') }}
        </span>
        <span
          :class="[
            'ml-1 break-all font-medium text-neutral-800 dark:text-neutral-100',
          ]"
          :title="voiceName"
        >
          {{ voiceName }}
        </span>
      </span>
      <span
        v-else
        :class="['text-xs text-neutral-500 dark:text-neutral-400']"
      >
        {{ t('settings.pages.modules.speech.sections.section.playground.testing.empty') }}
      </span>
    </div>
    <span
      v-if="hintText"
      :class="[
        'text-xs leading-snug text-amber-700 dark:text-amber-300',
      ]"
    >
      {{ hintText }}
    </span>
  </div>
</template>
