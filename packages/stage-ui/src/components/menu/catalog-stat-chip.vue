<script setup lang="ts">
import CatalogHoverTooltip from './catalog-hover-tooltip.vue'

defineProps<{
  label: string
  title: string
}>()
</script>

<template>
  <CatalogHoverTooltip
    :content="title"
    trigger-class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 font-semibold leading-normal dark:bg-neutral-800 dark:text-neutral-300"
  >
    {{ label }}
  </CatalogHoverTooltip>
</template>
