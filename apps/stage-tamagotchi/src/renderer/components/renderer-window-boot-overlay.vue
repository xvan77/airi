<script setup lang="ts">
import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import RendererWindowLoadingStatus from './renderer-window-loading-status.vue'

import { electronSetRendererWindowBootLoading } from '../../shared/eventa'
import { resolveRendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'
import { rendererBootComplete } from '../composables/renderer-boot-complete'
import { useRendererWindowLoadingCopy } from '../composables/use-renderer-window-loading-copy'
import { resolveInitialRendererRoutePath } from '../window-context'

const router = useRouter()
const route = useRoute()
const routeLoading = ref(false)
const pendingRouteBootLabel = shallowRef<RendererWindowLoadLabelId | null>(null)
const setRendererBootLoading = useElectronEventaInvoke(electronSetRendererWindowBootLoading)

const labelId = computed(() => resolveRendererWindowLoadLabelId(
  resolveInitialRendererRoutePath(route.path),
))
const displayLabelId = computed(() => pendingRouteBootLabel.value ?? labelId.value)
const tracksBootOnMainStage = computed(() => labelId.value !== 'main')
const { loadingMessage } = useRendererWindowLoadingCopy(displayLabelId)

const showBootCard = computed(() => {
  if (routeLoading.value)
    return true
  if (!rendererBootComplete.value)
    return true
  return false
})

function removeHtmlBootSplash() {
  document.getElementById('window-boot-splash')?.remove()
}

async function pushBootLoading(label: RendererWindowLoadLabelId, active: boolean) {
  if (label === 'main')
    return
  await setRendererBootLoading({ labelId: label, active })
}

function clearPendingRouteBootSync() {
  const pending = pendingRouteBootLabel.value
  if (!pending)
    return
  pendingRouteBootLabel.value = null
  void pushBootLoading(pending, false)
}

async function finishRouteBoot() {
  routeLoading.value = false
  clearPendingRouteBootSync()
}

onMounted(async () => {
  removeHtmlBootSplash()
  rendererBootComplete.value = false

  if (tracksBootOnMainStage.value) {
    router.beforeEach((to, from, next) => {
      if (to.fullPath !== from.fullPath) {
        clearPendingRouteBootSync()
        routeLoading.value = true
        const nextLabel = resolveRendererWindowLoadLabelId(
          resolveInitialRendererRoutePath(to.path),
        )
        pendingRouteBootLabel.value = nextLabel
        void pushBootLoading(nextLabel, true)
      }
      next()
    })
    router.afterEach(async () => {
      await router.isReady()
      await finishRouteBoot()
    })
    router.onError(async () => {
      await finishRouteBoot()
    })
  }

  await pushBootLoading(labelId.value, true)
  await router.isReady()
  rendererBootComplete.value = true
  routeLoading.value = false
  await pushBootLoading(labelId.value, false)
})

onUnmounted(() => {
  rendererBootComplete.value = true
  clearPendingRouteBootSync()
  void pushBootLoading(labelId.value, false)
})
</script>

<template>
  <RendererWindowLoadingStatus
    v-show="showBootCard"
    :layout="labelId === 'main' ? 'card' : 'center'"
    :message="loadingMessage"
  />
</template>
