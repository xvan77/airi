import type { ProviderPricing } from '../providers/attributes'
import type { ProviderTierTable } from './pricing-source'

import { tierFromTables } from './pricing-source'

/** How the provider exposes $0 use for a model. */
export type PricingFreePath = 'none' | 'quota' | 'unmetered'

/**
 * Facts every provider adapter must supply before the catalog picks a chip.
 * Adapters can read a pricing page, API metadata, or a curated table.
 */
export interface PricingTierEvidence {
  freePath: PricingFreePath
  /** True when the same model has metered pricing on a paid plan or tier. */
  paidPath: boolean
}

/**
 * Maps provider evidence to Consciousness pricing chips.
 * Returns null when the evidence is incomplete.
 */
export function resolvePricingTiersFromEvidence(evidence: PricingTierEvidence): readonly ProviderPricing[] {
  if (evidence.freePath === 'none')
    return ['paid']

  const tiers: ProviderPricing[] = []
  if (evidence.freePath === 'quota')
    tiers.push('limited')
  if (evidence.freePath === 'unmetered')
    tiers.push('free')
  if (evidence.paidPath)
    tiers.push('paid')
  return tiers.length > 0 ? tiers : ['paid']
}

export function resolvePricingTierFromEvidence(evidence: PricingTierEvidence): ProviderPricing | null {
  const tiers = resolvePricingTiersFromEvidence(evidence)
  if (tiers.length === 0)
    return null
  return tiers.reduce((best, tier) => pricingRankForSort(best) <= pricingRankForSort(tier) ? best : tier)
}

/**
 * Reads Free, Limited, and Paid from Gemini-style free and paid table cells.
 */
export function tierFromGeminiPriceCells(freeCell: string, paidCell: string): ProviderPricing | null {
  const freeText = freeCell.toLowerCase()
  const paidText = paidCell.toLowerCase()
  if (freeText.includes('not available'))
    return resolvePricingTierFromEvidence({ freePath: 'none', paidPath: true })
  if (!freeText.includes('free of charge'))
    return null
  if (paidText.includes('not available') && !paidText.includes('$'))
    return resolvePricingTierFromEvidence({ freePath: 'unmetered', paidPath: false })
  return resolvePricingTierFromEvidence({ freePath: 'quota', paidPath: true })
}

export function tierFromExplicitCatalogLabel(label: ProviderPricing): ProviderPricing {
  if (label === 'paid')
    return resolvePricingTierFromEvidence({ freePath: 'none', paidPath: true }) ?? 'paid'
  if (label === 'limited')
    return resolvePricingTierFromEvidence({ freePath: 'quota', paidPath: true }) ?? 'limited'
  return resolvePricingTierFromEvidence({ freePath: 'unmetered', paidPath: false }) ?? 'free'
}

function unitRateIsZero(unit: unknown): boolean {
  if (unit && typeof unit === 'object' && 'rate' in unit) {
    const rate = (unit as { rate?: unknown }).rate
    return typeof rate === 'number' && rate <= 0
  }
  return false
}

export function tiersFromListingRates(units: ReadonlyArray<unknown> | undefined): readonly ProviderPricing[] {
  if (!units?.length)
    return []

  const hasPositiveRate = units.some((unit) => {
    if (unit && typeof unit === 'object' && 'rate' in unit) {
      const rate = (unit as { rate?: unknown }).rate
      if (typeof rate === 'number')
        return rate > 0
    }
    return true
  })
  const hasZeroRate = units.some(unit => unitRateIsZero(unit))

  if (hasPositiveRate && hasZeroRate)
    return resolvePricingTiersFromEvidence({ freePath: 'unmetered', paidPath: true })
  if (hasPositiveRate)
    return ['paid']

  return resolvePricingTiersFromEvidence({ freePath: 'unmetered', paidPath: false })
}

export function tierFromListingRates(units: ReadonlyArray<unknown> | undefined): ProviderPricing | null {
  const tiers = tiersFromListingRates(units)
  if (tiers.length === 0)
    return null
  return tiers.reduce((best, tier) => pricingRankForSort(best) <= pricingRankForSort(tier) ? best : tier)
}

export interface ResolveModelPricingTierInput {
  modelId: string
  providerId: string
  providerDefault?: ProviderPricing
  listingRateUnits?: ReadonlyArray<unknown>
  tierTables?: Readonly<Record<string, ProviderTierTable>>
}

/**
 * Single catalog path for free, limited, paid, and unknown tiers.
 */
export function resolveModelPricingTier(input: ResolveModelPricingTierInput): ProviderPricing | null {
  const tiers = resolveModelPricingTiers(input)
  if (tiers.length === 0)
    return null
  return tiers.reduce((best, tier) => pricingRankForSort(best) <= pricingRankForSort(tier) ? best : tier)
}

/**
 * Every pricing label that applies to a model for catalog filters and chips.
 */
export function expandCatalogPricingTiers(primary: ProviderPricing | null): readonly ProviderPricing[] {
  if (primary === null)
    return []
  if (primary === 'limited')
    return resolvePricingTiersFromEvidence({ freePath: 'quota', paidPath: true })
  if (primary === 'free')
    return ['free']
  if (primary === 'paid')
    return ['paid']
  return [primary]
}

export function resolveModelPricingTiers(input: ResolveModelPricingTierInput): readonly ProviderPricing[] {
  const { modelId, providerId, providerDefault, listingRateUnits, tierTables } = input

  if (modelId.includes(':free'))
    return ['free']

  const fromPage = tierFromTables(tierTables, providerId, modelId)
  if (fromPage !== undefined)
    return expandCatalogPricingTiers(fromPage)

  const fromListing = tiersFromListingRates(listingRateUnits)
  if (fromListing.length > 0)
    return fromListing

  return expandCatalogPricingTiers(providerDefault ?? 'paid')
}

function pricingRankForSort(tier: ProviderPricing): number {
  if (tier === 'free')
    return 0
  if (tier === 'limited')
    return 1
  return 2
}
