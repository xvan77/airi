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
export function resolvePricingTierFromEvidence(evidence: PricingTierEvidence): ProviderPricing | null {
  if (evidence.freePath === 'none')
    return 'paid'
  if (evidence.freePath === 'quota')
    return 'limited'
  if (evidence.freePath === 'unmetered' && !evidence.paidPath)
    return 'free'
  if (evidence.freePath === 'unmetered' && evidence.paidPath)
    return 'limited'
  return null
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

export function tierFromListingRates(units: ReadonlyArray<unknown> | undefined): ProviderPricing | null {
  if (!units?.length)
    return null

  const paid = units.some((unit) => {
    if (unit && typeof unit === 'object' && 'rate' in unit) {
      const rate = (unit as { rate?: unknown }).rate
      if (typeof rate === 'number')
        return rate > 0
    }
    return true
  })
  if (paid)
    return 'paid'

  return resolvePricingTierFromEvidence({ freePath: 'unmetered', paidPath: false })
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
  const { modelId, providerId, providerDefault, listingRateUnits, tierTables } = input

  if (modelId.includes(':free'))
    return 'free'

  const fromPage = tierFromTables(tierTables, providerId, modelId)
  if (fromPage !== undefined)
    return fromPage

  const fromListing = tierFromListingRates(listingRateUnits)
  if (fromListing !== null)
    return fromListing

  return providerDefault ?? 'paid'
}
