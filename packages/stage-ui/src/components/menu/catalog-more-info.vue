<script setup lang="ts">
import { pickBestCatalogDescription } from '@proj-airi/stage-shared/catalog-description'
import { ref, watch } from 'vue'

import CatalogHoverTooltip from './catalog-hover-tooltip.vue'

import {
  canEnrichOpenRouterCatalogDescription,
  fetchOpenRouterFullDescription,
} from '../../libs/model-catalog/openrouter-description'

const props = defineProps<{
  text: string
  label?: string
  modelId?: string
  providerId?: string
}>()

const displayText = ref(props.text)

watch(() => props.text, (text) => {
  displayText.value = pickBestCatalogDescription(displayText.value, text) ?? text
})

async function enrichIfTruncated() {
  const { modelId, providerId } = props
  if (!modelId || !canEnrichOpenRouterCatalogDescription(providerId, displayText.value))
    return

  const full = await fetchOpenRouterFullDescription(modelId, displayText.value)
  if (!full)
    return

  displayText.value = pickBestCatalogDescription(displayText.value, full) ?? full
}
</script>

<template>
  <CatalogHoverTooltip
    :content="displayText"
    :model-id="modelId"
    :provider-id="providerId"
    wide
    trigger-class="shrink-0 rounded-md px-2 py-0.5 text-xs text-primary-600 font-semibold dark:text-primary-400"
    @shown="enrichIfTruncated"
  >
    {{ label ?? 'More info' }}
  </CatalogHoverTooltip>
</template>
