<script setup lang="ts">
import type { ChatSetupBlocker } from '../../../../stores/modules/consciousness'

import { BasicButton, Callout } from '@proj-airi/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  blocker?: Exclude<ChatSetupBlocker, 'none'>
}>(), {
  blocker: 'select-model',
})

const emit = defineEmits<{
  /** The host opens the provider settings. Each host has its own way to open them. */
  configure: []
}>()

const { t } = useI18n()

const copyKey = computed(() => {
  if (props.blocker === 'provider-credentials')
    return 'provider-credentials'
  return 'provider-configuration'
})
</script>

<template>
  <Callout
    theme="orange"
    :label="t(`stage.chat.${copyKey}.title`)"
  >
    <div :class="['flex flex-wrap items-center justify-between gap-2']">
      <span :class="['min-w-48 flex-1 text-sm']">
        {{ t(`stage.chat.${copyKey}.description`) }}
      </span>
      <BasicButton
        size="unset"
        :class="['rounded-lg bg-primary-500 px-3 py-1 text-sm text-white']"
        @click="emit('configure')"
      >
        {{ t(`stage.chat.${copyKey}.action`) }}
      </BasicButton>
    </div>
  </Callout>
</template>
