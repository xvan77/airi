<script setup lang="ts">
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { WhisperDock } from '@proj-airi/stage-ui/components'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { electronStartDraggingWindow } from '../../shared/eventa'

const backgroundStore = useBackgroundStore()
const { activeBackgroundUrl } = storeToRefs(backgroundStore)

const settingsStore = useSettings()
const { stageModelSelected } = storeToRefs(settingsStore)

const controlStripStore = useSettingsControlStrip()
const { stageEnabled } = storeToRefs(controlStripStore)

const positioningStore = usePositioningStore()

const scale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const xOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const yOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).y
})

function handleScaleChange(val: number) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    scale: val,
  })
}

function handleOffsetChange(val: { x: number, y: number }) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    x: val.x,
    y: val.y,
  })
}

// WhisperDock stub tools
const tools = ref<any[]>([])
function handleSpawnStandalone() {}

// Window Dragging Handle
const context = useElectronEventaContext()
const startDraggingWindowInvoke = useElectronEventaInvoke(electronStartDraggingWindow, context.value)
function startDraggingWindow() {
  startDraggingWindowInvoke()
}

// Fade drag handle on hover states
const showDragHandle = ref(false)
</script>

<template>
  <div
    class="relative h-screen w-screen flex flex-col justify-between overflow-hidden"
    @mouseenter="showDragHandle = true"
    @mouseleave="showDragHandle = false"
  >
    <!-- Scene Background Layer -->
    <div
      v-if="activeBackgroundUrl"
      :class="[
        'absolute inset-0 z-0',
        'transition-opacity duration-500',
      ]"
      :style="{
        backgroundImage: `url(${activeBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }"
    />

    <!-- Standalone Graphics Model Scene Renderer -->
    <div class="absolute inset-0 z-10">
      <RendererStage
        v-if="stageEnabled"
        :paused="false"
        :focus-at="{ x: 0, y: 0 }"
        :x-offset="xOffset"
        :y-offset="yOffset"
        :scale="scale"
        @scale-change="handleScaleChange"
        @offset-change="handleOffsetChange"
      />
    </div>

    <!-- Floating Window Drag Control (Fades on hover) -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDragHandle"
        class="pointer-events-auto absolute left-4 top-1/2 z-50 -translate-y-1/2"
      >
        <button
          class="h-10 w-10 flex cursor-move items-center justify-center border border-white/20 rounded-full bg-neutral-900/60 text-white shadow-lg transition-transform duration-200 active:scale-90 hover:bg-neutral-900/80"
          title="Drag to Reposition Stage"
          @mousedown="startDraggingWindow"
        >
          <span class="i-ph:arrows-out-cardinal text-xl" />
        </button>
      </div>
    </Transition>

    <!-- WhisperDock horizontal input overlay centered at bottom -->
    <div class="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-auto -translate-x-1/2">
      <WhisperDock
        :tools="tools"
        @spawn-standalone="handleSpawnStandalone"
      />
    </div>
  </div>
</template>
