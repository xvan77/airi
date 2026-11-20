<script setup lang="ts">
import { computed } from 'vue'

import { Range } from '../range'

const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  label?: string
  description?: string
  formatValue?: (value: number) => string
  as?: 'label' | 'div'
  /**
   * When provided, renders a reset control next to the label that restores the
   * value to this default. Prefer `as="div"` when using this, since the reset
   * button should not live inside a `<label>` element.
   */
  defaultValue?: number
  /** Tighter layout for dense settings panels such as the speech audio console. */
  density?: 'default' | 'compact'
}>(), {
  as: 'label',
  density: 'default',
})

const modelValue = defineModel<number>({ required: true })

const formattedValue = computed(() => {
  const value = modelValue.value
  return props.formatValue?.(value) ?? String(value)
})

function resetToDefault() {
  if (props.defaultValue !== undefined)
    modelValue.value = props.defaultValue
}
</script>

<template>
  <props.as
    :class="[
      'flex flex-col',
      density === 'compact' ? 'gap-1' : 'gap-4',
    ]"
  >
    <template v-if="density === 'compact'">
      <div :class="['flex min-w-0 flex-col gap-0.5']">
        <div :class="['flex items-baseline justify-between gap-2']">
          <div :class="['flex min-w-0 items-baseline gap-1 text-sm font-medium']">
            <slot name="label">
              {{ label }}
            </slot>
            <button
              v-if="defaultValue !== undefined"
              type="button"
              title="Reset to default"
              :class="['px-1', 'text-xs', 'outline-none']"
              @click.prevent="resetToDefault"
            >
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
          <span :class="['shrink-0 font-mono text-sm leading-none text-neutral-700 dark:text-neutral-200']">{{ formattedValue }}</span>
        </div>
        <div
          v-if="description || $slots.description"
          :class="['line-clamp-3 text-xs leading-snug text-neutral-500 dark:text-neutral-400']"
        >
          <slot name="description">
            {{ description }}
          </slot>
        </div>
      </div>
      <Range
        v-model="modelValue"
        :min="min ?? 0"
        :max="max ?? 1"
        :step="step ?? 0.01"
        compact
        :class="['w-full']"
      />
    </template>
    <template v-else>
      <div :class="['flex', 'flex-row', 'items-center', 'gap-2']">
        <div :class="['flex-1']">
          <div :class="['flex', 'items-center', 'gap-1', 'text-sm', 'font-medium']">
            <slot name="label">
              {{ label }}
            </slot>
            <button
              v-if="defaultValue !== undefined"
              type="button"
              title="Reset to default"
              :class="['px-2', 'text-xs', 'outline-none']"
              @click.prevent="resetToDefault"
            >
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
          <div :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">
            <slot name="description">
              {{ description }}
            </slot>
          </div>
        </div>
        <span :class="['font-mono']">{{ formattedValue }}</span>
      </div>
      <div :class="['flex', 'flex-row', 'items-center', 'gap-2']">
        <Range
          v-model="modelValue"
          :min="min ?? 0"
          :max="max ?? 1"
          :step="step ?? 0.01"
          :class="['w-full']"
        />
      </div>
    </template>
  </props.as>
</template>
