import type { ProviderDeployment, ProviderPricing } from '../providers/attributes'
import type { ModelInfo } from '../providers/types'

export type ModelCatalogPricingFilter = 'all' | ProviderPricing
export type ModelCatalogDeploymentFilter = 'all' | ProviderDeployment

/** Secondary sort when the default free/local hierarchy is not selected. */
export type ModelCatalogSortKey = 'default' | 'params' | 'context' | 'disk' | 'quant' | 'price'

export type ModelCatalogSortDirection = 'asc' | 'desc'

export interface ModelCatalogFilters {
  pricing: ModelCatalogPricingFilter
  deployment: ModelCatalogDeploymentFilter
}

export interface ModelCatalogBadge {
  /** Short visible label, for example `7B` or `128K`. */
  label: string
  /** Full meaning for hover and screen readers. */
  title: string
}

export interface ModelCatalogRow {
  model: ModelInfo
  pricing: ProviderPricing
  deployment: ProviderDeployment
  parameterBillions: number | null
  contextTokens: number | null
  quantization: string | null
  /** Numeric rank for quant sort when a label exists. */
  quantRank: number | null
  diskSizeBytes: number | null
  /** Includes cloud models as zero for disk sort. */
  diskSortValue: number | null
  promptPricePerMillion: number | null
  badges: ModelCatalogBadge[]
}

export interface ModelCatalogContext {
  providerId: string
  /** Filename or catalog id → download size in bytes when known. */
  diskSizeByModelId?: Readonly<Record<string, number>>
}
