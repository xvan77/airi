import messages from '@proj-airi/i18n/locales'

import { resolveInitialUserLocale } from '@proj-airi/i18n'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { onMounted } from 'vue'

export const useSettingsGeneral = defineStore('settings-general', () => {
  const language = useLocalStorageManualReset<string>('settings/language', '')
  const streamerMode = useLocalStorageManualReset<boolean>('settings/streamer-mode', false)

  const disableTransitions = useLocalStorageManualReset<boolean>('settings/disable-transitions', true)
  const usePageSpecificTransitions = useLocalStorageManualReset<boolean>('settings/use-page-specific-transitions', true)

  const websocketSecureEnabled = useLocalStorageManualReset<boolean>('settings/websocket/secure-enabled', false)

  function getLanguage() {
    return resolveInitialUserLocale(
      localStorage.getItem('settings/language'),
      Object.keys(messages!),
    )
  }

  function resetState() {
    language.reset()
    streamerMode.reset()
    disableTransitions.reset()
    usePageSpecificTransitions.reset()
    websocketSecureEnabled.reset()
  }

  onMounted(() => language.value = getLanguage())

  return {
    language,
    streamerMode,
    disableTransitions,
    usePageSpecificTransitions,
    websocketSecureEnabled,
    getLanguage,
    resetState,
  }
})
