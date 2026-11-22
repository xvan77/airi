<script setup lang="ts">
import type { ChatModelRecentEntry } from '../../../composables/chat/popover-model-recents'

import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onUnmounted, ref, watch } from 'vue'

import {

  chatModelSelectionKey,
  useChatModelRecents,
} from '../../../composables/chat/popover-model-recents'
import { openTamagotchiEventaSession } from '../../../composables/chat/tamagotchi-eventa-session'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProviderStore } from '../../../stores/providers/provider'

interface LocalLlmServerStatus {
  state: 'idle' | 'downloading_binary' | 'starting' | 'running' | 'stopped' | 'error'
  binaryExists: boolean
  activeModel: string | null
  port: number
  error?: string
}

withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  variant?: 'default' | 'mobile'
}>(), {
  title: 'Model & Provider',
  variant: 'default',
})

// Store bindings
const consciousnessStore = useConsciousnessStore()
const providersStore = useProviderStore()
const airiCardStore = useAiriCardStore()

const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
const { activeCard, activeCardId, cards } = storeToRefs(airiCardStore)

const showRecentsPanel = ref(false)
const chatRecents = useChatModelRecents()

interface FavoriteModel {
  id: string
  name: string
  provider: string
  model: string
}

// Persistent Storage for Favorites
const favorites = useLocalStorage<FavoriteModel[]>('airi:chat-model-favorites', [])
const deletedKeys = useLocalStorage<string[]>('airi:chat-model-deleted-keys', [])

// Seeding default favorites reactively to perfectly handle asynchronous card store hydration
watch(cards, (newCards) => {
  const discovered = new Set<string>()

  // 1. Coalesce the current active model from store first
  if (activeProvider.value && activeModel.value) {
    discovered.add(`${activeProvider.value}:${activeModel.value}`)
  }

  // 2. Coalesce consciousness model settings from imported character cards
  for (const card of newCards.values()) {
    const provider = card.extensions?.airi?.modules?.consciousness?.provider
    const model = card.extensions?.airi?.modules?.consciousness?.model
    if (provider && model) {
      discovered.add(`${provider}:${model}`)
    }
  }

  // 3. Dynamically sync discovered models into the favorites list
  for (const key of discovered) {
    const [provider, model] = key.split(':')

    // If the user has explicitly deleted this favorite, respect their choice and do not auto-seed it again
    if (deletedKeys.value.includes(key))
      continue

    const alreadyInFavorites = favorites.value.some(fav => fav.provider === provider && fav.model === model)
    if (!alreadyInFavorites) {
      // Find a friendly display name based on character card name
      let displayName = `Current (${model.split('/').pop() || model})`
      for (const card of newCards.values()) {
        const cardProv = card.extensions?.airi?.modules?.consciousness?.provider
        const cardModel = card.extensions?.airi?.modules?.consciousness?.model
        if (cardProv === provider && cardModel === model) {
          displayName = `${card.name} (${model.split('/').pop() || model})`
          break
        }
      }

      favorites.value.push({
        id: `seed-${provider}-${model}`,
        name: displayName,
        provider,
        model,
      })
    }
  }

  // Seeding Debug Logs deleted
}, { immediate: true, deep: true })

const electronLocalLlmGetStatus = defineInvokeEventa<LocalLlmServerStatus>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')

const localLlmStatus = ref<LocalLlmServerStatus | null>(null)
const isStartingServer = ref(false)
let localLlmPollInterval: ReturnType<typeof setInterval> | null = null

const isLlmActive = computed(() => {
  if (!activeProvider.value || !activeModel.value)
    return false
  if (activeProvider.value === 'local-llm') {
    return localLlmStatus.value?.state === 'running'
  }
  return true
})

async function updateLocalLlmStatus() {
  if (!isStageTamagotchi())
    return
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    const getStatus = defineInvoke(session.context, electronLocalLlmGetStatus)
    localLlmStatus.value = await getStatus()
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to get local LLM status:', err)
  }
  finally {
    session.dispose()
  }
}

async function handleStartServer() {
  if (typeof window === 'undefined' || isStartingServer.value || !activeModel.value)
    return
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    isStartingServer.value = true
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'starting'
    }
    const startServer = defineInvoke(session.context, electronLocalLlmStartServer)
    await startServer({ modelId: activeModel.value })
    providersStore.forceProviderConfigured('local-llm')
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to start local LLM server:', err)
  }
  finally {
    isStartingServer.value = false
    session.dispose()
  }
}

async function handleStopServer() {
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    const stopServer = defineInvoke(session.context, electronLocalLlmStopServer)
    await providersStore.setProviderUnconfigured('local-llm')
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'stopped'
    }
    await stopServer()
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to stop local LLM server:', err)
  }
  finally {
    session.dispose()
  }
}

async function stopLocalLlmServerIfRunning() {
  if (!isStageTamagotchi())
    return
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    const getStatus = defineInvoke(session.context, electronLocalLlmGetStatus)
    const stopServer = defineInvoke(session.context, electronLocalLlmStopServer)
    const status = await getStatus()
    if (status.state !== 'running' && status.state !== 'starting')
      return
    await stopServer()
    await updateLocalLlmStatus()
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to stop local LLM server:', err)
  }
  finally {
    session.dispose()
  }
}

watch(activeProvider, (provider) => {
  if (provider === 'local-llm') {
    updateLocalLlmStatus()
    if (!localLlmPollInterval) {
      localLlmPollInterval = setInterval(updateLocalLlmStatus, 3000)
    }
  }
  else {
    if (localLlmPollInterval) {
      clearInterval(localLlmPollInterval)
      localLlmPollInterval = null
    }
  }
}, { immediate: true })

onUnmounted(() => {
  if (localLlmPollInterval) {
    clearInterval(localLlmPollInterval)
  }
})

const activeModelLabel = computed(() => {
  return activeModel.value?.split('/').pop() || activeModel.value || 'None'
})

const isActiveInFavorites = computed(() => {
  if (!activeProvider.value || !activeModel.value)
    return false
  return favorites.value.some(fav => fav.provider === activeProvider.value && fav.model === activeModel.value)
})

function resolveDisplayNameForChat(provider: string, model: string) {
  for (const card of cards.value.values()) {
    const cardProv = card.extensions?.airi?.modules?.consciousness?.provider
    const cardModel = card.extensions?.airi?.modules?.consciousness?.model
    if (cardProv === provider && cardModel === model)
      return `${card.name} (${model.split('/').pop() || model})`
  }
  return model.split('/').pop() || model
}

function ensureChatFavoriteAdded(favorite: FavoriteModel) {
  const key = chatModelSelectionKey(favorite.provider, favorite.model)
  deletedKeys.value = deletedKeys.value.filter(deletedKey => deletedKey !== key)
  if (favorites.value.some(fav => fav.provider === favorite.provider && fav.model === favorite.model))
    return
  favorites.value.push(favorite)
}

function handleAddActiveToFavorites() {
  if (!activeProvider.value || !activeModel.value || isActiveInFavorites.value)
    return

  ensureChatFavoriteAdded({
    id: `fav-${activeProvider.value}-${activeModel.value}-${Date.now()}`,
    name: resolveDisplayNameForChat(activeProvider.value, activeModel.value),
    provider: activeProvider.value,
    model: activeModel.value,
  })
}

function isRecentInFavorites(entry: ChatModelRecentEntry) {
  return favorites.value.some(fav => fav.provider === entry.provider && fav.model === entry.model)
}

function handleSelectRecent(entry: ChatModelRecentEntry) {
  handleSelectFavorite({
    id: `recent-${entry.provider}-${entry.model}`,
    name: resolveDisplayNameForChat(entry.provider, entry.model),
    provider: entry.provider,
    model: entry.model,
  })
}

function handleAddRecentToFavorites(entry: ChatModelRecentEntry) {
  if (isRecentInFavorites(entry))
    return
  ensureChatFavoriteAdded({
    id: `fav-${entry.provider}-${entry.model}-${Date.now()}`,
    name: resolveDisplayNameForChat(entry.provider, entry.model),
    provider: entry.provider,
    model: entry.model,
  })
}

function findFavoriteForRecent(entry: ChatModelRecentEntry) {
  return favorites.value.find(fav => fav.provider === entry.provider && fav.model === entry.model)
}

function handleToggleRecentFavorite(entry: ChatModelRecentEntry) {
  if (isRecentInFavorites(entry)) {
    const favorite = findFavoriteForRecent(entry)
    if (favorite)
      handleDeleteFavorite(favorite)
    return
  }
  handleAddRecentToFavorites(entry)
}

function handleToggleFavoriteStar(fav: FavoriteModel) {
  handleDeleteFavorite(fav)
}

function formatRecentSubtitle(entry: ChatModelRecentEntry) {
  return `${entry.provider} / ${entry.model.split('/').pop() || entry.model}`
}

function handleDeleteFavorite(fav: FavoriteModel) {
  favorites.value = favorites.value.filter(f => f.id !== fav.id)

  // Track as deleted so it is never auto-seeded on card additions
  const key = `${fav.provider}:${fav.model}`
  if (!deletedKeys.value.includes(key)) {
    deletedKeys.value.push(key)
  }
}

function handleSelectFavorite(fav: FavoriteModel) {
  consciousnessStore.commitChatSelection(fav.provider, fav.model)

  if (fav.provider !== 'local-llm' && fav.model)
    void stopLocalLlmServerIfRunning()

  // Update active card extensions to keep character state synced
  if (activeCard.value) {
    airiCardStore.updateCard(activeCardId.value, {
      extensions: {
        ...activeCard.value.extensions,
        airi: {
          ...activeCard.value.extensions?.airi,
          modules: {
            ...activeCard.value.extensions?.airi?.modules,
            consciousness: {
              provider: fav.provider,
              model: fav.model,
            },
          },
        },
      },
    } as any)
  }
}

const electronOpenSettings = defineInvokeEventa<void, { route?: string }>('eventa:invoke:electron:windows:settings:open')

function handleGoToSettings() {
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    const openSettings = defineInvoke(session.context, electronOpenSettings)
    void openSettings({ route: '/settings/modules/consciousness' })
  }
  catch (err) {
    console.error('[ChatBrainPopover] Failed to open settings window:', err)
  }
  finally {
    session.dispose()
  }
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        v-if="variant === 'mobile'"
        class="w-fit flex items-center justify-center border-2 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:bg-neutral-800/70"
        :class="[
          !isLlmActive
            ? 'border-red-500 text-red-500 dark:border-red-500/50 dark:text-red-400'
            : 'border-primary-500/50 text-primary-600 dark:border-primary-400/40 dark:text-primary-400',
        ]"
        :title="!isLlmActive ? 'Select a Model & Provider (Required / Not connected)' : title"
      >
        <div class="i-ph:brain-duotone size-5" />
      </button>
      <button
        v-else
        class="max-h-[10lh] min-h-[1lh] flex items-center justify-center rounded-md p-2 outline-none transition-colors transition-transform active:scale-95"
        :class="[
          !isLlmActive
            ? 'bg-red-500/10 text-red-500 hover:text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:text-red-300 ring-1 ring-red-500/30'
            : 'bg-primary-500/15 text-primary-600 ring-1 ring-primary-500/35 dark:bg-primary-400/15 dark:text-primary-400 dark:ring-primary-400/30',
        ]"
        :title="!isLlmActive ? 'Select a Model & Provider (Required / Not connected)' : title"
      >
        <div class="i-ph:brain-duotone text-lg" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        class="animate-in fade-in zoom-in z-100 w-80 border border-neutral-200/50 rounded-2xl bg-white/90 p-4 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <div class="flex items-center gap-1.5">
            <div class="i-ph:brain-duotone text-base text-primary-500" />
            <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Model & Provider</span>
          </div>
          <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold font-mono uppercase dark:bg-primary-500/20">Real-Time</span>
        </div>

        <!-- Active model -->
        <div class="mb-3.5 flex flex-col gap-1.5 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-2 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span
                :class="[
                  'size-1.5 rounded-full',
                  isLlmActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500',
                ]"
              />
              <span class="text-neutral-400 font-bold tracking-tight uppercase">
                {{ isLlmActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="truncate text-neutral-700 font-semibold font-mono dark:text-neutral-300">
              {{ activeProvider }} / {{ activeModelLabel }}
            </span>
            <button
              v-if="activeProvider && activeModel"
              type="button"
              class="w-fit inline-flex items-center gap-1 border border-neutral-200/60 rounded-lg bg-white/60 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold transition-all dark:border-neutral-700/60 hover:border-primary-300 dark:bg-neutral-900/40 dark:text-neutral-300 hover:text-primary-600 disabled:opacity-50 dark:hover:border-primary-700 dark:hover:text-primary-300"
              :disabled="isActiveInFavorites"
              @click="handleAddActiveToFavorites"
            >
              <div
                :class="[
                  'text-xs',
                  isActiveInFavorites ? 'i-solar:star-bold text-primary-500' : 'i-solar:star-linear',
                ]"
              />
              <span>{{ isActiveInFavorites ? 'In favorites' : 'Add to favorites' }}</span>
            </button>
          </div>
        </div>

        <!-- Local LLM Server Controls -->
        <div
          v-if="activeProvider === 'local-llm' && localLlmStatus"
          class="mb-3.5 flex items-center justify-between gap-2 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-1.5 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20"
        >
          <div class="flex items-center gap-1.5">
            <span
              :class="[
                'size-1.5 rounded-full',
                localLlmStatus.state === 'running'
                  ? 'bg-emerald-500 animate-pulse'
                  : localLlmStatus.state === 'starting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500',
              ]"
            />
            <span class="text-neutral-400 font-bold uppercase">Local Server</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span
              v-if="localLlmStatus.state === 'starting'"
              class="animate-pulse text-amber-500 font-semibold"
            >
              Starting...
            </span>
            <button
              v-else-if="localLlmStatus.state === 'running'"
              class="rounded bg-red-500/15 px-2 py-0.5 text-[9px] text-red-500 font-bold transition-all hover:bg-red-500/25"
              @click="handleStopServer"
            >
              Stop Server
            </button>
            <button
              v-else
              class="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-500 font-bold transition-all hover:bg-emerald-500/25"
              :disabled="isStartingServer"
              @click="handleStartServer"
            >
              Start Server
            </button>
          </div>
        </div>

        <!-- Favorites List -->
        <div class="mb-4">
          <div class="mb-2 flex items-center justify-between text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            <span>Favorites</span>
            <span class="text-[9px] text-neutral-400/60 font-mono">{{ favorites.length }} saved</span>
          </div>

          <div v-if="favorites.length === 0" class="border border-neutral-200 rounded-xl border-dashed py-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
            No favorites saved. Add one below!
          </div>

          <div v-else class="max-h-40 overflow-y-auto scrollbar-thin space-y-1.5">
            <div
              v-for="fav in favorites"
              :key="fav.id"
              :class="[
                'group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left',
                fav.provider === activeProvider && fav.model === activeModel
                  ? 'bg-primary-50/50 border-primary-200/50 dark:bg-primary-950/20 dark:border-primary-800/50'
                  : 'bg-white/40 border-neutral-100 hover:bg-neutral-50 dark:bg-neutral-900/40 dark:border-neutral-800 dark:hover:bg-neutral-800/40',
              ]"
              @click="handleSelectFavorite(fav)"
            >
              <div class="flex flex-1 items-center gap-2 overflow-hidden">
                <button
                  type="button"
                  class="i-solar:star-bold shrink-0 text-sm text-primary-500 transition-all hover:text-primary-600"
                  title="Remove from favorites"
                  @click.stop="handleToggleFavoriteStar(fav)"
                />
                <div class="flex flex-col overflow-hidden">
                  <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                    {{ fav.name }}
                  </span>
                  <span class="truncate text-[9px] text-neutral-400 font-mono">
                    {{ fav.provider }} / {{ fav.model }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex justify-center">
            <button
              type="button"
              class="w-fit inline-flex items-center justify-center gap-2 border border-primary-200/50 rounded-full bg-primary-50/50 px-4 py-2 text-[11px] font-semibold transition-all active:scale-[0.98] dark:border-primary-800/50 dark:bg-primary-950/20 hover:bg-primary-100/60 dark:hover:bg-primary-950/35"
              @click="handleGoToSettings"
            >
              <div class="i-solar:settings-bold-duotone text-base text-primary-600 dark:text-primary-400" />
              <span class="text-primary-700 dark:text-primary-300">Open Consciousness settings</span>
            </button>
          </div>
        </div>

        <!-- Recently used models -->
        <div class="border-t border-neutral-100 pt-3.5 dark:border-neutral-800">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-1 scale-95"
            mode="out-in"
          >
            <button
              v-if="!showRecentsPanel"
              type="button"
              class="w-full flex items-center justify-start gap-2 border border-neutral-200/90 rounded-xl bg-neutral-50/90 px-3 py-2.5 text-xs text-neutral-700 font-semibold transition-all active:scale-[0.98] dark:border-neutral-600/90 hover:border-primary-400/70 dark:bg-neutral-800/70 hover:bg-primary-50/50 dark:text-neutral-100 dark:hover:border-primary-600/60 dark:hover:bg-primary-950/30"
              @click="showRecentsPanel = true"
            >
              <div class="i-solar:history-bold text-base text-primary-500 dark:text-primary-400" />
              <span>Recently used models</span>
            </button>

            <div v-else class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Recently used</span>
                <button
                  type="button"
                  class="text-[10px] text-neutral-400 font-semibold hover:text-neutral-600 dark:hover:text-neutral-200"
                  @click="showRecentsPanel = false"
                >
                  Close
                </button>
              </div>

              <div
                v-if="chatRecents.length === 0"
                class="border border-neutral-200 rounded-xl border-dashed py-3 text-center text-[11px] text-neutral-400 dark:border-neutral-800"
              >
                Switch models in Consciousness or pick a favorite to build this list.
              </div>

              <div v-else class="max-h-36 overflow-y-auto scrollbar-thin space-y-1.5">
                <div
                  v-for="entry in chatRecents"
                  :key="`${entry.provider}:${entry.model}:${entry.usedAt}`"
                  :class="[
                    'group flex cursor-pointer items-center justify-between rounded-xl border p-2 text-left transition-all',
                    entry.provider === activeProvider && entry.model === activeModel
                      ? 'border-primary-200/50 bg-primary-50/50 dark:border-primary-800/50 dark:bg-primary-950/20'
                      : 'border-neutral-100 bg-white/40 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-800/40',
                  ]"
                  @click="handleSelectRecent(entry)"
                >
                  <div class="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <button
                      type="button"
                      :class="[
                        'shrink-0 text-sm transition-all',
                        isRecentInFavorites(entry)
                          ? 'text-primary-500 i-solar:star-bold hover:text-primary-600'
                          : 'text-neutral-400 i-solar:star-linear hover:text-primary-500',
                      ]"
                      :title="isRecentInFavorites(entry) ? 'Remove from favorites' : 'Add to favorites'"
                      @click.stop="handleToggleRecentFavorite(entry)"
                    />
                    <div class="min-w-0 flex flex-col overflow-hidden">
                      <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                        {{ resolveDisplayNameForChat(entry.provider, entry.model) }}
                      </span>
                      <span class="truncate text-[9px] text-neutral-400 font-mono dark:text-neutral-500">
                        {{ formatRecentSubtitle(entry) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 5px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 9999px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.45);
}
</style>
