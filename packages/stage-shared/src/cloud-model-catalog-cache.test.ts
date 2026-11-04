import { describe, expect, it } from 'vitest'

import {
  CLOUD_MODEL_CATALOG_CACHE_TTL_MS,
  createCloudModelCatalogCacheDocument,
  isCloudModelCatalogCacheStale,
  parseCloudModelCatalogCacheDocument,
  serializeCloudModelCatalogCacheDocument,
} from './cloud-model-catalog-cache'

describe('cloud-model-catalog-cache', () => {
  it('round-trips a cache document through JSON', () => {
    const document = createCloudModelCatalogCacheDocument({
      providerId: 'openrouter-ai',
      configurationFingerprint: 'abc123',
      defaultModel: 'openai/gpt-4.1',
      models: [{
        id: 'openai/gpt-4.1',
        name: 'GPT-4.1',
        provider: 'openrouter-ai',
        description: 'Preview text...',
        contextLength: 128_000,
        metadata: {
          pricing: {
            units: [{
              name: 'textInput',
              rate: 2,
              strategy: 'fixed',
              unit: 'millionTokens',
            }],
          },
        },
      }],
      fetchedAt: 1_700_000_000_000,
    })

    const raw = serializeCloudModelCatalogCacheDocument(document)
    const parsed = parseCloudModelCatalogCacheDocument(raw)

    expect(parsed).toEqual(document)
  })

  it('marks snapshots older than the TTL as stale', () => {
    const now = 1_700_000_000_000
    expect(isCloudModelCatalogCacheStale(now - CLOUD_MODEL_CATALOG_CACHE_TTL_MS - 1, CLOUD_MODEL_CATALOG_CACHE_TTL_MS, now)).toBe(true)
    expect(isCloudModelCatalogCacheStale(now - 1_000, CLOUD_MODEL_CATALOG_CACHE_TTL_MS, now)).toBe(false)
  })

  it('rejects invalid cache JSON', () => {
    expect(parseCloudModelCatalogCacheDocument('not json')).toBeNull()
    expect(parseCloudModelCatalogCacheDocument('{"version":99}')).toBeNull()
  })
})
