/** Substrings matched against a lowercased model id (and display name for catalog). */
export const NON_CHAT_MODEL_ID_MARKERS = [
  'embed',
  'tts',
  'whisper',
  'transcribe',
  'speech-to-text',
  'text-to-speech',
  'text_to_speech',
  'stt',
  'orpheus',
  'playai-tts',
  'realtime',
  'audio',
  'image',
  'video',
  'vision',
  'imagine',
  'text-to-image',
  'image-generation',
  'video-generation',
  'dall-e',
  'dalle',
  'gpt-image',
  'sora',
  'veo',
  'flux',
  'safeguard',
  'moderation',
  'interaction',
  'computer-use',
  'deep-research',
  ':vl',
  '-vl',
] as const

export function nonChatModelHaystackMatches(haystack: string): boolean {
  const normalized = haystack.trim().toLowerCase()
  if (!normalized)
    return false
  return NON_CHAT_MODEL_ID_MARKERS.some(marker => normalized.includes(marker))
}

export function nonChatModelIdMatches(modelId: string): boolean {
  return nonChatModelHaystackMatches(modelId)
}
