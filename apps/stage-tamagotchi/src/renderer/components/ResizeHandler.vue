<script setup lang="ts">
import { electron } from '@proj-airi/electron-eventa'
import { useElectronEventaInvoke, useElectronWindowResize } from '@proj-airi/electron-vueuse'
import { useAsyncState } from '@vueuse/core'

const isWindows = useElectronEventaInvoke(electron.app.isWindows)
const { handleResizeStart } = useElectronWindowResize()
const isWindowsRef = useAsyncState(() => isWindows(), false)
</script>

<template>
  <div v-if="isWindowsRef" class="resize-handles">
    <div class="handle n" @pointerdown="handleResizeStart($event, 'n')" />
    <div class="handle s" @pointerdown="handleResizeStart($event, 's')" />
    <div class="handle e" @pointerdown="handleResizeStart($event, 'e')" />
    <div class="handle w" @pointerdown="handleResizeStart($event, 'w')" />
    <div class="handle ne" @pointerdown="handleResizeStart($event, 'ne')" />
    <div class="handle nw" @pointerdown="handleResizeStart($event, 'nw')" />
    <div class="handle se" @pointerdown="handleResizeStart($event, 'se')" />
    <div class="handle sw" @pointerdown="handleResizeStart($event, 'sw')" />
  </div>
</template>

<style scoped>
.resize-handles {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9999;
}

.handle {
  position: absolute;
  pointer-events: auto;
}

.handle.n { top: 0; left: 5px; right: 5px; height: 5px; cursor: n-resize; }
.handle.s { bottom: 0; left: 5px; right: 5px; height: 5px; cursor: s-resize; }
.handle.e { top: 5px; bottom: 5px; right: 0; width: 5px; cursor: e-resize; }
.handle.w { top: 5px; bottom: 5px; left: 0; width: 5px; cursor: w-resize; }

.handle.nw { top: 0; left: 0; width: 10px; height: 10px; cursor: nw-resize; }
.handle.ne { top: 0; right: 0; width: 10px; height: 10px; cursor: ne-resize; }
.handle.sw { bottom: 0; left: 0; width: 10px; height: 10px; cursor: sw-resize; }
.handle.se { bottom: 0; right: 0; width: 10px; height: 10px; cursor: se-resize; }
</style>
