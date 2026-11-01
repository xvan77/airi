import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { useElectronEventaContext } from '@proj-airi/electron-vueuse'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { onMounted, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'

interface LocalLlmServerStatus {
  state: 'idle' | 'downloading_binary' | 'starting' | 'running' | 'stopped' | 'error'
}

const electronLocalLlmGetStatus = defineInvokeEventa<LocalLlmServerStatus>('eventa:invoke:electron:local-llm:get-status')

export const LOCAL_LLM_STARTUP_NOTICE_MESSAGE_ID = 'local-llm-startup-notice'

function isStartupState(state: LocalLlmServerStatus['state']) {
  return state === 'starting' || state === 'downloading_binary'
}

/** Shows an animated chat notice while the local LLM server starts. Removes it when the server is ready. */
export function useLocalLlmStartupChatNotice() {
  const { t } = useI18n()
  const chatSessionStore = useChatSessionStore()
  const context = useElectronEventaContext()

  let pollTimer: ReturnType<typeof setInterval> | undefined

  function noticePresent(sessionId: string) {
    return chatSessionStore.getSessionMessages(sessionId)
      .some(message => message.id === LOCAL_LLM_STARTUP_NOTICE_MESSAGE_ID)
  }

  async function ensureNotice(sessionId: string) {
    if (noticePresent(sessionId))
      return

    chatSessionStore.appendSessionMessage(sessionId, {
      id: LOCAL_LLM_STARTUP_NOTICE_MESSAGE_ID,
      role: 'user',
      content: t('tamagotchi.stage.chat.starting-local-llm-server'),
      notice: { source: 'status:local-llm' },
    })
  }

  async function clearNotice(sessionId: string) {
    if (!noticePresent(sessionId))
      return

    await chatSessionStore.deleteMessage({
      sessionId,
      messageId: LOCAL_LLM_STARTUP_NOTICE_MESSAGE_ID,
    })
  }

  async function syncNoticeWithStatus() {
    try {
      const getStatus = defineInvoke(context.value, electronLocalLlmGetStatus)
      const status = await getStatus()
      const sessionId = await chatSessionStore.ensureCurrentSession()

      if (isStartupState(status.state))
        await ensureNotice(sessionId)
      else
        await clearNotice(sessionId)
    }
    catch {
      // Chat may run before the main process registers local LLM handlers.
    }
  }

  onMounted(() => {
    void syncNoticeWithStatus()
    pollTimer = setInterval(() => {
      void syncNoticeWithStatus()
    }, 800)
  })

  onScopeDispose(() => {
    if (pollTimer)
      clearInterval(pollTimer)
  })
}
