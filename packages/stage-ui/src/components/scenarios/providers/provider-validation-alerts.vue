<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Alert from '../../misc/alert.vue'

const props = withDefaults(defineProps<{
  isValid: boolean
  isValidating: number
  validationMessage: string
  hasManualValidators: boolean
  isManualTesting: boolean
  manualTestPassed: boolean
  manualTestMessage: string
  manualTestProgressLines?: string[]
  onRunTest: () => void
  onForceValid: () => void
  onGoToModelSelection: () => void
  onCancelManualPing?: () => void
  onSkipNextPingModel?: () => void
}>(), {
  manualTestProgressLines: () => [],
})

const { t } = useI18n()
</script>

<template>
  <!-- Validation Running -->
  <Alert v-if="isValidating > 0" type="loading">
    <template #title>
      {{ t('settings.dialogs.onboarding.validationRunning') }}
    </template>
  </Alert>
  <!-- Manual Ping in progress -->
  <Alert v-else-if="isManualTesting" type="loading">
    <template #title>
      {{ t('settings.dialogs.onboarding.testGenerationRunning') }}
    </template>
    <template #content>
      <ul
        v-if="props.manualTestProgressLines.length > 0"
        :class="['list-disc pl-4 text-sm space-y-1']"
      >
        <li v-for="(line, index) in props.manualTestProgressLines" :key="index">
          {{ line }}
        </li>
      </ul>
      <div
        v-if="props.hasManualValidators && (props.onCancelManualPing || props.onSkipNextPingModel)"
        :class="['mt-3 flex flex-wrap gap-2']"
      >
        <button
          v-if="onCancelManualPing"
          type="button"
          :class="['rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-blue-900/40 text-blue-200 hover:bg-blue-900/60', 'dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-900/50']"
          @click="props.onCancelManualPing?.()"
        >
          {{ t('settings.dialogs.onboarding.cancelPingCheck') }}
        </button>
        <button
          v-if="onSkipNextPingModel"
          type="button"
          :class="['rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-blue-900/40 text-blue-200 hover:bg-blue-900/60', 'dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-900/50']"
          @click="props.onSkipNextPingModel?.()"
        >
          {{ t('settings.dialogs.onboarding.tryAnotherPingModel') }}
        </button>
      </div>
    </template>
  </Alert>
  <!-- Validation Error -->
  <Alert v-else-if="!isValid && isValidating === 0 && validationMessage" type="error">
    <template #title>
      <div :class="['w-full flex items-center justify-between']">
        <span>{{ t('settings.dialogs.onboarding.validationFailed') }}</span>
        <button
          v-if="!hasManualValidators"
          type="button"
          :class="['ml-2 rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-red-100 text-red-600 hover:bg-red-200', 'dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-700/40']"
          @click="props.onForceValid"
        >
          {{ t('settings.pages.providers.common.continueAnyway') }}
        </button>
      </div>
    </template>
    <template v-if="validationMessage" #content>
      <div :class="['whitespace-pre-wrap break-all']">
        {{ validationMessage }}
      </div>
    </template>
  </Alert>
  <!-- Partial: auto validation passed, manual test not yet attempted -->
  <Alert v-else-if="isValid && isValidating === 0 && hasManualValidators && !manualTestPassed && !manualTestMessage" type="info">
    <template #title>
      <div :class="['w-full flex items-center justify-between']">
        <span>{{ t('settings.dialogs.onboarding.validationPartial') }}</span>
        <div :class="['flex items-center gap-2']">
          <button
            type="button"
            :disabled="isManualTesting"
            :class="['rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-blue-100 text-blue-600 hover:bg-blue-200', 'dark:bg-blue-800/30 dark:text-blue-300 dark:hover:bg-blue-700/40', isManualTesting ? 'cursor-not-allowed opacity-50' : '']"
            @click="props.onRunTest"
          >
            {{ isManualTesting ? t('settings.dialogs.onboarding.testGenerationRunning') : t('settings.dialogs.onboarding.testGeneration') }}
          </button>
        </div>
      </div>
    </template>
  </Alert>
  <!-- Full success -->
  <Alert v-else-if="isValid && isValidating === 0 && (!hasManualValidators || manualTestPassed)" type="success">
    <template #title>
      <div :class="['w-full flex items-center justify-between']">
        <span>{{ t('settings.dialogs.onboarding.validationSuccess') }}</span>
        <button
          type="button"
          :class="['ml-2 rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-green-100 text-green-600 hover:bg-green-200', 'dark:bg-green-800/30 dark:text-green-300 dark:hover:bg-green-700/40']"
          @click="props.onGoToModelSelection"
        >
          {{ t('settings.pages.providers.common.goToModelSelection') }}
        </button>
      </div>
    </template>
  </Alert>
  <!-- Manual test failed -->
  <Alert v-else-if="hasManualValidators && !manualTestPassed && manualTestMessage && !isManualTesting" type="error">
    <template #title>
      <div :class="['w-full flex items-center justify-between']">
        <span>{{ t('settings.dialogs.onboarding.testGenerationFailed') }}</span>
        <div :class="['flex items-center gap-2']">
          <button
            type="button"
            :class="['rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-red-100 text-red-600 hover:bg-red-200', 'dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-700/40']"
            @click="props.onRunTest"
          >
            {{ t('settings.dialogs.onboarding.retryPingCheck') }}
          </button>
          <button
            v-if="!hasManualValidators"
            type="button"
            :class="['rounded px-2 py-0.5 text-xs font-medium transition-colors', 'bg-red-100 text-red-600 hover:bg-red-200', 'dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-700/40']"
            @click="props.onForceValid"
          >
            {{ t('settings.pages.providers.common.continueAnyway') }}
          </button>
        </div>
      </div>
    </template>
    <template #content>
      <ul
        v-if="props.manualTestProgressLines.length > 0"
        :class="['mb-2 list-disc pl-4 text-sm space-y-1 opacity-80']"
      >
        <li v-for="(line, index) in props.manualTestProgressLines" :key="index">
          {{ line }}
        </li>
      </ul>
      <div :class="['whitespace-pre-wrap break-all']">
        {{ manualTestMessage }}
      </div>
    </template>
  </Alert>
  <!-- Always offer Consciousness while Ping is optional or in progress; hide after Ping succeeds -->
  <div
    v-if="hasManualValidators && isValid && isValidating === 0 && !manualTestPassed"
    class="mt-2 flex flex-col gap-3 border border-amber-200/60 rounded-xl bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20"
  >
    <div class="flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
      <p>
        {{ t('settings.dialogs.onboarding.chatPingPartialNoteLead') }}
      </p>
      <p>
        {{ t('settings.dialogs.onboarding.chatPingPartialNoteSkip') }}
      </p>
    </div>
    <button
      type="button"
      class="max-w-md w-full flex items-center self-start gap-1.5 rounded-lg bg-amber-50/90 px-3 py-2 text-sm text-amber-800 font-medium transition-colors dark:bg-amber-900/35 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-800/45"
      @click="props.onGoToModelSelection"
    >
      <div class="i-solar:settings-bold-duotone text-lg" aria-hidden="true" />
      {{ t('settings.pages.providers.common.goToModelSelection') }}
      <div class="i-solar:arrow-right-linear text-base opacity-70" aria-hidden="true" />
    </button>
  </div>
</template>
