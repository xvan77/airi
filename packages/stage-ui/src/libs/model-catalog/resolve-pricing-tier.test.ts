import { describe, expect, it } from 'vitest'

import { listPricingPageSources } from './pricing-source'
import {
  resolveModelPricingTier,
  resolvePricingTierFromEvidence,
  tierFromGeminiPriceCells,
  tierFromListingRates,
} from './resolve-pricing-tier'

import './pricing-page-google'

function googleTables() {
  const source = listPricingPageSources().find(entry => entry.providerId === 'google-generative-ai')
  if (!source)
    throw new Error('Google pricing page source is not registered.')
  return { [source.providerId]: source.snapshot }
}

describe('resolvePricingTierFromEvidence', () => {
  it('maps none to paid', () => {
    expect(resolvePricingTierFromEvidence({ freePath: 'none', paidPath: true })).toBe('paid')
  })

  it('maps quota to limited', () => {
    expect(resolvePricingTierFromEvidence({ freePath: 'quota', paidPath: true })).toBe('limited')
  })

  it('maps unmetered without paid path to free', () => {
    expect(resolvePricingTierFromEvidence({ freePath: 'unmetered', paidPath: false })).toBe('free')
  })

  it('maps unmetered with paid path to limited', () => {
    expect(resolvePricingTierFromEvidence({ freePath: 'unmetered', paidPath: true })).toBe('limited')
  })
})

describe('tierFromGeminiPriceCells', () => {
  it('matches Gemini pricing page cells', () => {
    expect(tierFromGeminiPriceCells('Not available', '$2.00')).toBe('paid')
    expect(tierFromGeminiPriceCells('Free of charge', '$0.75')).toBe('limited')
    expect(tierFromGeminiPriceCells('Free of charge', 'Not available')).toBe('free')
    expect(tierFromGeminiPriceCells('Contact sales', '$1.00')).toBeNull()
  })
})

describe('tierFromListingRates', () => {
  it('treats positive rates as paid', () => {
    expect(tierFromListingRates([{ rate: 0.5 }])).toBe('paid')
  })

  it('treats all-zero rates as free when no paid path is listed', () => {
    expect(tierFromListingRates([{ rate: 0 }, { rate: 0 }])).toBe('free')
  })
})

describe('resolveModelPricingTier', () => {
  it('runs the catalog pipeline in order', () => {
    const tables = googleTables()

    expect(resolveModelPricingTier({
      modelId: 'openai/gpt-4.1:free',
      providerId: 'openrouter-ai',
    })).toBe('free')

    expect(resolveModelPricingTier({
      modelId: 'models/gemini-3.8-flash',
      providerId: 'google-generative-ai',
      tierTables: tables,
    })).toBe('limited')

    expect(resolveModelPricingTier({
      modelId: 'meta-llama/test',
      providerId: 'openrouter-ai',
      listingRateUnits: [{ rate: 0.2 }],
    })).toBe('paid')

    expect(resolveModelPricingTier({
      modelId: 'unknown-vendor/model',
      providerId: 'anthropic',
      providerDefault: undefined,
    })).toBe('paid')

    expect(resolveModelPricingTier({
      modelId: 'gemini-9-experimental',
      providerId: 'google-generative-ai',
      tierTables: tables,
    })).toBeNull()
  })
})
