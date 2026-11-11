import { isGoogleConsciousnessIncompatibleModel } from './google-retired-chat-models'
import { nonChatModelHaystackMatches } from './non-chat-model-markers'

export {
  isGoogleChatModelRetiredForNewUsers,
  isGoogleConsciousnessIncompatibleModel,
} from './google-retired-chat-models'

export {
  NON_CHAT_MODEL_ID_MARKERS,
  nonChatModelHaystackMatches,
  nonChatModelIdMatches,
} from './non-chat-model-markers'

export interface ChatModelRef {
  id: string
  name?: string
}

function haystackForModel(model: ChatModelRef): string {
  return `${model.id} ${model.name ?? ''}`.toLowerCase()
}

/** True when the catalog id or display name marks a speech or audio checkpoint, not text chat. */
export function isSpeechOrAudioCatalogModel(model: ChatModelRef): boolean {
  const haystack = haystackForModel(model)
  const audioMarkers = ['tts', 'text-to-speech', 'text_to_speech', 'audio', 'whisper', 'transcribe', 'speech-to-text', 'stt', 'realtime', 'orpheus', 'playai-tts'] as const
  return audioMarkers.some(marker => haystack.includes(marker))
}

/** True when the id or name marks a moderation or safety API, not conversational chat. */
export function isModerationCatalogModel(model: ChatModelRef): boolean {
  const haystack = haystackForModel(model)
  return haystack.includes('safeguard') || haystack.includes('moderation')
}

export function isMediaGenerationCatalogModel(model: ChatModelRef): boolean {
  const haystack = haystackForModel(model)
  const mediaMarkers = ['image', 'video', 'vision', 'imagine', 'text-to-image', 'image-generation', 'video-generation', 'dall-e', 'dalle', 'gpt-image', 'sora', 'veo', 'flux'] as const
  return mediaMarkers.some(marker => haystack.includes(marker))
}

export function isEmbeddingCatalogModel(model: ChatModelRef): boolean {
  const haystack = haystackForModel(model)
  return haystack.includes('embed')
}

/**
 * True when AIRI must not use this model for Consciousness chat or provider Ping.
 * Uses one shared marker list plus Google-only retired ids.
 */
export function isExcludedFromUsableChatModel(
  model: ChatModelRef,
  providerId: string,
): boolean {
  if (nonChatModelHaystackMatches(haystackForModel(model)))
    return true
  if (providerId === 'google-generative-ai' && isGoogleConsciousnessIncompatibleModel(model.id))
    return true
  return false
}

/** @deprecated Use isExcludedFromUsableChatModel. Kept for Consciousness catalog imports. */
export function isExcludedFromConsciousnessCatalog(
  model: ChatModelRef,
  providerId: string,
): boolean {
  return isExcludedFromUsableChatModel(model, providerId)
}

export function isUsableChatModel(model: ChatModelRef, providerId: string): boolean {
  return !isExcludedFromUsableChatModel(model, providerId)
}
