import { describe, expect, it } from 'vitest'

import { memoryEntriesFromCompiledCard } from './airi-card-from-text'
import {
  COMPILED_MEMORY_BODY_STORE_MAX,
  memoryEntryGroceryLabel,
  normalizeCompiledMemoryEntries,
} from './airi-card-from-text-memory'

describe('airi-card-from-text-memory', () => {
  it('maps legacy title and content into store-ready entries', () => {
    const entries = normalizeCompiledMemoryEntries([
      { title: 'Neuroverse Lore', content: '- Show name: Neuroverse\n- Studio: Example HQ' },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('neuroverse-lore')
    expect(entries[0]?.description.length).toBeLessThanOrEqual(150)
    expect(entries[0]?.body).toContain('Neuroverse')
  })

  it('splits bodies longer than the store limit', () => {
    const chunk = `${'Fact line.\n'.repeat(400)}`
    const entries = normalizeCompiledMemoryEntries([
      { name: 'world-bible', description: 'Open when the user asks about the world.', body: chunk },
    ])
    expect(entries.length).toBeGreaterThan(1)
    expect(entries.every(entry => entry.body.length <= COMPILED_MEMORY_BODY_STORE_MAX)).toBe(true)
    expect(entries[0]?.name).toBe('world-bible')
    expect(entries[1]?.name).toBe('world-bible-2')
  })

  it('builds a short grocery label from the entry name', () => {
    expect(memoryEntryGroceryLabel({ name: 'neuroverse-core', description: '', body: '' })).toBe('Neuroverse Core')
  })

  it('prefers memoryEntries over legacy suggestions', () => {
    const entries = memoryEntriesFromCompiledCard({
      name: 'A',
      systemPrompt: 'Hi',
      memoryEntries: [{ name: 'cast', description: 'Names of main cast.', body: 'Alice and Bob.' }],
      memorySuggestions: [{ title: 'Ignored', content: 'Nope' }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('cast')
  })
})
