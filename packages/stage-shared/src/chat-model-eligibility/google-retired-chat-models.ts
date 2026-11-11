/** Gemini chat models that Google rejects for new API users (NOT_FOUND). */
const GOOGLE_CHAT_MODELS_RETIRED_FOR_NEW_USERS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
])

export function isGoogleChatModelRetiredForNewUsers(modelId: string): boolean {
  const bare = modelId.replace(/^models\//, '')
  return GOOGLE_CHAT_MODELS_RETIRED_FOR_NEW_USERS.has(bare)
}

function bareGoogleModelId(modelId: string): string {
  return modelId.replace(/^models\//, '').toLowerCase()
}

/**
 * Google lists models that cannot use the OpenAI-compatible chat route AIRI uses for Consciousness.
 * Live, native audio, embeddings, and similar endpoints need other APIs.
 */
export function isGoogleConsciousnessIncompatibleModel(modelId: string): boolean {
  if (isGoogleChatModelRetiredForNewUsers(modelId))
    return true

  const bare = bareGoogleModelId(modelId)
  if (bare.includes('native-audio'))
    return true
  if (bare.includes('embedding'))
    return true
  if (bare.includes('transcribe'))
    return true
  if (bare.includes('robotics'))
    return true
  if (/-live(?:-|$)/u.test(bare) || bare.endsWith('-live'))
    return true

  return false
}
