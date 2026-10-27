import type { ChatButtonState } from '../../shared/eventa'

import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { electronChatButtonStateChanged, electronGetChatButtonState } from '../../shared/eventa'

const MAX_WAIT_MS = 60_000
const POLL_MS = 400

function isChatVisible(state: ChatButtonState) {
  if (state.mode === 'floating')
    return state.floatingShown
  return state.mode === 'legacy' || state.mode === 'fullscreen'
}

export function useStageChatOpeningOverlay() {
  const onboardingStore = useOnboardingStore()
  const { openingChatAfterSetup } = storeToRefs(onboardingStore)
  const showOpeningChat = ref(false)
  const getChatButtonState = useElectronEventaInvoke(electronGetChatButtonState)
  const context = useElectronEventaContext()

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer)
      maxWaitTimer = null
    }
  }

  function finish() {
    if (!showOpeningChat.value)
      return
    showOpeningChat.value = false
    clearTimers()
  }

  async function pollChatVisibility() {
    try {
      const state = await getChatButtonState()
      if (isChatVisible(state))
        finish()
    }
    catch {
      // The chat window may still be starting.
    }
  }

  function startWatching() {
    showOpeningChat.value = true
    clearTimers()
    void pollChatVisibility()
    pollTimer = setInterval(() => void pollChatVisibility(), POLL_MS)
    maxWaitTimer = setTimeout(finish, MAX_WAIT_MS)
  }

  const stopStateChanged = context.value.on(electronChatButtonStateChanged, (event) => {
    if (!showOpeningChat.value || !event?.body)
      return
    if (isChatVisible(event.body))
      finish()
  })
  onScopeDispose(() => {
    stopStateChanged()
    clearTimers()
  })

  watch(openingChatAfterSetup, (opening) => {
    if (opening)
      startWatching()
    else if (!openingChatAfterSetup.value)
      finish()
  }, { immediate: true })

  const showChatOpeningOverlay = computed(() => showOpeningChat.value)

  return { showChatOpeningOverlay }
}
