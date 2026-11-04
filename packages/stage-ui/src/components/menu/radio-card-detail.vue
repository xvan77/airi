<script setup lang="ts">
import { Input, TransitionVertical } from '@proj-airi/ui'
import { ref } from 'vue'

import CatalogMoreInfo from './catalog-more-info.vue'
import CatalogStatChip from './catalog-stat-chip.vue'

export interface RadioCardDetailBadge {
  label: string
  title: string
}

withDefaults(defineProps<{
  id: string
  name: string
  value: string
  title: string
  description?: string
  badges?: readonly RadioCardDetailBadge[]
  deprecated?: boolean
  showExpandCollapse?: boolean
  expandCollapseThreshold?: number
  customInputValue?: string
  customInputPlaceholder?: string
  showCustomInput?: boolean
  /** When true, description shows in a hover popover only. */
  descriptionCollapsedByDefault?: boolean
  descriptionToggleLabel?: string
  descriptionCollapseLabel?: string
  providerId?: string
}>(), {
  deprecated: false,
  showExpandCollapse: true,
  expandCollapseThreshold: 100,
  customInputValue: '',
  customInputPlaceholder: '',
  showCustomInput: false,
  descriptionCollapsedByDefault: false,
  descriptionToggleLabel: 'More info',
  descriptionCollapseLabel: 'Hide',
})

const modelValue = defineModel<string>({ required: true })

const isExpanded = ref(false)

function toggleExpansion() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <label
    :key="id"
    class="form_radio-card-detail relative flex cursor-pointer items-start rounded-lg p-2.5 pr-3"
    transition="all duration-200 ease-in-out"
    border="2 solid"
    :class="[
      modelValue === value
        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-900 hover:border-primary-500/30 dark:hover:border-primary-400/30'
        : 'bg-white dark:bg-neutral-900/20 border-neutral-100 dark:border-neutral-900 hover:border-primary-500/30 dark:hover:border-primary-400/30',
      modelValue === value
        ? 'form_radio-card-detail-active'
        : '',
      deprecated ? 'opacity-60' : '',
    ]"
  >
    <input
      v-model="modelValue"
      :checked="modelValue === value"
      type="radio"
      :name="name"
      :value="value"
      class="absolute opacity-0"
    >
    <div class="relative mr-3 mt-0.5 flex-shrink-0">
      <div
        class="size-5 border-2 rounded-full transition-colors duration-200"
        :class="[
          modelValue === value
            ? 'border-primary-500 dark:border-primary-400'
            : 'border-neutral-300 dark:border-neutral-600',
        ]"
      >
        <div
          class="absolute left-1/2 top-1/2 size-3 rounded-full transition-opacity duration-200 -translate-x-1/2 -translate-y-1/2"
          :class="[
            modelValue === value
              ? 'opacity-100 bg-primary-500 dark:bg-primary-400'
              : 'opacity-0',
          ]"
        />
      </div>
    </div>
    <div class="min-w-0 w-full flex flex-col gap-1.5">
      <div class="flex items-start gap-2">
        <span
          class="line-clamp-2 min-w-0 flex-1 text-sm font-normal leading-snug"
          :class="[
            modelValue === value
              ? 'text-neutral-700 dark:text-neutral-300'
              : 'text-neutral-700 dark:text-neutral-400',
          ]"
        >
          {{ title }}
        </span>
        <span
          v-if="description && descriptionCollapsedByDefault"
          class="relative z-10 shrink-0"
          @click.stop.prevent
        >
          <CatalogMoreInfo
            :text="description"
            :label="descriptionToggleLabel"
            :model-id="value"
            :provider-id="providerId"
          />
        </span>
      </div>

      <div v-if="badges?.length" class="relative z-10 flex flex-wrap gap-1">
        <CatalogStatChip
          v-for="badge in badges"
          :key="`${badge.label}-${badge.title}`"
          :label="badge.label"
          :title="badge.title"
        />
      </div>

      <div v-if="description && !descriptionCollapsedByDefault" class="relative">
        <TransitionVertical>
          <div
            v-if="!isExpanded || !showExpandCollapse"
            class="line-clamp-2 cursor-pointer text-xs"
            :class="[
              modelValue === value
                ? 'text-neutral-600 dark:text-neutral-400'
                : 'text-neutral-500 dark:text-neutral-500',
            ]"
            :title="description"
            @click.prevent="toggleExpansion"
          >
            {{ description }}
          </div>

          <div
            v-else
            class="cursor-pointer text-xs"
            :class="[
              modelValue === value
                ? 'text-neutral-600 dark:text-neutral-400'
                : 'text-neutral-500 dark:text-neutral-500',
            ]"
            @click.prevent="toggleExpansion"
          >
            {{ description }}
          </div>
        </TransitionVertical>

        <button
          v-if="showExpandCollapse && description.length > expandCollapseThreshold"
          class="mt-0.5 inline-flex items-center text-xs text-primary-500 dark:text-primary-600"
          @click.prevent="toggleExpansion"
        >
          <span>{{ isExpanded ? 'Show less' : 'Show more' }}</span>
          <div
            :class="{ 'rotate-180': isExpanded }"
            class="transition-transform duration-200"
          >
            <div i-solar:alt-arrow-down-linear ml-0.5 text-xs />
          </div>
        </button>
      </div>

      <div v-if="showCustomInput && modelValue === value" class="mt-2">
        <Input
          v-model="modelValue"
          type="text"
          class="w-full border border-neutral-300 rounded bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          :placeholder="customInputPlaceholder"
        />
      </div>
    </div>
  </label>
</template>

<style scoped>
.form_radio-card-detail {
  position: relative;
  overflow: visible;
}

.form_radio-card-detail::before {
  pointer-events: none;
  --at-apply: 'bg-gradient-to-r from-primary-500/0 to-primary-500/0 dark:from-primary-400/0 dark:to-primary-400/0';
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 25%;
  height: 100%;
  transition: all 0.35s ease-in-out;
  mask-image: linear-gradient(120deg, white 100%);
  opacity: 0;
}

.form_radio-card-detail:hover::before,
.form_radio-card-detail._hover::before {
  --at-apply: 'bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent dark:from-primary-400/20 dark:via-primary-400/10 dark:to-transparent';
  width: 85%;
  opacity: 1;
}

.form_radio-card-detail-active::before {
  --at-apply: 'bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent dark:from-primary-400/20 dark:via-primary-400/10 dark:to-transparent';
  width: 85%;
  opacity: 0.5;
}
</style>
