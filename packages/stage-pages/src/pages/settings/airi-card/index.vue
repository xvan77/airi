<script setup lang="ts">
import { Alert } from '@proj-airi/stage-ui/components'
import { getAiriCardEditorModuleSettings } from '@proj-airi/stage-ui/services/airi-card-editor'
import { AiriCardPackageError, importAiriCardPackage } from '@proj-airi/stage-ui/services/airi-card-import-export'
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useMemoryStore } from '@proj-airi/stage-ui/stores/memory'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button, Input } from '@proj-airi/ui'
import { ComboboxSelect } from '@proj-airi/ui/components/form'
import { storeToRefs } from 'pinia'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import CardListItem from './components/card-list-item.vue'
import DeleteCardDialog from './components/DeleteCardDialog.vue'
import WakeWordConflictAlert from './components/wake-word-conflict-alert.vue'

import { formatRelativeTime } from './composables/relative-time'

const { t, locale } = useI18n()
const memoryStore = useMemoryStore()
const cardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()
const { addCard, removeCard } = cardStore
const { cards, activeCardId, cardSyncStates, cloudSyncEnabled } = storeToRefs(cardStore)
const { isAuthenticated } = storeToRefs(useAuthStore())

const route = useRoute()
const router = useRouter()

const searchQuery = shallowRef('')
const sortOption = shallowRef<'nameAsc' | 'nameDesc' | 'recent'>('nameAsc')
const inputFiles = shallowRef<File[]>([])
const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')

interface CardItem {
  id: string
  name: string
  description?: string
  version: string
  displayModelId?: string
}

const deleteDialogOpen = shallowRef(false)
const pendingDeleteCard = shallowRef<CardItem | undefined>()

function requestDeleteCard(card: CardItem) {
  pendingDeleteCard.value = card
  deleteDialogOpen.value = true
}

async function confirmDeleteCard(options: { removeLongTermMemories: boolean }) {
  const card = pendingDeleteCard.value
  pendingDeleteCard.value = undefined
  if (!card)
    return
  try {
    const removed = await removeCard(card.id)
    if (removed) {
      if (options.removeLongTermMemories) {
        const count = memoryStore.removeForPersona(card.id)
        if (count > 0) {
          toast(t('settings.pages.card.deleted_with_memories_toast', { name: card.name, count }))
        }
        else {
          toast(t('settings.pages.card.deleted_toast', { name: card.name }))
        }
      }
      else {
        toast(t('settings.pages.card.deleted_toast', { name: card.name }))
      }
    }
    else {
      toast(t('settings.pages.card.delete_failed'))
    }
  }
  catch (error) {
    console.error('Error deleting card:', error)
    toast(t('settings.pages.card.delete_failed'))
  }
}

const overviewKeywordClass = [
  'font-semibold',
  'text-neutral-900 dark:text-neutral-50',
]

function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  inputFiles.value = Array.from(input.files ?? [])
  input.value = ''
}

const dragDepth = shallowRef(0)
const isDraggingFile = computed(() => dragDepth.value > 0)

function isFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function handleDragEnter(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  dragDepth.value += 1
}

function handleDragOver(event: DragEvent) {
  if (isFileDrag(event))
    event.preventDefault()
}

function handleDragLeave(event: DragEvent) {
  if (!isFileDrag(event))
    return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function handleDrop(event: DragEvent) {
  if (!isFileDrag(event))
    return
  event.preventDefault()
  dragDepth.value = 0
  inputFiles.value = Array.from(event.dataTransfer?.files ?? [])
}

watch(inputFiles, async (newFiles) => {
  const file = newFiles[0]
  if (!file)
    return

  try {
    await addCard(await importAiriCardPackage({ file, displayModelsStore }), 'import')
    toast(t('settings.pages.card.imported'))
  }
  catch (error) {
    console.error('Error processing card package:', error)
    toast(t(error instanceof AiriCardPackageError && error.code === 'missing-file'
      ? 'settings.pages.card.import_missing_file'
      : 'settings.pages.card.import_invalid_file'))
  }
  finally {
    inputFiles.value = []
  }
})

const cardsArray = computed<CardItem[]>(() =>
  Array.from(cards.value.entries()).map(([id, card]) => ({
    id,
    name: card.name,
    description: card.description,
    version: card.version,
    displayModelId: getAiriCardEditorModuleSettings(card).displayModelId || undefined,
  })),
)

const filteredCards = computed<CardItem[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase(locale.value)
  if (!query)
    return cardsArray.value

  return cardsArray.value.filter(item =>
    item.name.toLocaleLowerCase(locale.value).includes(query)
    || item.description?.toLocaleLowerCase(locale.value).includes(query),
  )
})

const sortedFilteredCards = computed<CardItem[]>(() => {
  const sorted = [...filteredCards.value]

  if (sortOption.value === 'nameAsc')
    return sorted.sort((a, b) => a.name.localeCompare(b.name))

  if (sortOption.value === 'nameDesc')
    return sorted.sort((a, b) => b.name.localeCompare(a.name))

  // The persisted Map retains insertion order. Random IDs cannot represent creation time.
  return sorted.reverse()
})

function handleCardCreation() {
  void router.push('/settings/airi-card/new')
}

function handleCardFromText() {
  void router.push('/settings/airi-card/from-text')
}

watch(activeCardId, (cardId, previousCardId) => {
  if (!previousCardId || cardId === previousCardId)
    return

  const activeCard = cards.value.get(cardId)
  if (activeCard)
    toast(t('settings.pages.card.activation_notice', { name: activeCard.name }))
})

watch(() => [route.query.cardId, route.query.tab], ([cardId, tab]) => {
  if (typeof cardId !== 'string' || !cards.value.has(cardId))
    return

  const section = typeof tab === 'string' ? tab : ''
  const edit = ['identity', 'behavior', 'modules', 'artistry', 'settings'].includes(section)
  void router.replace({
    path: `/settings/airi-card/${encodeURIComponent(cardId)}${edit ? '/edit' : ''}`,
    query: edit ? { section } : { tab: section },
  })
}, { immediate: true })

interface DeletedCard {
  id: string
  name: string
  deletedAt: string
}

const showDeletedPanel = shallowRef(false)
const deletedCardsList = shallowRef<DeletedCard[]>([])
const isLoadingDeleted = shallowRef(false)
const deletedLoadFailed = shallowRef(false)
const restoringDeletedId = shallowRef<string | null>(null)

// The server keeps the content of a deleted card for 30 days.
const DELETED_CARD_RETENTION_DAYS = 30

function formatDeletedRelative(deletedAt: string) {
  return formatRelativeTime(deletedAt, locale.value)
}

function restorableDays(deletedAt: string) {
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(0, DELETED_CARD_RETENTION_DAYS - elapsed)
}

async function loadDeletedCards() {
  isLoadingDeleted.value = true
  deletedLoadFailed.value = false
  try {
    deletedCardsList.value = await cardStore.deletedCards()
  }
  catch (error) {
    console.error('Error loading recently deleted cards:', error)
    deletedLoadFailed.value = true
  }
  finally {
    isLoadingDeleted.value = false
  }
}

async function toggleDeletedPanel() {
  showDeletedPanel.value = !showDeletedPanel.value
  if (showDeletedPanel.value)
    await loadDeletedCards()
}

async function handleRestoreDeletedCard(card: DeletedCard) {
  restoringDeletedId.value = card.id
  try {
    const restored = await cardStore.restoreDeletedCard(card.id)
    toast(t(restored ? 'settings.pages.card.sync.deleted.restore_success' : 'settings.pages.card.sync.deleted.restore_failed', { name: card.name }))
    if (restored)
      await loadDeletedCards()
  }
  catch (error) {
    console.error('Error restoring a deleted card:', error)
    toast(t('settings.pages.card.sync.deleted.restore_failed', { name: card.name }))
  }
  finally {
    restoringDeletedId.value = null
  }
}
</script>

<template>
  <div :class="['flex flex-col gap-2 rounded-xl p-2.5 sm:gap-2.5 sm:p-3']">
    <WakeWordConflictAlert />

    <div
      v-if="isAuthenticated && cloudSyncEnabled"
      :class="[
        'flex flex-col gap-3 rounded-xl px-4 py-3',
        'border border-primary-200/60 dark:border-primary-800/40',
        'bg-primary-50/50 dark:bg-primary-950/30',
      ]"
    >
      <div :class="['flex flex-row flex-wrap items-center justify-between gap-2']">
        <p :class="['flex items-center gap-2 text-sm', 'text-neutral-600 dark:text-neutral-300']">
          <span :class="['i-solar:cloud-check-outline shrink-0', 'text-primary-500 dark:text-primary-400']" />
          {{ t('settings.pages.card.sync.notice') }}
        </p>
        <button
          type="button"
          :class="[
            'flex shrink-0 items-center gap-1 text-sm',
            'text-primary-600 dark:text-primary-400',
            'hover:underline',
          ]"
          @click="toggleDeletedPanel"
        >
          <span class="i-solar:trash-bin-minimalistic-linear" />
          {{ t('settings.pages.card.sync.deleted.title') }}
          <span :class="showDeletedPanel ? 'i-solar:alt-arrow-up-linear' : 'i-solar:alt-arrow-down-linear'" />
        </button>
      </div>

      <div
        v-if="showDeletedPanel"
        :class="[
          'flex flex-col gap-2 rounded-lg p-3',
          'bg-white/60 dark:bg-black/30',
          'border border-neutral-200/50 dark:border-neutral-700/30',
        ]"
      >
        <div v-if="isLoadingDeleted" :class="['py-4 text-center text-sm', 'text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.card.sync.deleted.loading') }}
        </div>
        <div v-else-if="deletedLoadFailed" :class="['py-4 text-center text-sm', 'text-red-500 dark:text-red-400']">
          {{ t('settings.pages.card.sync.deleted.load_failed') }}
        </div>
        <div v-else-if="deletedCardsList.length === 0" :class="['py-4 text-center text-sm', 'text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.card.sync.deleted.empty') }}
        </div>
        <div
          v-for="card in deletedCardsList"
          :key="card.id"
          :class="[
            'flex flex-row items-center justify-between gap-3 rounded-lg p-3',
            'bg-white dark:bg-neutral-900',
            'border border-neutral-200/50 dark:border-neutral-700/30',
          ]"
        >
          <div :class="['flex min-w-0 flex-col gap-0.5']">
            <span :class="['truncate text-sm font-medium']">{{ card.name }}</span>
            <span :class="['text-xs', 'text-neutral-500 dark:text-neutral-400']" :title="new Date(card.deletedAt).toLocaleString(locale)">
              {{ t('settings.pages.card.sync.deleted.deleted_when', { when: formatDeletedRelative(card.deletedAt) }) }}
              ·
              {{ t('settings.pages.card.sync.deleted.days_left', { days: restorableDays(card.deletedAt) }) }}
            </span>
          </div>
          <Button
            size="sm"
            :class="['shrink-0']"
            icon="i-solar:restart-line-duotone"
            :label="t('settings.pages.card.sync.deleted.restore')"
            :disabled="restoringDeletedId === card.id"
            @click="handleRestoreDeletedCard(card)"
          />
        </div>
      </div>
    </div>

    <p v-else-if="isAuthenticated" :class="['flex flex-wrap items-center gap-2 text-sm', 'text-neutral-500 dark:text-neutral-400']">
      <span :class="['i-solar:cloud-cross-outline shrink-0']" />
      {{ t('settings.pages.card.sync.off_notice') }}
      <RouterLink to="/settings/system/experimental" :class="['text-primary-600 dark:text-primary-400 hover:underline']">
        {{ t('settings.pages.card.sync.off_notice_link') }}
      </RouterLink>
    </p>

    <section
      :class="[
        'flex flex-col gap-1.5 rounded-xl border px-3 py-2 sm:px-3 sm:py-2.5',
        'border-neutral-200/60 bg-neutral-50/40 dark:border-neutral-700/50 dark:bg-neutral-900/40',
      ]"
      :aria-label="t('settings.pages.card.overview.heading')"
    >
      <h2 :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-100']">
        {{ t('settings.pages.card.overview.heading') }}
      </h2>
      <p :class="['text-sm leading-snug text-neutral-600 dark:text-neutral-300']">
        {{ t('settings.pages.card.overview.what_is') }}
      </p>
      <p :class="['text-sm leading-snug text-neutral-600 dark:text-neutral-300']">
        {{ t('settings.pages.card.overview.why_two_ways_lead') }}
        <span :class="overviewKeywordClass">{{ t('settings.pages.card.creators.automatic.badge') }}</span>{{ ' ' }}
        {{ t('settings.pages.card.overview.why_two_ways_automatic_tail') }}
      </p>
      <p :class="['text-sm leading-snug text-neutral-600 dark:text-neutral-300']">
        <span :class="overviewKeywordClass">{{ t('settings.pages.card.creators.manual.badge') }}</span>{{ ' ' }}
        {{ t('settings.pages.card.overview.why_two_ways_manual_tail') }}
      </p>
    </section>

    <div :class="['grid grid-cols-1 gap-2 sm:grid-cols-2']">
      <div
        :class="[
          'flex flex-col gap-1.5 rounded-2xl border-2 p-2.5 sm:p-3',
          'border-primary-300/70 bg-primary-50/30 dark:border-primary-700/50 dark:bg-primary-950/25',
        ]"
      >
        <div :class="['flex items-start justify-between gap-2']">
          <div :class="['flex items-center gap-2']">
            <span
              :class="['i-solar:magic-stick-3-bold-duotone shrink-0 text-2xl text-primary-600 dark:text-primary-400']"
              aria-hidden="true"
            />
            <h3 :class="['text-base font-semibold text-neutral-900 dark:text-neutral-50']">
              {{ t('settings.pages.card.creators.automatic.title') }}
            </h3>
          </div>
          <span
            :class="[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
              'bg-primary-500/15 text-primary-700 dark:bg-primary-400/15 dark:text-primary-300',
            ]"
          >
            {{ t('settings.pages.card.creators.automatic.badge') }}
          </span>
        </div>
        <p :class="['flex-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300']">
          {{ t('settings.pages.card.creators.automatic.description') }}
        </p>
        <div :class="['flex flex-wrap gap-2']">
          <Button
            variant="primary"
            color="primary"
            icon="i-solar:add-square-line-duotone"
            :label="t('settings.pages.card.create_card')"
            @click="handleCardFromText"
          />
        </div>
      </div>

      <div
        :class="[
          'flex flex-col gap-1.5 rounded-2xl border-2 p-2.5 sm:p-3',
          'border-neutral-300/80 bg-neutral-50/50 dark:border-neutral-600/60 dark:bg-neutral-900/50',
        ]"
      >
        <div :class="['flex items-start justify-between gap-2']">
          <div :class="['flex items-center gap-2']">
            <span
              :class="['i-solar:pen-new-square-line-duotone shrink-0 text-2xl text-neutral-600 dark:text-neutral-300']"
              aria-hidden="true"
            />
            <h3 :class="['text-base font-semibold text-neutral-900 dark:text-neutral-50']">
              {{ t('settings.pages.card.creators.manual.title') }}
            </h3>
          </div>
          <span
            :class="[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
              'bg-neutral-500/10 text-neutral-600 dark:bg-neutral-400/10 dark:text-neutral-300',
            ]"
          >
            {{ t('settings.pages.card.creators.manual.badge') }}
          </span>
        </div>
        <p :class="['flex-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300']">
          {{ t('settings.pages.card.creators.manual.description') }}
        </p>
        <div :class="['flex flex-wrap gap-2']">
          <Button
            variant="primary"
            color="primary"
            icon="i-solar:add-square-line-duotone"
            :label="t('settings.pages.card.create_card')"
            @click="handleCardCreation"
          />
        </div>
      </div>
    </div>

    <input
      ref="uploadInput"
      type="file"
      accept=".zip"
      :class="['hidden']"
      @change="handleUploadChange"
    >

    <div :class="['flex flex-wrap items-center gap-2']">
      <Input
        v-model="searchQuery"
        type="search"
        :placeholder="t('settings.pages.card.search')"
        :aria-label="t('settings.pages.card.search')"
        :class="['w-full flex-1 sm:max-w-xs']"
      />
      <div :class="['w-full shrink-0 sm:w-40']">
        <ComboboxSelect
          v-model="sortOption"
          :options="[
            { value: 'nameAsc', label: t('settings.pages.card.name_asc') },
            { value: 'nameDesc', label: t('settings.pages.card.name_desc') },
            { value: 'recent', label: t('settings.pages.card.recent') },
          ]"
          :placeholder="t('settings.pages.card.sort_by')"
          :aria-label="t('settings.pages.card.sort_by')"
          :class="['w-full']"
        />
      </div>
    </div>

    <div
      :class="['relative']"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div :class="['grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6']">
        <CardListItem
          v-for="item in sortedFilteredCards"
          :id="item.id"
          :key="item.id"
          :name="item.name"
          :is-active="item.id === activeCardId"
          :version="item.version"
          :model-id="item.displayModelId"
          :sync-state="cardSyncStates[item.id]"
          :deletable="item.id !== 'default'"
          @delete="requestDeleteCard(item)"
        />

        <div
          v-if="cards.size === 0"
          :class="[
            'col-span-full rounded-xl p-8 text-center',
            'border border-neutral-200/50 dark:border-neutral-700/30',
            'bg-neutral-50/50 dark:bg-neutral-900/50',
          ]"
        >
          <div :class="['i-solar:card-search-broken mx-auto mb-3 text-6xl text-neutral-400']" />
          <p>{{ t('settings.pages.card.no_cards') }}</p>
        </div>

        <Alert v-if="searchQuery && sortedFilteredCards.length === 0" type="warning" :class="['col-span-full']">
          <template #title>
            {{ t('settings.pages.card.no_results') }}
          </template>
          <template #content>
            {{ t('settings.pages.card.try_different_search') }}
          </template>
        </Alert>
      </div>

      <div
        v-if="isDraggingFile"
        :class="[
          'pointer-events-none absolute inset-0 z-10',
          'flex flex-col items-center justify-center gap-2 rounded-xl',
          'border-2 border-dashed border-primary-400 dark:border-primary-500',
          'bg-primary-500/10 dark:bg-primary-400/10',
        ]"
      >
        <div :class="['i-solar:upload-minimalistic-bold text-4xl text-primary-500 dark:text-primary-400']" />
        <p :class="['text-sm font-medium text-primary-600 dark:text-primary-300']">
          {{ t('settings.pages.card.drop_here') }}
        </p>
      </div>
    </div>

    <DeleteCardDialog
      v-model="deleteDialogOpen"
      :card-id="pendingDeleteCard?.id"
      :card-name="pendingDeleteCard?.name"
      @confirm="confirmDeleteCard"
      @cancel="pendingDeleteCard = undefined"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  settingsHeaderDensity: compact
  titleKey: settings.pages.card.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.card.description
  icon: i-solar:emoji-funny-square-bold-duotone
  settingsEntry: true
  order: 1
  stageTransition:
    name: slide
</route>
