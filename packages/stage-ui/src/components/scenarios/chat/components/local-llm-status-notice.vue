<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <div :class="['flex justify-center py-2']">
    <div
      :class="[
        'local-llm-status-notice relative isolate flex max-w-[92%] items-center gap-2.5',
        'overflow-hidden rounded-full border px-3.5 py-2',
        'bg-cyan-950/55 text-cyan-50',
        'dark:bg-cyan-950/70 dark:text-cyan-50',
      ]"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        :class="['local-llm-status-notice__wash pointer-events-none absolute inset-0 rounded-[inherit]']"
      />
      <span
        aria-hidden="true"
        :class="['local-llm-status-notice__ring pointer-events-none absolute inset-0 rounded-[inherit]']"
      />
      <span
        aria-hidden="true"
        :class="[
          'local-llm-status-notice__icon relative z-1 shrink-0',
          'i-solar:refresh-bold text-cyan-200 dark:text-cyan-100',
          'size-4 animate-spin motion-reduce:animate-none',
        ]"
      />
      <span
        :class="[
          'local-llm-status-notice__text relative z-1 text-xs font-semibold leading-snug tracking-wide',
          'text-cyan-50 dark:text-cyan-50',
        ]"
      >
        {{ text }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.local-llm-status-notice {
  animation: local-llm-status-border 1s ease-in-out infinite;
}

.local-llm-status-notice__wash {
  background: linear-gradient(
    115deg,
    rgb(8 145 178 / 0%) 0%,
    rgb(34 211 238 / 55%) 45%,
    rgb(8 145 178 / 0%) 90%
  );
  animation: local-llm-status-pulse 1s ease-in-out infinite;
}

.local-llm-status-notice__ring {
  box-shadow:
    inset 0 0 24px rgb(34 211 238 / 0.45),
    0 0 36px rgb(34 211 238 / 0.7),
    0 0 64px rgb(34 211 238 / 0.5),
    0 0 88px rgb(34 211 238 / 0.35);
  animation: local-llm-status-pulse 1s ease-in-out infinite;
}

.local-llm-status-notice__icon {
  filter: drop-shadow(0 0 10px rgb(34 211 238 / 1)) drop-shadow(0 0 20px rgb(34 211 238 / 0.7));
}

@media (prefers-reduced-motion: reduce) {
  .local-llm-status-notice,
  .local-llm-status-notice__wash,
  .local-llm-status-notice__ring {
    animation: none;
    opacity: 1;
  }

  .local-llm-status-notice {
    border-color: rgb(34 211 238 / 75%);
  }

  .local-llm-status-notice__wash {
    background: rgb(34 211 238 / 18%);
  }
}

@keyframes local-llm-status-pulse {
  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}

@keyframes local-llm-status-border {
  0%,
  100% {
    border-color: rgb(34 211 238 / 50%);
  }

  50% {
    border-color: rgb(34 211 238 / 100%);
  }
}
</style>
