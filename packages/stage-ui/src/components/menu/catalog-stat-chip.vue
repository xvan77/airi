<script setup lang="ts">
import CatalogHoverTooltip from './catalog-hover-tooltip.vue'

withDefaults(defineProps<{
  label: string
  title: string
  tone?: 'pricing' | 'stat'
}>(), {
  tone: 'stat',
})
</script>

<template>
  <CatalogHoverTooltip
    :content="title"
    :trigger-class="tone === 'pricing'
      ? 'rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300'
      : 'rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 font-semibold leading-normal dark:bg-neutral-800 dark:text-neutral-300'"
  >
    {{ label }}
  </CatalogHoverTooltip>
</template>
