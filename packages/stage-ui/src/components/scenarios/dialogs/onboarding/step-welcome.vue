<script setup lang="ts">
import type { OnboardingSetupMode, OnboardingStepNextHandler } from './types'

import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

import onboardingLogo from '../../../../assets/onboarding.avif'

import { AIRI_FLUX_URL, AIRI_TERMS_URL } from '../../../../constants/public-links'
import { useAuthStore } from '../../../../stores/auth'
import { useOnboardingStore } from '../../../../stores/onboarding'

interface Props {
  customProviderSetupEnabled: boolean
  localSetupEnabled?: boolean
  onStartSetup: (mode: OnboardingSetupMode) => void
  onNext: OnboardingStepNextHandler
}

const props = withDefaults(defineProps<Props>(), {
  localSetupEnabled: false,
})
const { t } = useI18n()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()

async function handleLogin() {
  onboardingStore.showingSetup = false
  await authStore.requestLogin()
}

function handleSetupMode(mode: OnboardingSetupMode) {
  props.onStartSetup(mode)
  props.onNext()
}
</script>

<template>
  <div relative h-full flex flex-col>
    <div :class="['mb-2', 'flex', 'flex-1', 'flex-col', 'justify-center', 'text-center', 'md:mb-8']">
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.5 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="500"
        :class="['mb-1', 'flex', 'justify-center', 'md:mb-4', 'md:pt-8', 'lg:pt-16']"
      >
        <img :src="onboardingLogo" max-h="50" aspect-square h-auto w-auto select-none object-cover>
      </div>
      <h2
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :class="['mb-0', 'text-3xl', 'text-neutral-800', 'font-bold', 'md:mb-2', 'dark:text-neutral-100']"
      >
        {{ t('settings.dialogs.onboarding.title') }}
      </h2>
      <p
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="500"
        :delay="100"
        :class="['text-sm', 'text-neutral-600', 'md:text-lg', 'dark:text-neutral-400']"
      >
        {{ t('settings.dialogs.onboarding.description') }}
      </p>
    </div>
    <div :class="['mx-2 flex flex-col items-stretch gap-2']">
      <Button
        v-motion="{
          initial: { opacity: 0, y: 8 },
          enter: { opacity: 1, y: 0 },
          duration: 500,
          delay: 200,
        }"
        color="primary"
        variant="primary"
        size="lg"
        :label="t('settings.dialogs.onboarding.loginAction')"
        @click="handleLogin"
      />
      <Button
        v-if="props.localSetupEnabled"
        v-motion="{
          initial: { opacity: 0 },
          enter: { opacity: 1 },
          duration: 500,
          delay: 250,
        }"
        variant="secondary"
        :outline="false"
        :class="['!bg-neutral-200 !text-neutral-800 dark:!bg-neutral-700 dark:!text-neutral-100']"
        :label="t('settings.dialogs.onboarding.modeSelection.local.title')"
        @click="handleSetupMode('local')"
      />
      <Button
        v-if="props.customProviderSetupEnabled"
        v-motion="{
          initial: { opacity: 0 },
          enter: { opacity: 1 },
          duration: 500,
          delay: 300,
        }"
        variant="secondary"
        :outline="false"
        :class="['!bg-neutral-200 !text-neutral-800 dark:!bg-neutral-700 dark:!text-neutral-100']"
        :label="t('settings.dialogs.onboarding.modeSelection.custom.title')"
        @click="handleSetupMode('custom')"
      />
    </div>
    <nav
      v-motion="{
        initial: { opacity: 0 },
        enter: { opacity: 1 },
        duration: 500,
        delay: 350,
      }"
      :class="[
        'mx-2 mb-1 mt-8 md:mt-10',
        'flex items-center justify-center gap-3',
        'text-xs text-neutral-500 dark:text-neutral-500',
      ]"
    >
      <a
        :href="AIRI_FLUX_URL"
        target="_blank"
        rel="noopener noreferrer"
        :class="['underline-offset-4 transition-colors hover:text-neutral-700 hover:underline dark:hover:text-neutral-200']"
      >
        {{ t('settings.dialogs.onboarding.pricingLink') }}
      </a>
      <span aria-hidden="true" :class="['size-0.5 rounded-full bg-current']" />
      <a
        :href="AIRI_TERMS_URL"
        target="_blank"
        rel="noopener noreferrer"
        :class="['underline-offset-4 transition-colors hover:text-neutral-700 hover:underline dark:hover:text-neutral-200']"
      >
        {{ t('settings.dialogs.onboarding.termsLink') }}
      </a>
    </nav>
  </div>
</template>
