import { useLocalStorage } from '@vueuse/core'

export const CHAT_MODEL_RECENTS_STORAGE_KEY = 'airi:chat-model-recents'
export const SPEECH_MODEL_RECENTS_STORAGE_KEY = 'airi:speech-model-recents'
export const POPOVER_MODEL_RECENTS_MAX = 8

export interface ChatModelRecentEntry {
  provider: string
  model: string
  usedAt: number
}

export interface SpeechModelRecentEntry {
  provider: string
  model: string
  voiceId: string
  usedAt: number
}

function readStorageJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw)
      return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  }
  catch {
    return []
  }
}

export function pushChatModelRecent(
  entries: readonly ChatModelRecentEntry[],
  provider: string,
  model: string,
): ChatModelRecentEntry[] {
  if (!provider || !model)
    return [...entries]

  const filtered = entries.filter(entry => entry.provider !== provider || entry.model !== model)
  return [
    { provider, model, usedAt: Date.now() },
    ...filtered,
  ].slice(0, POPOVER_MODEL_RECENTS_MAX)
}

export function pushSpeechModelRecent(
  entries: readonly SpeechModelRecentEntry[],
  provider: string,
  model: string,
  voiceId: string,
): SpeechModelRecentEntry[] {
  if (!provider || !voiceId)
    return [...entries]

  const filtered = entries.filter(entry =>
    entry.provider !== provider || entry.model !== model || entry.voiceId !== voiceId,
  )
  return [
    { provider, model: model || '', voiceId, usedAt: Date.now() },
    ...filtered,
  ].slice(0, POPOVER_MODEL_RECENTS_MAX)
}

export function recordChatModelRecent(provider: string, model: string) {
  const next = pushChatModelRecent(readStorageJson<ChatModelRecentEntry>(CHAT_MODEL_RECENTS_STORAGE_KEY), provider, model)
  localStorage.setItem(CHAT_MODEL_RECENTS_STORAGE_KEY, JSON.stringify(next))
}

export function recordSpeechModelRecent(provider: string, model: string, voiceId: string) {
  const next = pushSpeechModelRecent(
    readStorageJson<SpeechModelRecentEntry>(SPEECH_MODEL_RECENTS_STORAGE_KEY),
    provider,
    model,
    voiceId,
  )
  localStorage.setItem(SPEECH_MODEL_RECENTS_STORAGE_KEY, JSON.stringify(next))
}

export function useChatModelRecents() {
  return useLocalStorage<ChatModelRecentEntry[]>(CHAT_MODEL_RECENTS_STORAGE_KEY, [])
}

export function useSpeechModelRecents() {
  return useLocalStorage<SpeechModelRecentEntry[]>(SPEECH_MODEL_RECENTS_STORAGE_KEY, [])
}

export function chatModelSelectionKey(provider: string, model: string) {
  return `${provider}:${model}`
}

export function speechModelSelectionKey(provider: string, model: string, voiceId: string) {
  return `${provider}:${model}:${voiceId}`
}
