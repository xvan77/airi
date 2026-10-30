<script setup lang="ts">
import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { computed } from 'vue'

import RendererWindowLoadingStatus from './renderer-window-loading-status.vue'

import { useRendererWindowLoadingCopy } from '../composables/use-renderer-window-loading-copy'

const props = defineProps<{
  labelId: RendererWindowLoadLabelId
}>()

const labelRef = computed(() => props.labelId)
const { loadingMessage } = useRendererWindowLoadingCopy(labelRef)
</script>

<template>
  <RendererWindowLoadingStatus
    layout="center"
    draggable
    :message="loadingMessage"
  />
</template>
