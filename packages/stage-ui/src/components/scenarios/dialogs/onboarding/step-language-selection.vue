<script setup lang="ts">
import type { OnboardingStepNextHandler } from './types'

import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

import { useOnboardingLanguageCardSync } from '../../../../composables/use-onboarding-language-card-sync'

const props = defineProps<{
  onNext: OnboardingStepNextHandler
}>()

const { t } = useI18n()
const { applyLanguage, language, languages } = useOnboardingLanguageCardSync()
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <div class="flex flex-1 flex-col justify-center gap-4 text-center md:text-left">
      <h2 class="text-2xl text-neutral-800 font-bold md:text-3xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.languageStep.title') }}
      </h2>
      <p class="text-sm text-neutral-600 leading-relaxed md:text-base dark:text-neutral-400">
        {{ t('settings.dialogs.onboarding.languageStep.description') }}
      </p>
      <p class="text-xs text-neutral-500 dark:text-neutral-500">
        {{ t('settings.dialogs.onboarding.languageStep.cardHint') }}
      </p>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          v-for="lang in languages"
          :key="lang.value"
          type="button"
          :class="[
            'rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all',
            lang.value === language
              ? 'border-primary-400 bg-primary-50/80 text-primary-700 dark:border-primary-600 dark:bg-primary-950/40 dark:text-primary-200'
              : 'border-neutral-200 bg-white/60 text-neutral-700 hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:border-primary-700',
          ]"
          @click="applyLanguage(lang.value)"
        >
          {{ lang.label }}
        </button>
      </div>
    </div>

    <Button
      color="primary"
      variant="primary"
      size="lg"
      :label="t('settings.dialogs.onboarding.languageStep.continue')"
      :disabled="!language"
      @click="props.onNext"
    />
  </div>
</template>
