import type { ProviderDeployment, ProviderPricing } from '../providers/attributes'
import type { ModelInfo } from '../providers/types'
import type { ProviderTierTable } from './pricing-source'
import type {
  ModelCatalogBadge,
  ModelCatalogContext,
  ModelCatalogFilters,
  ModelCatalogRow,
  ModelCatalogSortDirection,
  ModelCatalogSortKey,
} from './types'

import { resolveProviderAttributes } from '../providers/attributes'
import { isExcludedFromConsciousnessCatalog } from './consciousness-catalog-exclusions'
import {
  formatContextChip,
  formatDiskChip,
  formatParameterChip,
  formatPromptPriceChip,
  parseDiskSizeBytes,
  parseParameterBillionsFromModel,
  parseQuantizationLabel,
  quantSortRank,
  resolvePromptPricePerMillion,
} from './parse'
import { currentPricingTierTables } from './pricing-source'
import { resolveModelPricingTier } from './resolve-pricing-tier'

import './pricing-page-google'
import './pricing-page-groq'

const UNKNOWN_CHIP = '—'

function resolvePricingBucket(
  model: ModelInfo,
  providerPricing: ProviderPricing | undefined,
  providerId: string,
  tables: Readonly<Record<string, ProviderTierTable>> | undefined,
): ProviderPricing | null {
  return resolveModelPricingTier({
    modelId: model.id,
    providerId,
    providerDefault: providerPricing,
    listingRateUnits: model.metadata?.pricing?.units,
    tierTables: tables,
  })
}

function pricingRank(pricing: ProviderPricing | null): number {
  if (pricing === 'free')
    return 0
  if (pricing === 'limited')
    return 1
  if (pricing === 'paid')
    return 2
  return 3
}

function deploymentRank(deployment: ProviderDeployment): number {
  return deployment === 'local' ? 0 : 1
}

function compareNullableNumbers(a: number | null, b: number | null): number {
  if (a == null && b == null)
    return 0
  if (a == null)
    return 1
  if (b == null)
    return -1
  return a - b
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function orientComparison(value: number, direction: ModelCatalogSortDirection): number {
  return direction === 'desc' ? -value : value
}

function compareNullableNumbersOriented(
  a: number | null,
  b: number | null,
  direction: ModelCatalogSortDirection,
): number {
  return orientComparison(compareNullableNumbers(a, b), direction)
}

export function resolveModelDeployment(providerId: string): ProviderDeployment {
  return resolveProviderAttributes({ id: providerId }).deployment ?? 'cloud'
}

export function resolveModelPricing(
  model: ModelInfo,
  providerId: string,
  tables?: Readonly<Record<string, ProviderTierTable>>,
): ProviderPricing | null {
  const providerPricing = resolveProviderAttributes({ id: providerId }).pricing
  return resolvePricingBucket(model, providerPricing, providerId, tables ?? currentPricingTierTables())
}

export function buildModelCatalogRow(model: ModelInfo, context: ModelCatalogContext): ModelCatalogRow {
  const pricing = resolveModelPricing(model, context.providerId, context.tierTables)
  const deployment = resolveModelDeployment(context.providerId)
  const parameterBillions = parseParameterBillionsFromModel(model)
  const contextTokens = model.contextLength ?? null
  const quantization = parseQuantizationLabel(`${model.id} ${model.name}`)
  const quantRank = quantSortRank(quantization)
  const promptPricePerMillion = resolvePromptPricePerMillion(model)
  let diskSizeBytes = context.diskSizeByModelId?.[model.id]
    ?? parseDiskSizeBytes(model.description)
    ?? null

  if (diskSizeBytes == null && deployment === 'cloud')
    diskSizeBytes = 0

  const badges: ModelCatalogBadge[] = [
    parameterBillions != null
      ? {
          label: formatParameterChip(parameterBillions),
          title: `${formatParameterChip(parameterBillions)} parameters`,
        }
      : {
          label: UNKNOWN_CHIP,
          title: 'Parameter count is not listed for this model',
        },
    contextTokens != null
      ? {
          label: formatContextChip(contextTokens),
          title: `${contextTokens} context tokens`,
        }
      : {
          label: UNKNOWN_CHIP,
          title: 'Context length is not listed for this model',
        },
    diskSizeBytes != null && diskSizeBytes > 0
      ? {
          label: formatDiskChip(diskSizeBytes),
          title: `${formatDiskChip(diskSizeBytes)} on disk`,
        }
      : {
          label: UNKNOWN_CHIP,
          title: deployment === 'cloud'
            ? 'Cloud model. No file on this device'
            : 'Download size is not listed for this model',
        },
    quantization != null
      ? {
          label: quantization,
          title: `${quantization} quantization`,
        }
      : {
          label: UNKNOWN_CHIP,
          title: deployment === 'cloud'
            ? 'Quantization is not listed for this cloud model'
            : 'Quantization is not listed for this model',
        },
    promptPricePerMillion != null
      ? {
          label: formatPromptPriceChip(promptPricePerMillion),
          title: `${formatPromptPriceChip(promptPricePerMillion)} prompt input per 1M tokens`,
        }
      : {
          label: UNKNOWN_CHIP,
          title: deployment === 'local'
            ? 'Local model. No API token cost'
            : 'Prompt price is not listed for this model',
        },
  ]

  return {
    model,
    pricing,
    deployment,
    parameterBillions,
    contextTokens,
    quantization,
    quantRank,
    diskSizeBytes: diskSizeBytes != null && diskSizeBytes > 0 ? diskSizeBytes : null,
    diskSortValue: diskSizeBytes ?? null,
    promptPricePerMillion,
    badges,
  }
}

export function prepareModelCatalogRows(models: readonly ModelInfo[], context: ModelCatalogContext): ModelCatalogRow[] {
  const listed = models.filter(model => !isExcludedFromConsciousnessCatalog(model, context.providerId))
  return listed.map(model => buildModelCatalogRow(model, context))
}

export function filterModelCatalogRows(rows: readonly ModelCatalogRow[], filters: ModelCatalogFilters): ModelCatalogRow[] {
  return rows.filter((row) => {
    if (filters.pricing !== 'all' && row.pricing !== filters.pricing)
      return false
    if (filters.deployment !== 'all' && row.deployment !== filters.deployment)
      return false
    return true
  })
}

export function sortModelCatalogRows(
  rows: readonly ModelCatalogRow[],
  sortKey: ModelCatalogSortKey,
  direction: ModelCatalogSortDirection = 'asc',
): ModelCatalogRow[] {
  const next = [...rows]
  next.sort((left, right) => {
    if (sortKey === 'default') {
      const pricingDiff = orientComparison(pricingRank(left.pricing) - pricingRank(right.pricing), direction)
      if (pricingDiff !== 0)
        return pricingDiff

      const deploymentDiff = orientComparison(deploymentRank(left.deployment) - deploymentRank(right.deployment), direction)
      if (deploymentDiff !== 0)
        return deploymentDiff

      const paramsDiff = compareNullableNumbersOriented(left.parameterBillions, right.parameterBillions, direction)
      if (paramsDiff !== 0)
        return paramsDiff

      return orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }

    if (sortKey === 'params') {
      return compareNullableNumbersOriented(left.parameterBillions, right.parameterBillions, direction)
        || orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }
    if (sortKey === 'context') {
      return compareNullableNumbersOriented(left.contextTokens, right.contextTokens, direction)
        || orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }
    if (sortKey === 'disk') {
      return compareNullableNumbersOriented(left.diskSortValue, right.diskSortValue, direction)
        || orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }
    if (sortKey === 'quant') {
      return compareNullableNumbersOriented(left.quantRank, right.quantRank, direction)
        || orientComparison(compareStrings(left.quantization ?? '', right.quantization ?? ''), direction)
        || orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }
    if (sortKey === 'price') {
      return compareNullableNumbersOriented(left.promptPricePerMillion, right.promptPricePerMillion, direction)
        || orientComparison(compareStrings(left.model.name, right.model.name), direction)
    }

    return 0
  })
  return next
}

export function compareProviderCatalogOrder(
  left: { pricing?: ProviderPricing, deployment?: ProviderDeployment, localizedName?: string, name?: string },
  right: { pricing?: ProviderPricing, deployment?: ProviderDeployment, localizedName?: string, name?: string },
): number {
  const leftPricing = left.pricing ?? 'paid'
  const rightPricing = right.pricing ?? 'paid'
  const leftDeployment = left.deployment ?? 'cloud'
  const rightDeployment = right.deployment ?? 'cloud'

  const pricingDiff = pricingRank(leftPricing) - pricingRank(rightPricing)
  if (pricingDiff !== 0)
    return pricingDiff

  const deploymentDiff = deploymentRank(leftDeployment) - deploymentRank(rightDeployment)
  if (deploymentDiff !== 0)
    return deploymentDiff

  return compareStrings(left.localizedName ?? left.name ?? '', right.localizedName ?? right.name ?? '')
}
