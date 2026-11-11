import type { PricingSourceStorage } from './pricing-source'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseGooglePricingPage } from './pricing-page-google'
import {
  currentPricingTierTables,
  ensurePricingSourcesFresh,
  listPricingPageSources,
  tierFromTables,
} from './pricing-source'

function memoryStorage(): PricingSourceStorage {
  const items = new Map<string, string>()
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

const htmlPage = `
<h2>Gemini 3.8 Flash</h2>
<p><code>gemini-3.8-flash</code></p>
<table>
  <tr><td>Input price</td><td>Free of charge</td><td>$0.75</td></tr>
</table>
<h2>Gemini 4 Argon</h2>
<p><code>gemini-4-argon</code></p>
<table>
  <tr><td>Input price</td><td>Not available</td><td>$2.00</td></tr>
</table>
<h2>Gemma 4</h2>
<table>
  <tr><td>Input price</td><td>Free of charge</td><td>Not available</td></tr>
</table>
`

function googleSnapshot() {
  const source = listPricingPageSources().find(entry => entry.providerId === 'google-generative-ai')
  if (!source)
    throw new Error('Google pricing page source is not registered.')
  return source.snapshot
}

describe('pricing page tiers', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await ensurePricingSourcesFresh({
      now: Date.parse('2026-11-08T00:00:00.000Z'),
      fetchText: async () => null,
      storage: memoryStorage(),
    })
  })

  it('reads free, limited, and paid cells from bullet pricing rows', () => {
    const page = `
## Gemini 4 Argon {% id="gemini-4-argon" %}
*[\`gemini-4-argon\`](/docs/models/gemini-4-argon)*
* Input price
* Not available
* $2.00
## Gemini 3.8 Flash {% id="gemini-3.8-flash" %}
*[\`gemini-3.8-flash\`](/docs/models/gemini-3.8-flash)*
* Input price
* Free of charge
* $0.75
## [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4) {% id="gemma-4" %}
* Input price
* Free of charge
* Not available
`
    const table = parseGooglePricingPage(page, '2026-11-07T00:00:00.000Z')
    expect(table?.tiers?.['gemini-4-argon']).toBe('paid')
    expect(table?.tiers?.['gemini-3.8-flash']).toBe('limited')
    expect(table?.prefixes).toEqual([{ prefix: 'gemma-', tier: 'free' }])
  })

  it('reads free, limited, and paid cells from pricing page html', () => {
    const table = parseGooglePricingPage(htmlPage, '2026-11-07T00:00:00.000Z')
    expect(table?.tiers?.['gemini-3.8-flash']).toBe('limited')
    expect(table?.tiers?.['gemini-4-argon']).toBe('paid')
    expect(table?.prefixes).toEqual([{ prefix: 'gemma-', tier: 'free' }])
  })

  it('matches a model id from the saved page, including the models/ prefix', () => {
    const tables = { 'google-generative-ai': googleSnapshot() }
    expect(tierFromTables(tables, 'google-generative-ai', 'models/gemini-3.8-flash')).toBe('limited')
    expect(tierFromTables(tables, 'google-generative-ai', 'gemini-3.8-flash-latest')).toBe('limited')
    expect(tierFromTables(tables, 'google-generative-ai', 'gemini-4-argon')).toBe('paid')
    expect(tierFromTables(tables, 'google-generative-ai', 'gemma-4-31b-it')).toBe('free')
    expect(tierFromTables(tables, 'google-generative-ai', 'gemini-9-experimental')).toBeNull()
    expect(tierFromTables(tables, 'openrouter-ai', 'vendor/model')).toBeUndefined()
  })

  it('reads the pricing page again when the saved result is old', async () => {
    const fetchText = vi.fn(async () => htmlPage)
    const storage = memoryStorage()
    const stale = Date.parse('2026-11-20T00:00:00.000Z')
    await ensurePricingSourcesFresh({ now: stale, fetchText, storage })
    expect(fetchText).toHaveBeenCalledOnce()
    expect(currentPricingTierTables()['google-generative-ai']?.tiers?.['gemini-4-argon']).toBe('paid')
    expect(currentPricingTierTables()['google-generative-ai']?.tiers?.['gemini-3.8-flash']).toBe('limited')

    fetchText.mockClear()
    await ensurePricingSourcesFresh({ now: stale + 60_000, fetchText, storage })
    expect(fetchText).not.toHaveBeenCalled()
  })

  it('keeps the shipped table when the pricing page read fails', async () => {
    const fetchText = vi.fn(async () => null)
    const storage = memoryStorage()
    await ensurePricingSourcesFresh({
      now: Date.parse('2026-12-01T00:00:00.000Z'),
      fetchText,
      storage,
    })
    expect(fetchText).toHaveBeenCalledOnce()
    const saved = storage.getItem('airi/provider-pricing-sources')
    expect(saved).toContain('"table":null')
    expect(googleSnapshot().tiers?.['gemini-3.6-flash']).toBe('limited')
    expect(currentPricingTierTables()['google-generative-ai']?.tiers?.['gemini-3.6-flash']).toBe('limited')

    fetchText.mockClear()
    await ensurePricingSourcesFresh({
      now: Date.parse('2026-12-02T00:00:00.000Z'),
      fetchText,
      storage,
    })
    expect(fetchText).not.toHaveBeenCalled()
  })
})
