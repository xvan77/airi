<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  triggerClass?: string
  content: string
  placement?: 'above' | 'below'
  wide?: boolean
  modelId?: string
  providerId?: string
}>(), {
  triggerClass: '',
  placement: 'below',
  wide: false,
  modelId: '',
  providerId: '',
})

const VIEWPORT_MARGIN = 8
const CHIP_MAX_WIDTH = 208
const DETAIL_MIN_WIDTH = 420
const DETAIL_MAX_WIDTH = 560
const DETAIL_VIEWPORT_WIDTH_RATIO = 0.42

const triggerRef = useTemplateRef<HTMLElement>('trigger')
const tooltipRef = useTemplateRef<HTMLElement>('tooltip')
const visible = ref(false)
const position = ref({ top: 0, left: 0 })

function panelWidth(): number {
  const viewport = window.innerWidth - VIEWPORT_MARGIN * 2
  if (props.wide) {
    const target = Math.floor(viewport * DETAIL_VIEWPORT_WIDTH_RATIO)
    return Math.min(Math.max(DETAIL_MIN_WIDTH, target), DETAIL_MAX_WIDTH, viewport)
  }
  return Math.min(CHIP_MAX_WIDTH, viewport)
}

function maxPanelHeight(): number {
  return window.innerHeight - VIEWPORT_MARGIN * 2
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function updatePosition() {
  const element = triggerRef.value
  const panel = tooltipRef.value
  if (!element)
    return

  const rect = element.getBoundingClientRect()
  const width = panel?.offsetWidth ?? panelWidth()
  const height = panel?.offsetHeight ?? 0
  const maxHeight = maxPanelHeight()
  const panelHeight = Math.min(height || maxHeight, maxHeight)

  const candidates: Array<{ left: number, top: number }> = []

  if (props.wide) {
    candidates.push(
      { left: rect.right + VIEWPORT_MARGIN, top: rect.top },
      { left: rect.left - VIEWPORT_MARGIN - width, top: rect.top },
      { left: rect.left, top: rect.bottom + VIEWPORT_MARGIN },
      { left: rect.left, top: rect.top - VIEWPORT_MARGIN - panelHeight },
    )
  }
  else {
    const centeredLeft = rect.left + rect.width / 2 - width / 2
    candidates.push(
      { left: centeredLeft, top: rect.bottom + VIEWPORT_MARGIN },
      { left: centeredLeft, top: rect.top - VIEWPORT_MARGIN - panelHeight },
      { left: rect.right + VIEWPORT_MARGIN, top: rect.top },
      { left: rect.left - VIEWPORT_MARGIN - width, top: rect.top },
    )
  }

  const fits = (left: number, top: number) =>
    left >= VIEWPORT_MARGIN
    && top >= VIEWPORT_MARGIN
    && left + width <= window.innerWidth - VIEWPORT_MARGIN
    && top + panelHeight <= window.innerHeight - VIEWPORT_MARGIN

  const chosen = candidates.find(candidate => fits(candidate.left, candidate.top)) ?? candidates[0]

  position.value = {
    left: clamp(chosen.left, VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width),
    top: clamp(chosen.top, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - panelHeight),
  }
}

async function showTooltip() {
  updatePosition()
  visible.value = true
  await nextTick()
  updatePosition()
  await nextTick()
  updatePosition()
}

function hideTooltip() {
  visible.value = false
}

watch(() => props.content, async () => {
  if (!visible.value)
    return
  await nextTick()
  updatePosition()
})

watch(visible, (isVisible) => {
  if (isVisible)
    window.addEventListener('scroll', hideTooltip, true)
  else
    window.removeEventListener('scroll', hideTooltip, true)
})

onUnmounted(() => {
  window.removeEventListener('scroll', hideTooltip, true)
})

const tooltipStyle = computed(() => ({
  top: `${position.value.top}px`,
  left: `${position.value.left}px`,
  width: `${panelWidth()}px`,
  maxHeight: `${maxPanelHeight()}px`,
}))
</script>

<template>
  <span
    ref="trigger"
    class="max-w-full inline-flex cursor-default align-middle"
    tabindex="0"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focusin="showTooltip"
    @focusout="hideTooltip"
  >
    <span :class="triggerClass">
      <slot />
    </span>
  </span>

  <Teleport to="body">
    <div
      v-if="visible"
      ref="tooltip"
      role="tooltip"
      :style="tooltipStyle"
      :class="[
        'pointer-events-none fixed z-[9999] overflow-y-auto rounded-md border border-neutral-200 bg-white px-3 py-2.5 shadow-lg',
        'text-[11px] text-neutral-900 font-normal leading-relaxed whitespace-pre-wrap dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
      ]"
    >
      {{ content }}
    </div>
  </Teleport>
</template>
