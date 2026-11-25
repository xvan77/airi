import type { CompiledCharacterCard } from '../services/airi-card-from-text'

import { errorMessageFrom } from '@moeru/std'
import { storeToRefs } from 'pinia'
import { shallowRef } from 'vue'

import {
  AIRI_CARD_FROM_TEXT_MAX_INPUT,
  compiledCharacterCardToCardDraft,
  createCardCompilerConversation,
  parseCompiledCharacterCardFromModelText,
} from '../services/airi-card-from-text'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useTextGeneration } from './text-generation'

export function useAiriCardFromText() {
  const consciousnessStore = useConsciousnessStore()
  const { activeProvider, activeModel, configured } = storeToRefs(consciousnessStore)
  const { generateText } = useTextGeneration()

  const compiling = shallowRef(false)
  const error = shallowRef<string | undefined>()

  async function compileFromText(sourceText: string): Promise<CompiledCharacterCard | undefined> {
    error.value = undefined
    const trimmed = sourceText.trim()
    if (trimmed.length < 50) {
      error.value = 'too_short'
      return undefined
    }
    if (trimmed.length > AIRI_CARD_FROM_TEXT_MAX_INPUT) {
      error.value = 'too_long'
      return undefined
    }
    if (!configured.value || !activeProvider.value || !activeModel.value) {
      error.value = 'no_consciousness'
      return undefined
    }

    compiling.value = true
    try {
      const run = generateText({
        providerId: activeProvider.value,
        model: activeModel.value,
      })
      const reply = await run(
        createCardCompilerConversation(trimmed),
        new AbortController().signal,
      )
      return parseCompiledCharacterCardFromModelText(reply)
    }
    catch (cause) {
      error.value = errorMessageFrom(cause) ?? 'compile_failed'
      return undefined
    }
    finally {
      compiling.value = false
    }
  }

  function toCardDraft(compiled: CompiledCharacterCard) {
    return compiledCharacterCardToCardDraft(compiled)
  }

  return {
    compiling,
    error,
    activeProvider,
    activeModel,
    configured,
    compileFromText,
    toCardDraft,
  }
}
