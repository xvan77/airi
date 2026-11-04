import { describe, expect, it } from 'vitest'

import { isTruncatedCatalogDescription, pickBestCatalogDescription } from './catalog-description'

describe('catalog-description', () => {
  it('detects OpenRouter-style truncated previews', () => {
    expect(isTruncatedCatalogDescription('Short preview...')).toBe(true)
    expect(isTruncatedCatalogDescription('Complete sentence.')).toBe(false)
  })

  it('prefers model-bank prose over a longer truncated preview', () => {
    const api = `${'A'.repeat(180)}...`
    const bank = 'Full model-bank description with real details.'
    expect(pickBestCatalogDescription(api, bank)).toBe(bank)
  })
})
