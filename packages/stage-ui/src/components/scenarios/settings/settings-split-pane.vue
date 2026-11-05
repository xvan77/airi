<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

const props = withDefaults(defineProps<{
  storageKey?: string
  defaultLeftPercent?: number
  minLeftPercent?: number
  maxLeftPercent?: number
}>(), {
  storageKey: 'settings/split-pane/left-percent',
  defaultLeftPercent: 40,
  minLeftPercent: 25,
  maxLeftPercent: 75,
})

const isDesktop = useMediaQuery('(min-width: 768px)')
const containerRef = useTemplateRef('container')
const isDragging = ref(false)
const leftPercent = ref(readStoredLeftPercent())

function clampLeftPercent(value: number) {
  return Math.min(props.maxLeftPercent, Math.max(props.minLeftPercent, value))
}

function readStoredLeftPercent() {
  if (typeof localStorage === 'undefined') {
    return props.defaultLeftPercent
  }

  const raw = localStorage.getItem(props.storageKey)
  if (raw == null) {
    return props.defaultLeftPercent
  }

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    return props.defaultLeftPercent
  }

  return clampLeftPercent(parsed)
}

function persistLeftPercent(value: number) {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(props.storageKey, String(value))
}

function updateLeftFromPointer(clientX: number) {
  const container = containerRef.value
  if (!container) {
    return
  }

  const rect = container.getBoundingClientRect()
  if (rect.width <= 0) {
    return
  }

  const next = (clientX - rect.left) / rect.width * 100
  leftPercent.value = clampLeftPercent(next)
}

function stopDrag(handle: HTMLElement, pointerId: number) {
  isDragging.value = false
  persistLeftPercent(leftPercent.value)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  handle.releasePointerCapture(pointerId)
}

function onSplitterPointerDown(event: PointerEvent) {
  if (!isDesktop.value) {
    return
  }

  event.preventDefault()

  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) {
    return
  }

  isDragging.value = true
  handle.setPointerCapture(event.pointerId)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  updateLeftFromPointer(event.clientX)

  const onPointerMove = (moveEvent: PointerEvent) => {
    if (!isDragging.value) {
      return
    }

    updateLeftFromPointer(moveEvent.clientX)
  }

  const onPointerUp = (upEvent: PointerEvent) => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)
    stopDrag(handle, upEvent.pointerId)
  }

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
}

const leftPaneStyle = computed(() => {
  if (!isDesktop.value) {
    return undefined
  }

  return {
    flexBasis: `${leftPercent.value}%`,
    maxWidth: `${props.maxLeftPercent}%`,
    minWidth: `${props.minLeftPercent}%`,
  }
})

const splitterAriaValueNow = computed(() => Math.round(leftPercent.value))
</script>

<template>
  <div
    ref="container"
    :class="[
      'flex w-full min-w-0',
      isDesktop ? 'flex-row items-stretch gap-0' : 'flex-col gap-6',
      isDragging ? 'select-none' : '',
    ]"
  >
    <div
      :class="[
        'min-w-0',
        isDesktop ? 'shrink-0' : 'w-full',
      ]"
      :style="leftPaneStyle"
    >
      <slot name="left" />
    </div>

    <div
      v-if="isDesktop"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="splitterAriaValueNow"
      :aria-valuemin="minLeftPercent"
      :aria-valuemax="maxLeftPercent"
      :aria-label="$t('settings.split_pane.resize')"
      tabindex="0"
      :class="[
        'relative z-10 shrink-0 touch-none',
        'w-2 cursor-col-resize',
        'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2',
        'before:bg-neutral-200/80 dark:before:bg-neutral-700/80',
        'hover:before:bg-primary-400/60 dark:hover:before:bg-primary-500/50',
        isDragging ? 'before:bg-primary-500/70 dark:before:bg-primary-400/60' : '',
      ]"
      @pointerdown="onSplitterPointerDown"
    />

    <div
      :class="[
        'min-w-0',
        isDesktop ? 'min-h-0 flex-1' : 'w-full',
      ]"
    >
      <slot name="right" />
    </div>
  </div>
</template>
