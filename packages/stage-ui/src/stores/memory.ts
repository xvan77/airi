import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

/** One remembered fact. A character keeps it on its own card. Shared storage reaches every card. */
export interface MemoryEntry {
  /** Short name in kebab case, unique within its scope. The index lists it, and tools address the entry by it. */
  name: string
  /** The index line: the fact itself when it fits in one line, or when the entry matters. */
  description: string
  body: string
  /** The character card that owns this memory. Without it, the entry lives in shared storage. */
  persona?: string
  updatedAt: number
}

/** Turns a free name into the kebab-case key that entries use. */
export function memoryName(name: string) {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

/**
 * Long-term memory as a small index and one entry per fact, kept by the character itself.
 *
 * Use when:
 * - A run reads the index or an entry, writes or forgets a fact, or Settings lists the memories by card.
 *
 * Expects:
 * - Callers pass the character card of the run. It reads its own memories and shared storage.
 * - Only the owner moves a memory to shared storage, in Settings. A run writes and forgets only its own card's memories.
 *
 * Returns:
 * - Whether memory is on, entries, the index for a card, and actions that change entries.
 */
export const useMemoryStore = defineStore('memory', () => {
  const enabled = useLocalStorageManualReset<boolean>('memory/enabled', true)
  const entries = useLocalStorageManualReset<MemoryEntry[]>('memory/entries', [])

  const sorted = computed(() => [...entries.value].sort((left, right) => left.name.localeCompare(right.name)))

  /** Shared storage and the persona's own memories. */
  function visibleTo(personaId: string) {
    return sorted.value.filter(entry => !entry.persona || entry.persona === personaId)
  }

  /** The index for a card: its own memories, then shared storage, each as a name and its description. */
  function indexFor(personaId: string) {
    const line = (entry: MemoryEntry) => `- ${entry.name}: ${entry.description}`
    const byName = (left: MemoryEntry, right: MemoryEntry) => left.name.localeCompare(right.name)
    const own = sorted.value.filter(entry => entry.persona === personaId).sort(byName).map(line)
    const shared = sorted.value.filter(entry => !entry.persona).sort(byName).map(line)
    return [
      ...(own.length ? [`Your own:\n${own.join('\n')}`] : []),
      ...(shared.length ? [`Shared storage:\n${shared.join('\n')}`] : []),
    ].join('\n')
  }

  /** Reads an entry by name. The persona's own entry wins over a shared one with the same name. */
  function read(name: string, personaId: string) {
    const key = memoryName(name)
    const matches = visibleTo(personaId).filter(entry => entry.name === key)
    return matches.find(entry => entry.persona === personaId) ?? matches[0]
  }

  /** Creates or replaces an entry of the card by name. Returns the stored entry, or undefined for an empty name or body. */
  function write(entry: Pick<MemoryEntry, 'name' | 'description' | 'body'>, personaId: string) {
    const name = memoryName(entry.name)
    if (!name || !entry.body.trim())
      return undefined
    const next: MemoryEntry = { name, description: entry.description.trim(), body: entry.body.trim(), persona: personaId, updatedAt: Date.now() }
    entries.value = [...entries.value.filter(existing => existing.name !== name || existing.persona !== personaId), next]
    return next
  }

  /** Moves a card memory to shared storage, so every card reads it. A shared entry with the same name gives way. */
  function makeGeneral(entry: Pick<MemoryEntry, 'name' | 'persona'>) {
    const source = entries.value.find(existing => existing.name === entry.name && existing.persona === entry.persona)
    if (!source?.persona)
      return
    const { persona: _card, ...general } = source
    entries.value = [...entries.value.filter(existing => existing !== source && (existing.name !== source.name || existing.persona)), { ...general, updatedAt: Date.now() }]
  }

  /** Removes one entry, from a tool or from Settings. */
  function remove(entry: Pick<MemoryEntry, 'name' | 'persona'>) {
    entries.value = entries.value.filter(existing => existing.name !== entry.name || existing.persona !== entry.persona)
  }

  /** Forgets an entry of the card by name. Shared storage belongs to the owner, so a run cannot forget it. */
  function forget(name: string, personaId: string) {
    const key = memoryName(name)
    const target = entries.value.find(entry => entry.name === key && entry.persona === personaId)
    if (!target)
      return false
    remove(target)
    return true
  }

  function countForPersona(personaId: string) {
    return entries.value.filter(entry => entry.persona === personaId).length
  }

  /** Removes every entry owned by one character card. */
  function removeForPersona(personaId: string) {
    const before = entries.value.length
    entries.value = entries.value.filter(entry => entry.persona !== personaId)
    return before - entries.value.length
  }

  /** Removes entries that still point at a card id that no longer exists. */
  function removeUnlinkedFromCards(existingCardIds: Iterable<string>) {
    const known = new Set(existingCardIds)
    const before = entries.value.length
    entries.value = entries.value.filter(entry => !entry.persona || known.has(entry.persona))
    return before - entries.value.length
  }

  function resetState() {
    enabled.reset()
    entries.reset()
  }

  return {
    enabled,
    entries: sorted,
    visibleTo,
    indexFor,
    read,
    write,
    makeGeneral,
    forget,
    remove,
    countForPersona,
    removeForPersona,
    removeUnlinkedFromCards,
    resetState,
  }
})
