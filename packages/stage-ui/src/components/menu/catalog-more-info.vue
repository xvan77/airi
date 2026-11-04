<script setup lang="ts">
import CatalogHoverTooltip from './catalog-hover-tooltip.vue'

defineProps<{
  text: string
  label?: string
  modelId?: string
  providerId?: string
}>()
</script>

<template>
  <CatalogHoverTooltip
    :content="text"
    :model-id="modelId"
    :provider-id="providerId"
    wide
    trigger-class="shrink-0 rounded-md px-2 py-0.5 text-xs text-primary-600 font-semibold dark:text-primary-400"
  >
    {{ label ?? 'More info' }}
  </CatalogHoverTooltip>
</template>
