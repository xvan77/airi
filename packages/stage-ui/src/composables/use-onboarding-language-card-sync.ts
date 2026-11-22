import { all } from '@proj-airi/i18n'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAiriCardStore } from '../stores/modules/airi-card'
import { useSettingsGeneral } from '../stores/settings'

const languages = computed(() => Object.entries(all).map(([value, label]) => ({ value, label: label as string })))

/** Keeps the default card description aligned with the UI language during onboarding. */
export function useOnboardingDefaultCardLanguageSync() {
  const cardStore = useAiriCardStore()

  // The built-in card gets its description before the user chooses a language. While it still holds the built-in
  // text, it takes the text of the chosen language. A description that the user edited stays.
  watch(() => cardStore.builtInCard.description, (description, previous) => {
    const card = cardStore.getCard('default')
    if (card && card.description === previous)
      void cardStore.updateCard('default', { ...card, description })
  })
}

export function useOnboardingLanguageCardSync() {
  const { locale } = useI18n()
  const settingsStore = useSettingsGeneral()
  const { language } = storeToRefs(settingsStore)

  function applyLanguage(localeCode: string) {
    language.value = localeCode
    locale.value = localeCode
  }

  return {
    applyLanguage,
    language,
    languages,
  }
}
