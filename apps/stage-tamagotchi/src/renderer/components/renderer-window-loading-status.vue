<script setup lang="ts">
defineProps<{
  message: string
  /** Boot card, centered popups, stage model load, or compact pill. */
  layout: 'card' | 'center' | 'stage' | 'pill'
  /** Adds drag-region for Electron window moves on the centered panel. */
  draggable?: boolean
}>()

const bootCardPanel = [
  'flex aspect-square w-[8.75rem] flex-col items-center justify-center gap-2',
  'rounded-2xl px-3 py-3',
  'bg-white/95 text-neutral-900 shadow-lg ring-1 ring-neutral-200/80',
  'dark:bg-neutral-900/95 dark:text-neutral-50 dark:ring-neutral-700/80',
].join(' ')

const centerPopupPanel = [
  'flex max-w-[min(20rem,calc(100vw-3rem))] items-center gap-2',
  'rounded-full px-3 py-1.5 text-sm font-semibold shadow-md backdrop-blur-md',
  'bg-white/90 text-neutral-900 ring-1 ring-neutral-200/60',
  'dark:bg-neutral-900/90 dark:text-neutral-50 dark:ring-neutral-700/60',
].join(' ')

const labelClass = 'w-full px-1 text-center text-[0.6875rem] font-semibold leading-tight'
const centerLabelClass = 'truncate'
</script>

<template>
  <!-- First-run / main boot: white square card in the middle of the window. -->
  <div
    v-if="layout === 'card'"
    :class="[
      'pointer-events-none fixed inset-0 z-[9999]',
      'flex items-center justify-center p-6',
    ]"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div :class="bootCardPanel">
      <span :class="['loading-status-spinner', 'loading-status-spinner-lg']" aria-hidden="true" />
      <p :class="labelClass">
        {{ message }}
      </p>
    </div>
  </div>

  <!-- Other main-stage popups: same center as the boot card, compact pill (not the white square). -->
  <div
    v-else-if="layout === 'center'"
    :class="[
      'pointer-events-none fixed inset-0 z-[9998]',
      'flex items-center justify-center p-6',
      draggable ? 'drag-region' : '',
    ]"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div :class="centerPopupPanel">
      <span :class="['loading-status-spinner', 'loading-status-spinner-sm', 'shrink-0']" aria-hidden="true" />
      <span :class="centerLabelClass">{{ message }}</span>
    </div>
  </div>

  <!-- Live2D / VRM mount: wide banner over the stage (separate from the boot card). -->
  <div
    v-else-if="layout === 'stage'"
    :class="[
      'pointer-events-none absolute inset-0 z-[99] h-full w-full',
      'flex cursor-grab items-center justify-center overflow-hidden',
      draggable ? 'drag-region' : '',
    ]"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div
      :class="[
        'absolute flex h-24 w-full items-center justify-center overflow-hidden rounded-xl',
        'bg-white/80 backdrop-blur-md dark:bg-neutral-950/80',
      ]"
    >
      <div
        :class="[
          'flex h-full w-full items-center justify-center select-none',
          'text-1.5rem font-normal text-primary-600 dark:text-primary-400',
          'animate-flash animate-duration-5s animate-count-infinite',
          draggable ? 'drag-region' : '',
        ]"
      >
        {{ message }}
      </div>
    </div>
  </div>

  <div
    v-else-if="layout === 'pill'"
    :class="[
      'pointer-events-none flex max-w-[90%] items-center gap-2',
      'rounded-full px-3 py-1.5 text-sm font-semibold shadow-md backdrop-blur-md',
      'bg-white/90 text-neutral-900 ring-1 ring-neutral-200/60',
      'dark:bg-neutral-900/90 dark:text-neutral-50 dark:ring-neutral-700/60',
    ]"
    role="status"
    aria-live="polite"
  >
    <span :class="['loading-status-spinner', 'loading-status-spinner-sm', 'shrink-0']" aria-hidden="true" />
    <span :class="['truncate']">{{ message }}</span>
  </div>
</template>

<style>
@keyframes loading-status-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style scoped>
.loading-status-spinner {
  box-sizing: border-box;
  display: inline-block;
  border-radius: 9999px;
  border: 2px solid rgba(20, 184, 166, 0.25);
  border-top-color: #14b8a6;
  animation: loading-status-spin 2.75s linear infinite;
}

.loading-status-spinner-sm {
  width: 1rem;
  height: 1rem;
}

.loading-status-spinner-lg {
  width: 1.75rem;
  height: 1.75rem;
}

@media (prefers-color-scheme: dark) {
  .loading-status-spinner {
    border-color: rgba(45, 212, 191, 0.25);
    border-top-color: #2dd4bf;
  }
}
</style>
