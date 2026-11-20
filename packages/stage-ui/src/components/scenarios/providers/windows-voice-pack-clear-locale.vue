<script setup lang="ts">
import type { WindowsVoicePackState } from '@proj-airi/stage-shared'

import {
  buildWindowsVoiceCatalog,
  isElectronWindow,
  isStageTamagotchi,
} from '@proj-airi/stage-shared'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { listWindowsVoicePacks, removeWindowsVoicePack } from '../../../libs/providers/providers/local-audio/app-local-audio-speech'
import { useSpeechStore } from '../../../stores/modules/speech'

const props = defineProps<{
  installedVoices: readonly {
    id: string
    name: string
    lang?: string
    languages?: readonly { code: string, title?: string }[]
  }[]
}>()

const emit = defineEmits<{
  notice: [value: 'remove_failed' | 'remove_cancelled' | '']
}>()
const voiceId = defineModel<string>('voiceId', { default: '' })
const clearingLocale = defineModel<string>('clearingLocale', { default: '' })

const { t, locale } = useI18n()
const speechStore = useSpeechStore()
const packs = ref<WindowsVoicePackState[]>([])

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

const selectedInstalledEntry = computed(() => {
  return catalog.value.find(entry => entry.installed && entry.id === voiceId.value) ?? null
})

const isClearing = computed(() => clearingLocale.value !== '')

const clearButtonLabel = computed(() => {
  const selected = selectedInstalledEntry.value
  if (!selected)
    return ''
  if (clearingLocale.value === selected.locale)
    return t('settings.pages.modules.speech.sections.section.windows-voices.clearing')
  return t('settings.pages.modules.speech.sections.section.windows-voices.clear_locale', {
    language: languageLabel(selected.locale),
  })
})

function languageLabel(code: string): string {
  if (!code)
    return code
  return languageNames.value?.of(code) ?? code
}

async function refreshPacks(): Promise<void> {
  if (!isStageTamagotchi() || typeof window === 'undefined' || !isElectronWindow(window))
    return
  packs.value = await listWindowsVoicePacks()
}

async function clearSelectedLocale(): Promise<void> {
  const selected = selectedInstalledEntry.value
  if (!selected || isClearing.value)
    return

  const packLocale = selected.locale
  clearingLocale.value = packLocale
  emit('notice', '')
  try {
    const result = await removeWindowsVoicePack(packLocale)
    clearingLocale.value = ''
    if (result.code === 'ready') {
      voiceId.value = ''
      await refreshPacks()
      void speechStore.loadVoicesForProvider('app-local-audio-speech')
      return
    }
    emit('notice', result.code === 'cancelled' ? 'remove_cancelled' : 'remove_failed')
  }
  catch {
    clearingLocale.value = ''
    emit('notice', 'remove_failed')
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
  <button
    v-if="selectedInstalledEntry"
    type="button"
    :class="[
      'inline-flex max-w-full items-center justify-center rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all',
      'border-neutral-200 text-neutral-600',
      'hover:border-neutral-300 hover:bg-neutral-50',
      'dark:border-neutral-700 dark:text-neutral-300',
      'dark:hover:border-neutral-600 dark:hover:bg-neutral-900/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
    ]"
    :disabled="isClearing"
    @click="clearSelectedLocale"
  >
    {{ clearButtonLabel }}
  </button>
</template>
