<script setup lang="ts">
import type { ProviderDeployment, ProviderPricing } from '../../libs/providers/attributes'

import { computed } from 'vue'

const props = defineProps<{
  title: string
  description?: string
  icon?: string
  iconColor?: string
  iconImage?: string
  to: string
  configured?: boolean
  syncState?: 'synced' | 'pending' | 'not-uploaded'
  pricing?: ProviderPricing
  pricingTiers?: readonly ProviderPricing[]
  deployment?: ProviderDeployment
  beginnerRecommended?: boolean
}>()

const syncIcons = {
  'synced': {
    className: 'i-solar:cloud-check-outline',
    labelKey: 'settings.pages.providers.sync.synced',
  },
  'pending': {
    className: 'i-solar:cloud-upload-outline',
    labelKey: 'settings.pages.providers.sync.pending',
  },
  'not-uploaded': {
    className: 'i-solar:cloud-cross-outline',
    labelKey: 'settings.pages.providers.sync.not-uploaded',
  },
} as const

const syncIcon = computed(() => props.syncState ? syncIcons[props.syncState] : undefined)

const pricingLabels = computed(() => {
  const tiers = props.pricingTiers?.length
    ? props.pricingTiers
    : props.pricing
      ? [props.pricing]
      : []
  return [...new Set(tiers)]
})
</script>

<template>
  <div
    flex="~ col"
    bg="neutral-50 dark:neutral-800"
    border="neutral-100 dark:neutral-800/25 hover:primary-500/30 dark:hover:primary-400/30 solid 2"
    drop-shadow="none hover:[0px_4px_4px_rgba(220,220,220,0.4)] active:[0px_0px_0px_rgba(220,220,220,0.25)] dark:hover:none"
    class="menu-icon-status-item"
    transition="all ease-in-out duration-400"
    h-full w-full cursor-pointer of-hidden rounded-xl
  >
    <RouterLink
      :class="[
        'menu-icon-status-item-link',
        'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg p-3.5 text-left',
        'bg-white dark:bg-neutral-900',
        'transition-all duration-400 ease-in-out',
      ]"
      :to="props.to"
    >
      <div :class="['z-1', 'flex min-h-0 flex-1 flex-col']">
        <div
          :class="[
            'menu-icon-status-item-title',
            'text-base font-normal',
            'transition-all duration-400 ease-in-out',
          ]"
        >
          {{ props.title }}
        </div>
        <div
          :class="[
            'menu-icon-status-item-description',
            'text-xs text-neutral-500 leading-snug dark:text-neutral-400',
            'transition-all duration-400 ease-in-out',
          ]"
        >
          <span>{{ props.description || '' }}</span>
        </div>

        <div
          v-if="pricingLabels.length || props.deployment || props.beginnerRecommended"
          :class="[
            'mt-auto flex w-full items-end gap-1 pt-2',
          ]"
        >
          <div class="min-w-0 flex flex-1 flex-wrap items-center gap-1">
            <div
              v-if="props.beginnerRecommended"
              :class="[
                'rounded-md bg-green-500 px-1.5 py-0.5',
                'text-[10px] font-bold tracking-wider text-white uppercase',
              ]"
            >
              {{ $t('settings.pages.providers.labels.recommended') }}
            </div>
            <div
              v-for="tier in pricingLabels"
              :key="tier"
              :class="[
                'rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 dark:border-neutral-600 dark:bg-neutral-800/80',
                'text-[10px] font-bold tracking-wider text-neutral-600 uppercase dark:text-neutral-300',
              ]"
              :title="$t(`settings.pages.providers.filters.${tier}`)"
            >
              {{ $t(`settings.pages.providers.filters.${tier}`) }}
            </div>
          </div>
          <div
            v-if="props.deployment"
            :class="[
              'ml-1 shrink-0 rounded-md border border-primary-300/60 bg-primary-500/10 px-1.5 py-0.5 dark:border-primary-500/40 dark:bg-primary-500/15',
              'text-[10px] font-bold tracking-wider text-primary-700 uppercase dark:text-primary-300',
            ]"
            :title="$t(`settings.pages.providers.filters.${props.deployment}`)"
          >
            {{ $t(`settings.pages.providers.filters.${props.deployment}`) }}
          </div>
        </div>
      </div>
      <template v-if="props.icon">
        <div
          class="menu-icon-status-item-icon"
          transition="all ease-in-out duration-400"
          absolute right-0 size-16 translate-y-2
          text="neutral-400/50 dark:neutral-600/50"
          grayscale-100
          :class="props.icon"
        />
      </template>
      <template v-if="props.iconColor">
        <div
          class="menu-icon-status-item-icon-color"
          transition="all ease-in-out duration-400"
          absolute right-0 size-16 translate-y-2
          text="neutral-400/50 dark:neutral-600/50"
          grayscale-100
          :class="[props.iconColor]"
        />
      </template>
      <template v-if="props.iconImage">
        <img
          :src="props.iconImage"
          class="menu-icon-status-item-icon-image"
          transition="all ease-in-out duration-400"
          absolute right-0 size-16 translate-y-2
          grayscale-100
        >
      </template>
    </RouterLink>
    <span
      v-if="syncIcon"
      role="img"
      :aria-label="$t(syncIcon.labelKey)"
      :title="$t(syncIcon.labelKey)"
      :class="[
        syncIcon.className,
        'absolute right-3 top-3 z-2 size-4',
        'text-neutral-400 dark:text-neutral-500',
      ]"
    />
    <div class="p-1.5">
      <div v-if="props.configured" size-4 bg="green-500" rounded-full shadow="lg" />
      <div v-else size-4 border="2 neutral-200 dark:neutral-700" rounded-full bg="white dark:neutral-900" />
    </div>
  </div>
</template>

<style scoped>
.menu-icon-status-item {
  position: relative;
  overflow: hidden;
}

.menu-icon-status-item::before {
  --at-apply: 'bg-gradient-to-r from-primary-500/0 to-primary-500/0 dark:from-primary-400/0 dark:to-primary-400/0';
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 25%;
  height: 100%;
  transition: all 0.4s ease-in-out;
  mask-image: linear-gradient(120deg, white 100%);
  opacity: 0;
}

.menu-icon-status-item:hover::before,
.menu-icon-status-item._hover::before {
  --at-apply: 'bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent dark:from-primary-400/20 dark:via-primary-400/10 dark:to-transparent';
  width: 50%;
  opacity: 1;
}

.menu-icon-status-item-link::after {
  --at-apply: 'bg-dotted-[neutral-200/80] hover:bg-dotted-[primary-300/50] dark:bg-dotted-[neutral-700/40] dark:hover:bg-dotted-[primary-200/20]';
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  background-size: 10px 10px;
  content: '';
  mask-image: linear-gradient(165deg, white 30%, transparent 50%);
  transition: all 0.4s ease-in-out;
}

.menu-icon-status-item-icon-color {
  opacity: 0.5;
}

.menu-icon-status-item:hover .menu-icon-status-item-title,
.menu-icon-status-item._hover .menu-icon-status-item-title {
  --at-apply: text-primary-600;
}

.menu-icon-status-item:hover .menu-icon-status-item-description,
.menu-icon-status-item._hover .menu-icon-status-item-description {
  --at-apply: text-primary-600;
  opacity: 0.8;
}

.menu-icon-status-item:hover .menu-icon-status-item-icon,
.menu-icon-status-item._hover .menu-icon-status-item-icon,
.menu-icon-status-item:hover .menu-icon-status-item-icon-color,
.menu-icon-status-item._hover .menu-icon-status-item-icon-color {
  --at-apply: text-primary-500;
  scale: 1.2;
}

.dark .menu-icon-status-item:hover .menu-icon-status-item-title,
.dark .menu-icon-status-item._hover .menu-icon-status-item-title {
  --at-apply: text-primary-300;
}

.dark .menu-icon-status-item:hover .menu-icon-status-item-description,
.dark .menu-icon-status-item._hover .menu-icon-status-item-description {
  --at-apply: text-primary-300;
  opacity: 0.8;
}

.dark .menu-icon-status-item:hover .menu-icon-status-item-icon,
.dark .menu-icon-status-item._hover .menu-icon-status-item-icon,
.dark .menu-icon-status-item:hover .menu-icon-status-item-icon-color,
.dark .menu-icon-status-item._hover .menu-icon-status-item-icon-color {
  --at-apply: text-primary-400;
}
</style>
