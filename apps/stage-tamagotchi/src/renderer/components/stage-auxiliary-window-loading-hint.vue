<script setup lang="ts">
import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { computed } from 'vue'

import RendererWindowLoadingStatus from './renderer-window-loading-status.vue'

import { useRendererWindowLoadingCopy } from '../composables/use-renderer-window-loading-copy'

const props = defineProps<{
  labelId: RendererWindowLoadLabelId
  routePath?: string
}>()

const labelRef = computed(() => props.labelId)
const routeRef = computed(() => props.routePath)
const { loadingMessage } = useRendererWindowLoadingCopy(labelRef, routeRef)
</script>

<template>
  <RendererWindowLoadingStatus
    layout="center"
    draggable
    :message="loadingMessage"
  />
</template>
