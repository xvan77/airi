<script setup lang="ts">
import type { CardSyncState } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { IconButton } from '@proj-airi/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CardModelPreview from './card-model-preview.vue'

const props = defineProps<{
  id: string
  name: string
  isActive: boolean
  version: string
  modelId?: string
  deletable?: boolean
  /** Absent when the user is not signed in, because nothing is uploaded then. */
  syncState?: CardSyncState
}>()

const emit = defineEmits<{
  delete: []
}>()

const { t } = useI18n()

const syncIcons = {
  synced: 'i-solar:cloud-check-outline',
  pending: 'i-solar:cloud-upload-outline',
  refused: 'i-solar:cloud-cross-outline',
} as const

const syncIcon = computed(() => props.syncState ? syncIcons[props.syncState] : undefined)

function handleDeleteClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('delete')
}
</script>

<template>
  <div
    :class="[
      'group grid min-w-0 content-start gap-2 text-left',
    ]"
  >
    <div :class="['relative']">
      <RouterLink
        :to="`/settings/airi-card/${encodeURIComponent(id)}`"
        :aria-label="`${t('settings.pages.card.view-card')}: ${name}`"
        :class="[
          'block text-inherit no-underline',
          'rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-400',
        ]"
      >
        <CardModelPreview
          :model-id="modelId"
          :class="[
            'aspect-[3/4] max-h-52 w-full rounded-2xl',
            'transition-[transform,box-shadow] duration-350 ease-out',
            'group-hover:-translate-y-1 group-hover:shadow-[0_14px_28px_-12px_rgb(0_0_0/0.55)]',
            'motion-reduce:transition-none motion-reduce:group-hover:translate-y-0',
            isActive ? 'outline-2 outline-offset-3 outline-primary-500 dark:outline-primary-400' : '',
          ]"
        >
          <span
            v-if="isActive"
            :class="[
              'absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5',
              'bg-primary-500 text-xs text-white font-medium',
            ]"
          >
            <span class="i-solar:check-circle-bold-duotone" aria-hidden="true" />
            {{ t('settings.pages.card.active_badge') }}
          </span>
        </CardModelPreview>
      </RouterLink>
      <IconButton
        v-if="deletable"
        size="unset"
        :class="[
          'absolute right-2.5 top-2.5 z-10',
          'size-10 rounded-xl',
          'text-red-400 hover:text-red-300',
          'bg-neutral-900/55 backdrop-blur-sm dark:bg-black/60',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400',
        ]"
        :aria-label="t('settings.pages.card.delete_from_list_aria', { name })"
        :title="t('settings.pages.card.delete_from_list')"
        @click="handleDeleteClick"
      >
        <span
          aria-hidden="true"
          :class="['i-solar:trash-bin-minimalistic-line-duotone size-6']"
        />
      </IconButton>
    </div>

    <RouterLink
      :to="`/settings/airi-card/${encodeURIComponent(id)}`"
      :class="[
        'min-w-0 px-0.5 text-inherit no-underline',
        'rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400',
      ]"
    >
      <h2 :class="['truncate font-cute text-lg font-extrabold leading-tight']">
        {{ name }}
      </h2>
      <div :class="['mt-1 flex items-center justify-between gap-2']">
        <span :class="['text-xs text-neutral-500 tabular-nums dark:text-neutral-400']">
          v{{ version }}
        </span>
        <span
          v-if="syncState && syncIcon"
          :class="[
            'flex items-center text-sm',
            syncState === 'refused' ? 'text-amber-500' : 'text-neutral-500 dark:text-neutral-400',
          ]"
          :title="t(`settings.pages.card.sync.state.${syncState}`)"
          :aria-label="t(`settings.pages.card.sync.state.${syncState}`)"
          :data-sync-state="syncState"
        >
          <span :class="syncIcon" aria-hidden="true" />
        </span>
      </div>
    </RouterLink>
  </div>
</template>
