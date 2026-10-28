import { errorMessageFrom } from '@moeru/std'

import { useAiriCardStore } from '../modules/airi-card'
import { useSpeechStore } from '../modules/speech'

/**
 * Applies the same speech setup as picking a voice in the chat speech popover:
 * load catalog state, then copy the runtime selection onto the active character card for Stage TTS.
 */
export async function bootstrapSpeechForChat() {
  const speechStore = useSpeechStore()
  const cardStore = useAiriCardStore()
  await speechStore.prepareSpeechForChatTurn()
  await cardStore.syncActiveCardSpeechFromRuntime()
}

export function scheduleBootstrapSpeechForChat() {
  void bootstrapSpeechForChat().catch((error) => {
    console.error('Speech bootstrap for chat failed:', errorMessageFrom(error))
  })
}
