<script setup lang="ts">
import type { SpeechModelRecentEntry } from '../../../composables/chat/popover-model-recents'

import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import {

  speechModelSelectionKey,
  useSpeechModelRecents,
} from '../../../composables/chat/popover-model-recents'
import { openTamagotchiEventaSession } from '../../../composables/chat/tamagotchi-eventa-session'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useSpeechStore } from '../../../stores/modules/speech'

withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  variant?: 'default' | 'mobile'
}>(), {
  title: 'Speech & Voice',
  variant: 'default',
})

// Store bindings
const speechStore = useSpeechStore()
const airiCardStore = useAiriCardStore()

const { activeSpeechProvider, activeSpeechModel, activeSpeechVoiceId } = storeToRefs(speechStore)
const { cards } = storeToRefs(airiCardStore)

const showRecentsPanel = ref(false)
const speechRecents = useSpeechModelRecents()

interface FavoriteSpeechModel {
  id: string
  name: string
  provider: string
  model: string
  voiceId: string
}

// Persistent Storage for Favorites
const favorites = useLocalStorage<FavoriteSpeechModel[]>('airi:speech-model-favorites', [])
const deletedKeys = useLocalStorage<string[]>('airi:speech-model-deleted-keys', [])

// Seeding default favorites reactively to perfectly handle asynchronous card store hydration
watch(cards, (newCards) => {
  const discovered = new Set<string>()

  // 1. Coalesce the current active configuration first
  if (activeSpeechProvider.value && activeSpeechVoiceId.value) {
    discovered.add(`${activeSpeechProvider.value}:${activeSpeechModel.value || ''}:${activeSpeechVoiceId.value}`)
  }

  // 2. Coalesce all distinct configurations from character cards
  for (const card of newCards.values()) {
    const provider = card.extensions?.airi?.modules?.speech?.provider
    const model = card.extensions?.airi?.modules?.speech?.model || ''
    const voiceId = card.extensions?.airi?.modules?.speech?.voice_id
    if (provider && voiceId) {
      discovered.add(`${provider}:${model}:${voiceId}`)
    }
  }

  // 3. Dynamically sync discovered models into the favorites list
  for (const key of discovered) {
    const [provider, model, voiceId] = key.split(':')

    // If explicitly deleted, respect that choice
    if (deletedKeys.value.includes(key))
      continue

    const alreadyInFavorites = favorites.value.some(
      fav => fav.provider === provider && fav.model === model && fav.voiceId === voiceId,
    )
    if (!alreadyInFavorites) {
      let displayName = `Current (${model ? `${model.split('/').pop() || model} - ` : ''}${voiceId})`
      for (const card of newCards.values()) {
        const cardProv = card.extensions?.airi?.modules?.speech?.provider
        const cardModel = card.extensions?.airi?.modules?.speech?.model || ''
        const cardVoiceId = card.extensions?.airi?.modules?.speech?.voice_id
        if (cardProv === provider && cardModel === model && cardVoiceId === voiceId) {
          displayName = `${card.name} (${model ? `${model.split('/').pop() || model} - ` : ''}${voiceId})`
          break
        }
      }

      favorites.value.push({
        id: `seed-${provider}-${model}-${voiceId}`,
        name: displayName,
        provider,
        model,
        voiceId,
      })
    }
  }
}, { immediate: true, deep: true })

const isSpeechActive = computed(() => {
  return speechStore.configured
})

const isActiveInFavorites = computed(() => {
  if (!activeSpeechProvider.value || !activeSpeechVoiceId.value)
    return false
  return favorites.value.some(
    fav => fav.provider === activeSpeechProvider.value
      && fav.model === (activeSpeechModel.value || '')
      && fav.voiceId === activeSpeechVoiceId.value,
  )
})

function resolveDisplayNameForSpeech(provider: string, model: string, voiceId: string) {
  for (const card of cards.value.values()) {
    const cardProv = card.extensions?.airi?.modules?.speech?.provider
    const cardModel = card.extensions?.airi?.modules?.speech?.model || ''
    const cardVoiceId = card.extensions?.airi?.modules?.speech?.voice_id
    if (cardProv === provider && cardModel === model && cardVoiceId === voiceId) {
      const modelPart = model ? `${model.split('/').pop() || model} - ` : ''
      return `${card.name} (${modelPart}${voiceId})`
    }
  }
  const modelPart = model ? `${model.split('/').pop() || model} - ` : ''
  return `${modelPart}${voiceId}`
}

function ensureSpeechFavoriteAdded(favorite: FavoriteSpeechModel) {
  const key = speechModelSelectionKey(favorite.provider, favorite.model, favorite.voiceId)
  deletedKeys.value = deletedKeys.value.filter(deletedKey => deletedKey !== key)
  if (favorites.value.some(
    fav => fav.provider === favorite.provider
      && fav.model === favorite.model
      && fav.voiceId === favorite.voiceId,
  )) {
    return
  }
  favorites.value.push(favorite)
}

function handleAddActiveToFavorites() {
  if (!activeSpeechProvider.value || !activeSpeechVoiceId.value || isActiveInFavorites.value)
    return

  ensureSpeechFavoriteAdded({
    id: `fav-${activeSpeechProvider.value}-${activeSpeechVoiceId.value}-${Date.now()}`,
    name: resolveDisplayNameForSpeech(
      activeSpeechProvider.value,
      activeSpeechModel.value || '',
      activeSpeechVoiceId.value,
    ),
    provider: activeSpeechProvider.value,
    model: activeSpeechModel.value || '',
    voiceId: activeSpeechVoiceId.value,
  })
}

function isRecentInFavorites(entry: SpeechModelRecentEntry) {
  return favorites.value.some(
    fav => fav.provider === entry.provider
      && fav.model === entry.model
      && fav.voiceId === entry.voiceId,
  )
}

async function handleSelectRecent(entry: SpeechModelRecentEntry) {
  await handleSelectFavorite({
    id: `recent-${entry.provider}-${entry.voiceId}`,
    name: resolveDisplayNameForSpeech(entry.provider, entry.model, entry.voiceId),
    provider: entry.provider,
    model: entry.model,
    voiceId: entry.voiceId,
  })
}

function handleAddRecentToFavorites(entry: SpeechModelRecentEntry) {
  if (isRecentInFavorites(entry))
    return
  ensureSpeechFavoriteAdded({
    id: `fav-${entry.provider}-${entry.voiceId}-${Date.now()}`,
    name: resolveDisplayNameForSpeech(entry.provider, entry.model, entry.voiceId),
    provider: entry.provider,
    model: entry.model,
    voiceId: entry.voiceId,
  })
}

function findFavoriteForRecent(entry: SpeechModelRecentEntry) {
  return favorites.value.find(
    fav => fav.provider === entry.provider
      && fav.model === entry.model
      && fav.voiceId === entry.voiceId,
  )
}

function handleToggleRecentFavorite(entry: SpeechModelRecentEntry) {
  if (isRecentInFavorites(entry)) {
    const favorite = findFavoriteForRecent(entry)
    if (favorite)
      handleDeleteFavorite(favorite)
    return
  }
  handleAddRecentToFavorites(entry)
}

function handleToggleFavoriteStar(fav: FavoriteSpeechModel) {
  handleDeleteFavorite(fav)
}

function formatRecentSubtitle(entry: SpeechModelRecentEntry) {
  const modelPart = entry.model ? `${entry.model.split('/').pop() || entry.model} / ` : ''
  return `${entry.provider} / ${modelPart}${entry.voiceId}`
}

function handleDeleteFavorite(fav: FavoriteSpeechModel) {
  favorites.value = favorites.value.filter(f => f.id !== fav.id)

  const key = `${fav.provider}:${fav.model}:${fav.voiceId}`
  if (!deletedKeys.value.includes(key)) {
    deletedKeys.value.push(key)
  }
}

async function handleSelectFavorite(fav: FavoriteSpeechModel) {
  await speechStore.commitSpeechSelection(fav.provider, fav.model, fav.voiceId)
  await airiCardStore.syncActiveCardSpeechFromRuntime()
}

const electronOpenSettings = defineInvokeEventa<void, { route?: string }>('eventa:invoke:electron:windows:settings:open')

function handleGoToSettings() {
  const session = openTamagotchiEventaSession()
  if (!session)
    return
  try {
    const openSettings = defineInvoke(session.context, electronOpenSettings)
    void openSettings({ route: '/settings/modules/speech' })
  }
  catch (err) {
    console.error('[ChatSpeechPopover] Failed to open settings window:', err)
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
        :class="[
          'w-fit flex items-center justify-center border-2 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:bg-neutral-800/70',
          !isSpeechActive
            ? 'border-red-500 text-red-500 dark:border-red-500/50 dark:text-red-400'
            : 'border-primary-500/50 text-primary-600 dark:border-primary-400/40 dark:text-primary-400',
        ]"
        :title="!isSpeechActive ? 'Select a Speech Voice & Provider (Required)' : title"
      >
        <div class="i-ph:waveform-duotone size-5" />
      </button>
      <button
        v-else
        :class="[
          'max-h-[10lh] min-h-[1lh] flex items-center justify-center rounded-md p-2 outline-none transition-colors transition-transform active:scale-95',
          !isSpeechActive
            ? 'bg-red-500/10 text-red-500 hover:text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:text-red-300 ring-1 ring-red-500/30'
            : 'bg-primary-500/15 text-primary-600 ring-1 ring-primary-500/35 dark:bg-primary-400/15 dark:text-primary-400 dark:ring-primary-400/30',
        ]"
        :title="!isSpeechActive ? 'Select a Speech Voice & Provider (Required)' : title"
      >
        <div class="i-ph:waveform-duotone text-lg" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        :class="['animate-in fade-in zoom-in z-100 w-80 border border-neutral-200/50 rounded-2xl bg-white/90 p-4 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90']"
      >
        <!-- Header -->
        <div :class="['mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800']">
          <div :class="['flex items-center gap-1.5']">
            <div class="i-ph:waveform-duotone text-base text-primary-500" />
            <span :class="['text-xs text-neutral-400 font-bold tracking-wider uppercase']">Speech & Voice</span>
          </div>
          <span :class="['rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold font-mono uppercase dark:bg-primary-500/20']">Speech</span>
        </div>

        <!-- Active voice -->
        <div :class="['mb-3.5 flex flex-col gap-1.5 border border-neutral-200/30 rounded-xl bg-neutral-50/50 px-2.5 py-2 text-[10px] dark:border-neutral-800/60 dark:bg-neutral-800/20']">
          <div :class="['flex items-center gap-1.5']">
            <span
              :class="[
                'size-1.5 rounded-full',
                isSpeechActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500',
              ]"
            />
            <span :class="['text-neutral-400 font-bold tracking-tight uppercase']">
              {{ isSpeechActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div :class="['flex flex-col gap-1']">
            <span :class="['truncate text-neutral-700 font-semibold font-mono dark:text-neutral-300']">
              {{ activeSpeechProvider }} / {{ activeSpeechVoiceId || 'None' }}
            </span>
            <button
              v-if="activeSpeechProvider && activeSpeechVoiceId"
              type="button"
              :class="['inline-flex w-fit items-center gap-1 rounded-lg border border-neutral-200/60 bg-white/60 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold transition-all disabled:opacity-50 dark:border-neutral-700/60 dark:bg-neutral-900/40 dark:text-neutral-300 hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-700 dark:hover:text-primary-300']"
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

        <!-- Favorites List -->
        <div :class="['mb-4']">
          <div :class="['mb-2 flex items-center justify-between text-[10px] text-neutral-400 font-bold tracking-wider uppercase']">
            <span>Favorites</span>
            <span :class="['text-[9px] text-neutral-400/60 font-mono']">{{ favorites.length }} saved</span>
          </div>

          <div v-if="favorites.length === 0" :class="['border border-neutral-200 rounded-xl border-dashed py-4 text-center text-xs text-neutral-400 dark:border-neutral-800']">
            No favorites saved. Add one below!
          </div>

          <div v-else :class="['max-h-40 overflow-y-auto scrollbar-thin space-y-1.5']">
            <div
              v-for="fav in favorites"
              :key="fav.id"
              :class="[
                'group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left',
                fav.provider === activeSpeechProvider && fav.model === activeSpeechModel && fav.voiceId === activeSpeechVoiceId
                  ? 'bg-primary-50/50 border-primary-200/50 dark:bg-primary-950/20 dark:border-primary-800/50'
                  : 'bg-white/40 border-neutral-100 hover:bg-neutral-50 dark:bg-neutral-900/40 dark:border-neutral-800 dark:hover:bg-neutral-800/40',
              ]"
              @click="handleSelectFavorite(fav)"
            >
              <div :class="['flex flex-1 items-center gap-2 overflow-hidden']">
                <button
                  type="button"
                  :class="['shrink-0 text-sm text-primary-500 transition-all i-solar:star-bold hover:text-primary-600']"
                  title="Remove from favorites"
                  @click.stop="handleToggleFavoriteStar(fav)"
                />
                <div :class="['flex flex-col overflow-hidden']">
                  <span :class="['truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200']">
                    {{ fav.name }}
                  </span>
                  <span :class="['truncate text-[9px] text-neutral-400 font-mono']">
                    {{ fav.provider }} / {{ fav.model ? `${fav.model} / ` : '' }}{{ fav.voiceId }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div :class="['mt-3 flex justify-center']">
            <button
              type="button"
              :class="['inline-flex w-fit items-center justify-center gap-2 rounded-full border border-primary-200/50 bg-primary-50/50 px-4 py-2 text-[11px] font-semibold transition-all active:scale-[0.98] dark:border-primary-800/50 dark:bg-primary-950/20 hover:bg-primary-100/60 dark:hover:bg-primary-950/35']"
              @click="handleGoToSettings"
            >
              <div class="i-solar:settings-bold-duotone text-base text-primary-600 dark:text-primary-400" />
              <span class="text-primary-700 dark:text-primary-300">Open Speech settings</span>
            </button>
          </div>
        </div>

        <!-- Recently used voices -->
        <div :class="['border-t border-neutral-100 pt-3.5 dark:border-neutral-800']">
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
              :class="['w-full flex items-center justify-start gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50/90 px-3 py-2.5 text-xs text-neutral-700 font-semibold transition-all active:scale-[0.98] dark:border-neutral-600/90 dark:bg-neutral-800/70 dark:text-neutral-100 hover:border-primary-400/70 hover:bg-primary-50/50 dark:hover:border-primary-600/60 dark:hover:bg-primary-950/30']"
              @click="showRecentsPanel = true"
            >
              <div class="i-solar:history-bold text-base text-primary-500 dark:text-primary-400" />
              <span>Recently used models</span>
            </button>

            <div v-else :class="['space-y-2']">
              <div :class="['flex items-center justify-between']">
                <span :class="['text-[10px] text-neutral-400 font-bold tracking-wider uppercase']">Recently used</span>
                <button
                  type="button"
                  :class="['text-[10px] text-neutral-400 font-semibold hover:text-neutral-600 dark:hover:text-neutral-200']"
                  @click="showRecentsPanel = false"
                >
                  Close
                </button>
              </div>

              <div
                v-if="speechRecents.length === 0"
                :class="['border border-neutral-200 rounded-xl border-dashed py-3 text-center text-[11px] text-neutral-400 dark:border-neutral-800']"
              >
                Switch voices in Speech or pick a favorite to build this list.
              </div>

              <div v-else :class="['max-h-36 overflow-y-auto scrollbar-thin space-y-1.5']">
                <div
                  v-for="entry in speechRecents"
                  :key="`${entry.provider}:${entry.model}:${entry.voiceId}:${entry.usedAt}`"
                  :class="[
                    'group flex cursor-pointer items-center justify-between rounded-xl border p-2 text-left transition-all',
                    entry.provider === activeSpeechProvider && entry.model === (activeSpeechModel || '') && entry.voiceId === activeSpeechVoiceId
                      ? 'border-primary-200/50 bg-primary-50/50 dark:border-primary-800/50 dark:bg-primary-950/20'
                      : 'border-neutral-100 bg-white/40 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-800/40',
                  ]"
                  @click="handleSelectRecent(entry)"
                >
                  <div :class="['flex min-w-0 flex-1 items-center gap-2 overflow-hidden']">
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
                    <div :class="['flex min-w-0 flex-col overflow-hidden']">
                      <span :class="['truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200']">
                        {{ resolveDisplayNameForSpeech(entry.provider, entry.model, entry.voiceId) }}
                      </span>
                      <span :class="['truncate text-[9px] text-neutral-400 font-mono dark:text-neutral-500']">
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
