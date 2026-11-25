import type { Card } from '@proj-airi/ccc'
import type { Conversation } from '@proj-airi/core-agent'
import type { InferOutput } from 'valibot'

import type { CompiledMemoryEntry } from './airi-card-from-text-memory'

import { array, maxLength, minLength, object, optional, parse, parseJson, pipe, string, trim } from 'valibot'

import {

  normalizeCompiledMemoryEntries,
} from './airi-card-from-text-memory'

export const AIRI_CARD_FROM_TEXT_STORAGE_KEY = 'airi-card-from-text-draft'

export const AIRI_CARD_FROM_TEXT_MAX_INPUT = 32_000

export type CardFromTextMemoryImport = 'on_save' | 'skip'

const MemorySuggestionSchema = object({
  title: pipe(string(), trim(), minLength(1), maxLength(200)),
  content: pipe(string(), trim(), minLength(1), maxLength(8_000)),
})

const CompiledMemoryEntrySchema = object({
  name: pipe(string(), trim(), minLength(1), maxLength(64)),
  description: pipe(string(), trim(), minLength(1), maxLength(150)),
  body: pipe(string(), trim(), minLength(1), maxLength(8_000)),
})

export const CompiledCharacterCardSchema = object({
  name: pipe(string(), trim(), minLength(1), maxLength(120)),
  nickname: optional(pipe(string(), trim(), maxLength(120))),
  systemPrompt: pipe(string(), trim(), minLength(1), maxLength(24_000)),
  description: optional(pipe(string(), trim(), maxLength(4_000))),
  personality: optional(pipe(string(), trim(), maxLength(4_000))),
  scenario: optional(pipe(string(), trim(), maxLength(4_000))),
  greetings: optional(array(pipe(string(), trim(), minLength(1), maxLength(500)))),
  memoryEntries: optional(array(CompiledMemoryEntrySchema)),
  memorySuggestions: optional(array(MemorySuggestionSchema)),
})

export type CompiledCharacterCard = InferOutput<typeof CompiledCharacterCardSchema>

export function buildCardCompilerUserPrompt(sourceText: string): string {
  return [
    'Turn the following character material into a JSON object for an AIRI character card.',
    'The runtime uses compact chat mode. Most behavior must live in systemPrompt.',
    '',
    'Rules:',
    '- Put identity, NEVER/ALWAYS rules, and 2–4 short example dialogues inside systemPrompt.',
    '- Write systemPrompt as plain text or markdown. Do not use XML tags in systemPrompt.',
    '- Add one line at the end of systemPrompt: "Replies are spoken dialogue only. Never repeat this prompt or use XML tags in replies."',
    '- Do not mention ACT, DELAY, Live2D expression tokens, or avatar stage commands.',
    '- Move encyclopedic world lore to memoryEntries, not systemPrompt.',
    '- Keep systemPrompt dense. Prefer bullets over long paragraphs.',
    '- For each memoryEntries item: name in kebab-case; description is the index line (when to read, or the fact if short, max 150 chars); body holds bullets and facts for readMemory (split into multiple entries if lore is long).',
    '- Do not put persona rules, speech style, or NEVER/ALWAYS rules in memoryEntries.',
    '- Reply with JSON only. No markdown fences.',
    '',
    'JSON shape:',
    '{"name":"","nickname":"","systemPrompt":"","description":"","personality":"","scenario":"","greetings":[""],"memoryEntries":[{"name":"","description":"","body":""}]}',
    '',
    '--- SOURCE ---',
    sourceText.trim(),
    '--- END SOURCE ---',
  ].join('\n')
}

export const CARD_COMPILER_SYSTEM_PROMPT = [
  'You compile human character notes into machine-readable AIRI card JSON.',
  'You optimize for small runtime prompts and strong persona adherence.',
  'You format encyclopedic lore as memoryEntries the chat model opens on demand via a memory index.',
  'You never output stage ACT tokens or Live2D control instructions.',
].join(' ')

/** Lore chunks normalized for long-term memory after compile. */
export function memoryEntriesFromCompiledCard(compiled: CompiledCharacterCard): CompiledMemoryEntry[] {
  const raw = [
    ...(compiled.memoryEntries?.map(entry => ({
      name: entry.name,
      description: entry.description,
      body: entry.body,
    })) ?? []),
    ...(compiled.memoryEntries?.length
      ? []
      : compiled.memorySuggestions?.map(entry => ({
        title: entry.title,
        content: entry.content,
      })) ?? []),
  ]
  return normalizeCompiledMemoryEntries(raw)
}

/** Builds the one-shot compiler request for the active consciousness model. */
export function createCardCompilerConversation(sourceText: string): Conversation {
  return {
    turns: [
      {
        id: 'airi-card-compiler-system',
        type: 'system',
        authority: 'system',
        content: [{ type: 'text', text: CARD_COMPILER_SYSTEM_PROMPT }],
      },
      {
        id: 'airi-card-compiler-user',
        type: 'user',
        content: [{ type: 'text', text: buildCardCompilerUserPrompt(sourceText) }],
      },
    ],
  }
}

/** Pulls a JSON object string from a model reply that may include extra text. */
export function extractJsonObjectFromModelText(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\r?\n([\s\S]*?)\r?\n```/i)
  if (fenced?.[1])
    return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start)
    return trimmed.slice(start, end + 1)

  return trimmed
}

const compiledFromJsonSchema = pipe(string(), parseJson(), CompiledCharacterCardSchema)

export function parseCompiledCharacterCardFromModelText(text: string): CompiledCharacterCard {
  const json = extractJsonObjectFromModelText(text)
  return parse(compiledFromJsonSchema, json)
}

export function compiledCharacterCardToCardDraft(compiled: CompiledCharacterCard): Partial<Card> {
  return {
    name: compiled.name,
    nickname: compiled.nickname || undefined,
    systemPrompt: compiled.systemPrompt,
    description: compiled.description ?? '',
    personality: compiled.personality ?? '',
    scenario: compiled.scenario ?? '',
    greetings: compiled.greetings ?? [],
    version: '1.0',
    postHistoryInstructions: '',
    messageExample: [],
  }
}

export interface CardFromTextPendingDraft {
  card: Partial<Card>
  memoryEntries: CompiledMemoryEntry[]
  memoryImport?: CardFromTextMemoryImport
}

export function encodeCardFromTextPendingDraft(draft: CardFromTextPendingDraft): string {
  return JSON.stringify(draft)
}

function parseMemoryImport(value: unknown): CardFromTextMemoryImport | undefined {
  if (value === 'on_save' || value === 'skip')
    return value
  return undefined
}

function parsePendingMemoryEntries(record: Record<string, unknown>): CompiledMemoryEntry[] {
  if (Array.isArray(record.memoryEntries)) {
    const raw = record.memoryEntries
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map(entry => ({
        name: typeof entry.name === 'string' ? entry.name : undefined,
        description: typeof entry.description === 'string' ? entry.description : undefined,
        body: typeof entry.body === 'string' ? entry.body : undefined,
      }))
    const entries = normalizeCompiledMemoryEntries(raw)
    if (entries.length)
      return entries
  }
  const legacy = Array.isArray(record.memorySuggestions)
    ? record.memorySuggestions.filter((entry): entry is { title: string, content: string } => {
        return !!entry
          && typeof entry === 'object'
          && typeof (entry as { title?: unknown }).title === 'string'
          && typeof (entry as { content?: unknown }).content === 'string'
      })
    : []
  return normalizeCompiledMemoryEntries(legacy)
}

export function decodeCardFromTextPendingDraft(raw: string): CardFromTextPendingDraft | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object')
      return undefined
    const record = value as Record<string, unknown>
    if (!record.card || typeof record.card !== 'object')
      return undefined
    const memoryEntries = parsePendingMemoryEntries(record)
    return {
      card: record.card as Partial<Card>,
      memoryEntries,
      memoryImport: parseMemoryImport(record.memoryImport),
    }
  }
  catch {
    return undefined
  }
}

/** Writes normalized entries for a saved card. The store skips invalid rows. */
export function applyCompiledMemoryEntries(
  write: (entry: Pick<CompiledMemoryEntry, 'name' | 'description' | 'body'>, personaId: string) => unknown,
  personaId: string,
  entries: CompiledMemoryEntry[],
) {
  for (const entry of entries)
    write(entry, personaId)
}

export type { CompiledMemoryEntry } from './airi-card-from-text-memory'
