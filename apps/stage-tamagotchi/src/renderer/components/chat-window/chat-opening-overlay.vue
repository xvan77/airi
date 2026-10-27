<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  show: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-show="show"
    :class="[
      'absolute inset-0 z-[200] flex flex-col items-center justify-center gap-4',
      'bg-white/96 text-neutral-800 ring-1 ring-neutral-200/80 backdrop-blur-lg',
      'dark:bg-neutral-950/96 dark:text-neutral-100 dark:ring-neutral-700/80',
    ]"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="i-solar:refresh-line-duotone animate-spin text-4xl text-primary-500" />
    <p class="text-base text-neutral-800 font-semibold tracking-wide dark:text-neutral-100">
      {{ t('settings.dialogs.onboarding.localChatTtsOffer.loadingChat') }}
    </p>
  </div>
</template>
