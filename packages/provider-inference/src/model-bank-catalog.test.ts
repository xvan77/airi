import { describe, expect, it } from 'vitest'

import { enrichModelsForProvider, fallbackCatalogModelDescription } from './model-bank-catalog'

describe('enrichModelsForProvider', () => {
  it('keeps model-bank prose for known ids', () => {
    const [model] = enrichModelsForProvider('xai', [{
      id: 'grok-4.5',
      name: 'Grok 4.5',
      provider: 'xai',
      description: '',
      contextLength: 0,
    }])
    expect(model.description?.length).toBeGreaterThan(40)
    expect(model.description).not.toContain('Chat model from this provider.')
  })

  it('fills a short blurb when the bank has no row yet', () => {
    const [model] = enrichModelsForProvider('xai', [{
      id: 'grok-4.6',
      name: 'grok-4.6',
      provider: 'xai',
      description: '',
      contextLength: 500_000,
    }])
    expect(model.description).toBe(fallbackCatalogModelDescription({
      id: 'grok-4.6',
      name: 'grok-4.6',
      provider: 'xai',
      contextLength: 500_000,
    }))
    expect(model.description).toContain('500K tokens')
  })
})
