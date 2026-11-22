<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  /** Visible break between the pricing and source sentences. */
  lineDivider?: boolean
}>(), {
  lineDivider: false,
})

const { t } = useI18n()

const keywordClass = 'font-semibold text-neutral-900 dark:text-neutral-100'

const lineClass = 'min-w-0 text-[13px] text-neutral-400 leading-snug dark:text-neutral-500'

const rootClass = computed(() => {
  if (props.lineDivider)
    return 'flex w-full min-w-0 flex-col gap-1'
  return [
    'flex w-full min-w-0 flex-col gap-1',
    'lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-4 lg:gap-y-1',
  ]
})

const nowrapClass = computed(() => props.lineDivider ? '' : 'lg:whitespace-nowrap')
</script>

<template>
  <div :class="rootClass">
    <p :class="[lineClass, nowrapClass]">
      <span :class="[keywordClass, 'mr-1']">{{ t('settings.pages.providers.filters.glossary.note') }}</span>
      <i18n-t keypath="settings.pages.providers.filters.glossary.pricing" scope="global">
        <template #free>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.free') }}</span>
        </template>
        <template #limited>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.limited') }}</span>
        </template>
        <template #paid>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.paid') }}</span>
        </template>
      </i18n-t>
    </p>
    <div
      v-if="lineDivider"
      class="flex items-center gap-2 py-0.5"
      aria-hidden="true"
    >
      <div class="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">/</span>
      <div class="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
    </div>
    <p :class="[lineClass, nowrapClass]">
      <i18n-t keypath="settings.pages.providers.filters.glossary.source" scope="global">
        <template #inApp>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.in-app') }}</span>
        </template>
        <template #otherApp>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.other-app') }}</span>
        </template>
        <template #cloud>
          <span :class="keywordClass">{{ t('settings.pages.providers.filters.cloud') }}</span>
        </template>
      </i18n-t>
    </p>
  </div>
</template>
