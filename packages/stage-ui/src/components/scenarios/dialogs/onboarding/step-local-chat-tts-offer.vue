<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  onChooseLocalTts: (enable: boolean) => void
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}>()

const { t } = useI18n()

function handleChoice(enable: boolean) {
  props.onChooseLocalTts(enable)
  props.onNext()
}
</script>

<template>
  <div h-full flex flex-col gap-6>
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      flex items-center gap-2
    >
      <button outline-none @click="props.onPrevious">
        <div class="i-solar:alt-arrow-left-line-duotone h-5 w-5 transition-colors hover:text-primary-500" />
      </button>
      <h2 class="flex-1 text-center text-2xl text-neutral-800 font-semibold md:text-left md:text-3xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.localChatTtsOffer.title') }}
      </h2>
      <div class="h-5 w-5" />
    </div>

    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-1">
      <p
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1 }"
        :duration="500"
        :delay="100"
        class="text-base text-neutral-700 leading-relaxed md:text-lg dark:text-neutral-300"
      >
        {{ t('settings.dialogs.onboarding.localChatTtsOffer.lead') }}
      </p>
      <p
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1 }"
        :duration="500"
        :delay="150"
        class="text-base text-neutral-700 leading-relaxed md:text-lg dark:text-neutral-300"
      >
        {{ t('settings.dialogs.onboarding.localChatTtsOffer.ttsPrompt') }}
      </p>
      <p
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1 }"
        :duration="500"
        :delay="200"
        class="text-sm text-neutral-600 leading-relaxed md:text-base dark:text-neutral-400"
      >
        {{ t('settings.dialogs.onboarding.localChatTtsOffer.ttsNote') }}
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <Button
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="300"
        block
        color="primary"
        variant="primary"
        size="lg"
        :label="t('settings.dialogs.onboarding.localChatTtsOffer.yes')"
        @click="handleChoice(true)"
      />
      <Button
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="350"
        block
        variant="secondary"
        size="lg"
        :class="['!bg-neutral-200 !text-neutral-800 dark:!bg-neutral-700 dark:!text-neutral-100']"
        :label="t('settings.dialogs.onboarding.localChatTtsOffer.no')"
        @click="handleChoice(false)"
      />
    </div>
  </div>
</template>
