<script setup lang="ts">
defineProps<{
  text: string
  lineClamp?: 1 | 2
}>()
</script>

<template>
  <span
    class="group relative inline-block max-w-full cursor-default"
    tabindex="0"
  >
    <span
      :class="[
        lineClamp === 2 ? 'line-clamp-2' : 'line-clamp-1',
        'block leading-snug',
      ]"
    >
      {{ text }}
    </span>
    <span
      role="tooltip"
      :class="[
        'pointer-events-none absolute left-0 top-full z-50 mt-1 max-w-56',
        'rounded-md bg-neutral-900 px-2 py-1.5 text-[10px] text-white font-normal leading-normal whitespace-normal',
        'opacity-0 shadow-lg transition-opacity duration-150',
        'group-hover:opacity-100 group-focus-visible:opacity-100',
        'dark:bg-neutral-100 dark:text-neutral-900',
      ]"
    >
      {{ text }}
    </span>
  </span>
</template>
