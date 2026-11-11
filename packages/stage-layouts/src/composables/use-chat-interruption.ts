import type { Ref } from 'vue'

import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useSpeechOutputControlStore } from '@proj-airi/stage-ui/stores/speech-output-control'
import { computed, ref } from 'vue'

import { useStopSpeakingButton } from './useStopSpeakingButton'

/** State and actions that define interruption behavior for one chat composer. */
export interface ChatInterruptionOptions {
  /** Session that owns the active response and receives the next submission. */
  sessionId: Readonly<Ref<string>>
  /** True while the session owns an active LLM request. */
  generating: Readonly<Ref<boolean>>
  /** True when the composer contains text or an attachment that can be sent. */
  hasSubmission: Readonly<Ref<boolean>>
  /** Captures the composer, then runs optional interruption work before sending. */
  submit: (hooks?: ChatInterruptionSubmissionHooks) => Promise<void>
}

interface ChatInterruptionSubmissionHooks {
  afterSendStarted: (sessionId: string) => void
  beforeSend: (sessionId: string) => Promise<void>
}

/**
 * Coordinates LLM cancellation, TTS cancellation, and replacement sends.
 *
 * The stop action appears while a response is active. When the composer is
 * empty, stop replaces send. When the composer holds a draft, stop stays
 * beside send so the user can cancel a slow turn without clearing text.
 * Sending a draft still cancels the visible session's response before the next turn.
 *
 * A response in another session stays stoppable after the user switches chats (#2699).
 * Stop then targets the most recently started turn of another session. Sending from the
 * visible chat does not interrupt it, because unrelated sessions keep running.
 */
export function useChatInterruption(options: ChatInterruptionOptions) {
  const chat = useChatStore()
  const speech = useSpeechOutputControlStore()
  const {
    interruptSpeakingFromChat,
    stopSpeakingFromChat,
  } = useStopSpeakingButton()
  const preparingReplacement = ref(false)

  const visibleResponseActive = computed(() => options.generating.value || speech.activeTurns.some(turn => turn.sessionId === options.sessionId.value))
  // Turns are listed in start order, so the last turn of another session started most recently.
  const responseSessionId = computed(() => visibleResponseActive.value
    ? options.sessionId.value
    : speech.activeTurns.findLast(turn => turn.sessionId !== options.sessionId.value)?.sessionId)
  const responseActive = computed(() => responseSessionId.value !== undefined)
  const showStopAction = computed(() => responseActive.value && !preparingReplacement.value)
  const showComposerSend = computed(() => !showStopAction.value || options.hasSubmission.value)
  async function stopActiveResponse() {
    const sessionId = responseSessionId.value ?? options.sessionId.value
    await chat.cancelPendingSends(sessionId)
    for (const turn of chat.activeTurns) {
      if (turn.sessionId === sessionId)
        await chat.cancelTurn(turn)
    }
    const receipt = await stopSpeakingFromChat(sessionId)
    if (receipt.status === 'failed')
      throw new Error('Response interruption failed')
  }

  async function interruptBeforeSend(sessionId: string) {
    const receipt = await interruptSpeakingFromChat(sessionId)
    if (receipt.status === 'failed')
      throw new Error('Response interruption failed')
  }

  async function submitInterruptingResponse() {
    if (preparingReplacement.value)
      return

    if (!visibleResponseActive.value) {
      await options.submit()
      return
    }

    preparingReplacement.value = true
    try {
      await options.submit({
        beforeSend: interruptBeforeSend,
        afterSendStarted: () => { preparingReplacement.value = false },
      })
    }
    finally {
      preparingReplacement.value = false
    }
  }

  return {
    responseActive,
    showComposerSend,
    showStopAction,
    stopActiveResponse,
    submitInterruptingResponse,
  }
}
