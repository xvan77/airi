import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const MIN_VISIBLE_MS = 1400

export function useChatOpeningOverlay() {
  const onboardingStore = useOnboardingStore()
  const { openingChatAfterSetup } = storeToRefs(onboardingStore)
  const showLocalOverlay = ref(false)
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  async function showUntilReady() {
    if (!openingChatAfterSetup.value && !showLocalOverlay.value)
      return

    clearHideTimer()
    showLocalOverlay.value = true
    const startedAt = performance.now()
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const elapsed = performance.now() - startedAt
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    hideTimer = setTimeout(() => {
      showLocalOverlay.value = false
      hideTimer = null
      onboardingStore.clearOpeningChat()
    }, remaining)
  }

  watch(openingChatAfterSetup, (opening) => {
    if (opening)
      void showUntilReady()
  }, { immediate: true })

  onMounted(() => {
    if (openingChatAfterSetup.value)
      void showUntilReady()
  })

  const showChatOpeningOverlay = computed(() => showLocalOverlay.value || openingChatAfterSetup.value)

  return { showChatOpeningOverlay }
}
