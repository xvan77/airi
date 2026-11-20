<script setup lang="ts">
import type { WindowsVoicePackState, WindowsVoicePackZone } from '@proj-airi/stage-shared'

import {
  buildWindowsVoiceCatalog,
  filterWindowsVoiceCatalogByZone,
  isElectronWindow,
  isStageTamagotchi,
  WINDOWS_VOICE_PACK_ZONES,
} from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CatalogStatChip from '../../menu/catalog-stat-chip.vue'

import { installWindowsVoicePack, listWindowsVoicePacks } from '../../../libs/providers/providers/local-audio/app-local-audio-speech'
import { useSpeechStore } from '../../../stores/modules/speech'

const props = defineProps<{
  installedVoices: readonly {
    id: string
    name: string
    lang?: string
    languages?: readonly { code: string, title?: string }[]
  }[]
}>()

const voiceId = defineModel<string>('voiceId', { default: '' })
const downloadingLocale = defineModel<string>('downloadingLocale', { default: '' })
const clearingLocale = defineModel<string>('clearingLocale', { default: '' })

const { t, locale } = useI18n()
const speechStore = useSpeechStore()
const packs = ref<WindowsVoicePackState[]>([])
const zone = useLocalStorage<WindowsVoicePackZone | null>(
  'settings/speech/app-local-voice-zone',
  'english',
)
const searchQuery = ref('')
const notice = ref<'failed' | 'cancelled' | ''>('')

const languageNames = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' })
  }
  catch {
    return null
  }
})

const normalizedInstalledVoices = computed(() => props.installedVoices.map(voice => ({
  id: voice.id,
  name: voice.name,
  lang: voice.lang
    || voice.languages?.[0]?.code
    || '',
})))

const catalog = computed(() => buildWindowsVoiceCatalog(packs.value, normalizedInstalledVoices.value))

const visibleEntries = computed(() => {
  const filtered = filterWindowsVoiceCatalogByZone(catalog.value, zone.value)
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return filtered
  return filtered.filter((entry) => {
    const language = languageLabel(entry.locale).toLowerCase()
    return entry.name.toLowerCase().includes(query)
      || entry.locale.toLowerCase().includes(query)
      || language.includes(query)
  })
})

function languageLabel(code: string): string {
  if (!code)
    return code
  return languageNames.value?.of(code) ?? code
}

function languageChip(code: string): string {
  const language = code.split('-')[0]?.toUpperCase()
  return language || code
}

function selectZone(next: WindowsVoicePackZone) {
  zone.value = zone.value === next ? null : next
}

watch(zone, (value) => {
  if (value !== null && !WINDOWS_VOICE_PACK_ZONES.includes(value))
    zone.value = 'english'
}, { immediate: true })

function selectVoice(entryId: string, installed: boolean) {
  if (!installed)
    return
  voiceId.value = entryId
}

async function refreshPacks(): Promise<void> {
  if (!isStageTamagotchi() || typeof window === 'undefined' || !isElectronWindow(window))
    return
  packs.value = await listWindowsVoicePacks()
}

async function download(packLocale: string): Promise<void> {
  if (downloadingLocale.value)
    return
  downloadingLocale.value = packLocale
  notice.value = ''
  try {
    const result = await installWindowsVoicePack(packLocale)
    downloadingLocale.value = ''
    if (result.code === 'ready') {
      await refreshPacks()
      void speechStore.loadVoicesForProvider('app-local-audio-speech')
      return
    }
    notice.value = result.code === 'cancelled' ? 'cancelled' : 'failed'
  }
  catch {
    downloadingLocale.value = ''
    notice.value = 'failed'
  }
}

onMounted(() => {
  void refreshPacks()
})

watch(() => props.installedVoices, () => {
  void refreshPacks()
})
</script>

<template>
  <section :class="['flex flex-col gap-3']">
    <div :class="['flex flex-col gap-2 text-xs']">
      <div :class="['min-w-0 flex flex-row flex-wrap items-center gap-2']">
        <span :class="['text-neutral-400 font-medium dark:text-neutral-500']">
          {{ t('settings.pages.modules.speech.sections.section.windows-voices.filter') }}
        </span>
        <div :class="['flex flex-row flex-wrap items-center gap-1']">
          <button
            v-for="option in WINDOWS_VOICE_PACK_ZONES"
            :key="option"
            type="button"
            :class="[
              'rounded-md px-2 py-0.5 transition-all',
              zone === option
                ? 'bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700 dark:bg-neutral-800 dark:hover:text-neutral-300',
            ]"
            @click="selectZone(option)"
          >
            {{ t(`settings.pages.modules.speech.sections.section.windows-voices.zones.${option}`) }}
          </button>
        </div>
      </div>
      <p
        :class="[
          'text-xs leading-snug text-neutral-500 dark:text-neutral-400',
        ]"
      >
        {{ t('settings.pages.modules.speech.sections.section.windows-voices.grouped_download_note') }}
      </p>
    </div>

    <div :class="['relative']">
      <div
        :class="[
          'i-solar:magnifer-linear absolute left-3 top-1/2 text-neutral-400 -translate-y-1/2',
        ]"
      />
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('settings.pages.modules.speech.sections.section.provider-voice-selection.search_voices_placeholder')"
        :class="[
          'w-full border border-neutral-200 rounded-xl bg-transparent py-2.5 pr-3 pl-10 text-sm',
          'dark:border-neutral-800',
        ]"
      >
    </div>

    <p
      v-if="notice"
      :class="['text-sm text-red-600 dark:text-red-300']"
    >
      {{ t(`settings.pages.modules.speech.sections.section.windows-voices.${notice}`) }}
    </p>

    <div
      v-if="visibleEntries.length > 0"
      :class="['grid grid-cols-1 gap-4 md:grid-cols-2']"
    >
      <div
        v-for="entry in visibleEntries"
        :key="`${entry.locale}:${entry.id}`"
        role="button"
        :tabindex="entry.installed ? 0 : -1"
        :class="[
          'relative flex items-start rounded-lg p-2.5 pr-3 text-left',
          'border-2 border-solid',
          voiceId === entry.id
            ? 'border-primary-100 bg-primary-50 dark:border-primary-900 dark:bg-primary-900/20'
            : 'border-neutral-100 bg-white dark:border-neutral-900 dark:bg-neutral-900/20',
          entry.installed
            ? 'cursor-pointer hover:border-primary-500/30 dark:hover:border-primary-400/30'
            : 'cursor-default',
          'transition-all duration-200 ease-in-out',
        ]"
        @click="selectVoice(entry.id, entry.installed)"
        @keydown.enter.prevent="selectVoice(entry.id, entry.installed)"
        @keydown.space.prevent="selectVoice(entry.id, entry.installed)"
      >
        <div :class="['relative mr-3 mt-0.5 shrink-0']">
          <div
            :class="[
              'size-5 border-2 rounded-full transition-colors duration-200',
              entry.installed && voiceId === entry.id
                ? 'border-primary-500 dark:border-primary-400'
                : 'border-neutral-300 dark:border-neutral-600',
              !entry.installed ? 'opacity-50' : '',
            ]"
          >
            <div
              :class="[
                'absolute left-1/2 top-1/2 size-3 rounded-full -translate-x-1/2 -translate-y-1/2',
                entry.installed && voiceId === entry.id
                  ? 'bg-primary-500 opacity-100 dark:bg-primary-400'
                  : 'opacity-0',
              ]"
            />
          </div>
        </div>

        <div :class="['min-w-0 w-full flex flex-col gap-1.5']">
          <div :class="['grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5']">
            <span
              :class="[
                'line-clamp-2 col-start-1 row-start-1 min-w-0',
                'text-sm text-neutral-700 font-normal leading-snug',
                'dark:text-neutral-300',
              ]"
            >
              {{ entry.name }}
            </span>
            <div
              :class="[
                'relative z-10 col-start-2 row-start-1 shrink-0 self-start justify-self-end',
              ]"
            >
              <button
                v-if="!entry.installed"
                type="button"
                :class="[
                  'rounded-md px-2 py-0.5 text-xs font-semibold transition-all',
                  'bg-primary-100 text-primary-700',
                  'hover:bg-primary-200',
                  'dark:bg-primary-900/40 dark:text-primary-300',
                  'dark:hover:bg-primary-900/60',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ]"
                :disabled="downloadingLocale === entry.locale || clearingLocale === entry.locale"
                @click.stop="download(entry.locale)"
              >
                {{ downloadingLocale === entry.locale
                  ? t('settings.pages.modules.speech.sections.section.windows-voices.downloading')
                  : t('settings.pages.modules.speech.sections.section.windows-voices.download') }}
              </button>
              <span
                v-else
                :class="[
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  'bg-neutral-100 text-neutral-500',
                  'dark:bg-neutral-800 dark:text-neutral-400',
                ]"
              >
                {{ t('settings.pages.modules.speech.sections.section.windows-voices.ready') }}
              </span>
            </div>
            <div
              :class="[
                'relative z-10 col-start-1 row-start-2 flex flex-wrap gap-1',
              ]"
            >
              <CatalogStatChip
                :label="languageChip(entry.locale)"
                :title="languageLabel(entry.locale)"
              />
              <CatalogStatChip
                :label="languageLabel(entry.locale)"
                :title="entry.locale"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <p
      v-else
      :class="['text-sm text-neutral-500 dark:text-neutral-400']"
    >
      {{ t('settings.pages.modules.speech.sections.section.windows-voices.empty_zone') }}
    </p>
  </section>
</template>
