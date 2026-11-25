import { memoryName } from '../stores/memory'

/** Matches long-term memory store limits and tool schemas. */
export const COMPILED_MEMORY_DESCRIPTION_MAX = 150
export const COMPILED_MEMORY_BODY_STORE_MAX = 2000

export interface CompiledMemoryEntry {
  name: string
  description: string
  body: string
}

/** Raw compiler output for one lore chunk before normalization. */
export interface RawCompiledMemoryEntry {
  name?: string
  description?: string
  body?: string
  title?: string
  content?: string
}

function trimToMax(text: string, max: number) {
  const trimmed = text.trim()
  if (trimmed.length <= max)
    return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function firstSentenceOrLine(text: string) {
  const line = text.split(/\r?\n/).find(part => part.trim())?.trim() ?? text.trim()
  const sentence = line.match(/^[^.!?]+[.!?]?/)?.[0]?.trim()
  return sentence && sentence.length >= 8 ? sentence : line
}

function indexDescriptionFromBody(title: string, body: string, description?: string) {
  const direct = description?.trim()
  if (direct)
    return trimToMax(direct, COMPILED_MEMORY_DESCRIPTION_MAX)
  const summary = firstSentenceOrLine(body)
  if (summary.length <= COMPILED_MEMORY_DESCRIPTION_MAX)
    return summary
  const topic = title.trim() || 'this topic'
  return trimToMax(`Open when the user asks about ${topic}.`, COMPILED_MEMORY_DESCRIPTION_MAX)
}

function formatBodyForMemory(body: string) {
  return body.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}

function splitBodyForStore(name: string, description: string, body: string): CompiledMemoryEntry[] {
  const formatted = formatBodyForMemory(body)
  if (formatted.length <= COMPILED_MEMORY_BODY_STORE_MAX)
    return [{ name: memoryName(name), description, body: formatted }]

  const parts: string[] = []
  let rest = formatted
  while (rest.length > COMPILED_MEMORY_BODY_STORE_MAX) {
    let cut = rest.lastIndexOf('\n\n', COMPILED_MEMORY_BODY_STORE_MAX)
    if (cut < COMPILED_MEMORY_BODY_STORE_MAX * 0.4)
      cut = COMPILED_MEMORY_BODY_STORE_MAX
    const chunk = rest.slice(0, cut).trimEnd()
    if (!chunk)
      break
    parts.push(chunk)
    rest = rest.slice(cut).trimStart()
  }
  if (rest)
    parts.push(rest)

  const base = memoryName(name) || 'lore'
  return parts.map((part, index) => ({
    name: index === 0 ? base : `${base}-${index + 1}`.slice(0, 64),
    description: index === 0
      ? description
      : trimToMax(`${description} (part ${index + 1})`, COMPILED_MEMORY_DESCRIPTION_MAX),
    body: part,
  }))
}

function normalizeRawEntry(raw: RawCompiledMemoryEntry): CompiledMemoryEntry[] {
  const bodySource = raw.body?.trim() || raw.content?.trim() || ''
  if (!bodySource)
    return []
  const titleSource = raw.name?.trim() || raw.title?.trim() || bodySource.slice(0, 40)
  const name = memoryName(titleSource) || 'lore'
  const description = indexDescriptionFromBody(titleSource, bodySource, raw.description)
  return splitBodyForStore(name, description, bodySource)
}

/** Short label for consent UI. This is a topic title, not the stored entry text. */
export function memoryEntryGroceryLabel(entry: CompiledMemoryEntry) {
  return entry.name
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

/** Turns compiler lore output into store-ready memory entries. */
export function normalizeCompiledMemoryEntries(rawEntries: RawCompiledMemoryEntry[]): CompiledMemoryEntry[] {
  const seen = new Set<string>()
  const result: CompiledMemoryEntry[] = []
  for (const raw of rawEntries) {
    for (const entry of normalizeRawEntry(raw)) {
      if (!entry.body || seen.has(entry.name))
        continue
      seen.add(entry.name)
      result.push(entry)
    }
  }
  return result
}
