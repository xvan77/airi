<script setup lang="ts">
import type { MemoryEntry } from '@proj-airi/stage-ui/stores/memory'

import { useMemoryStore } from '@proj-airi/stage-ui/stores/memory'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button, GhostButton } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const memory = useMemoryStore()
const { cards } = storeToRefs(useAiriCardStore())

const KEY = 'settings.pages.modules.memory-long-term.memories'

interface MemoryGroup {
  key: string
  title: string
  description?: string
  icon: string
  entries: MemoryEntry[]
  unlinked?: boolean
}

/** Shared storage first, each card, then entries whose card no longer exists. */
const groups = computed<MemoryGroup[]>(() => {
  const knownCardIds = new Set(cards.value.keys())
  const sharedEntries = memory.entries.filter(entry => !entry.persona)
  const cardGroups: MemoryGroup[] = [...cards.value]
    .map(([id, card]) => {
      const entries = memory.entries.filter(entry => entry.persona === id)
      if (!entries.length)
        return undefined
      return {
        key: id,
        title: card.name || id,
        icon: 'i-solar:user-rounded-bold-duotone',
        entries,
      }
    })
    .filter((group): group is MemoryGroup => Boolean(group))

  const unlinkedEntries = memory.entries.filter(entry => entry.persona && !knownCardIds.has(entry.persona))
  const unlinkedGroup: MemoryGroup[] = unlinkedEntries.length
    ? [{
        key: 'unlinked',
        title: t(`${KEY}.unlinked_title`),
        description: t(`${KEY}.unlinked_description`),
        icon: 'i-solar:link-broken-bold-duotone',
        entries: unlinkedEntries,
        unlinked: true,
      }]
    : []

  return [
    {
      key: 'shared',
      title: t(`${KEY}.general`),
      icon: 'i-solar:global-bold-duotone',
      entries: sharedEntries,
    },
    ...cardGroups,
    ...unlinkedGroup,
  ]
})

const knownCardIds = computed(() => [...cards.value.keys()])

function removeAllUnlinked() {
  const count = memory.removeUnlinkedFromCards(knownCardIds.value)
  if (count > 0)
    toast(t(`${KEY}.unlinked_removed_toast`, { count }))
}
</script>

<template>
  <div :class="['flex flex-col', 'gap-4']">
    <p :class="['text-sm', 'text-neutral-500 dark:text-neutral-400']">
      {{ t(`${KEY}.description`) }}
    </p>

    <section
      v-for="group in groups"
      :key="group.key"
      :class="['flex flex-col', 'gap-2', 'rounded-xl', 'bg-neutral-50 dark:bg-neutral-800/60', 'p-4']"
    >
      <div :class="['flex items-start', 'gap-2']">
        <h2 :class="['min-w-0 flex-1', 'flex items-center', 'gap-2', 'text-sm font-medium']">
          <span :class="[group.icon, 'text-lg', 'text-primary-500 dark:text-primary-400']" aria-hidden="true" />
          <span :class="['min-w-0 flex-1', 'truncate']">{{ group.title }}</span>
          <span :class="['text-xs', 'text-neutral-400 dark:text-neutral-500']">{{ group.entries.length }}</span>
        </h2>
        <Button
          v-if="group.unlinked"
          size="sm"
          color="red"
          variant="secondary"
          :label="t(`${KEY}.unlinked_remove_all`)"
          @click="removeAllUnlinked"
        />
      </div>
      <p v-if="group.description" :class="['text-xs', 'text-neutral-500 dark:text-neutral-400']">
        {{ group.description }}
      </p>
      <ul v-if="group.entries.length" :class="['flex flex-col', 'gap-2']">
        <li
          v-for="entry in group.entries"
          :key="`${entry.persona ?? 'shared'}-${entry.name}`"
          :class="['flex items-start', 'gap-3', 'rounded-lg', 'bg-white dark:bg-neutral-900/60', 'px-3 py-2.5']"
        >
          <div :class="['min-w-0 flex-1', 'flex flex-col', 'gap-0.5']">
            <span :class="['truncate', 'text-sm font-medium']">{{ entry.name }}</span>
            <span
              v-if="group.unlinked && entry.persona"
              :class="['text-xs', 'text-amber-600 dark:text-amber-400']"
            >
              {{ t(`${KEY}.unlinked_from_card`, { id: entry.persona }) }}
            </span>
            <span v-if="entry.description" :class="['text-xs', 'text-neutral-500 dark:text-neutral-400']">{{ entry.description }}</span>
            <p :class="['pt-1', 'text-sm', 'whitespace-pre-wrap break-words']">
              {{ entry.body }}
            </p>
          </div>
          <GhostButton
            v-if="entry.persona"
            size="sm"
            icon="i-solar:global-linear"
            :aria-label="t(`${KEY}.make_general`, { name: entry.name })"
            :title="t(`${KEY}.make_general`, { name: entry.name })"
            @click="memory.makeGeneral(entry)"
          />
          <GhostButton size="sm" icon="i-solar:trash-bin-minimalistic-linear" :aria-label="t(`${KEY}.forget`, { name: entry.name })" :title="t(`${KEY}.forget`, { name: entry.name })" @click="memory.remove(entry)" />
        </li>
      </ul>
      <p v-else :class="['text-xs', 'text-neutral-500 dark:text-neutral-400']">
        {{ t(`${KEY}.empty`) }}
      </p>
    </section>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.memory-long-term.memories.title
  subtitleKey: settings.pages.modules.memory-long-term.title
  stageTransition:
    name: slide
</route>
