import type { InferOutput } from 'valibot'

import { array, boolean, literal, nullable, number, object, optional, parse, record, string, unknown } from 'valibot'

export const CLOUD_MODEL_CATALOG_CACHE_VERSION = 2

/** Default time-to-live for a persisted cloud catalog snapshot. */
export const CLOUD_MODEL_CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const CLOUD_MODEL_CATALOG_CACHEABLE_PROVIDER_IDS = ['openrouter-ai'] as const

export type CloudModelCatalogCacheableProviderId = typeof CLOUD_MODEL_CATALOG_CACHEABLE_PROVIDER_IDS[number]

const pricingUnitSchema = object({
  name: string(),
  rate: number(),
  strategy: string(),
  unit: string(),
})

const cachedModelMetadataSchema = object({
  abilities: optional(record(string(), unknown())),
  maxOutput: optional(number()),
  pricing: optional(object({
    units: optional(array(pricingUnitSchema)),
  })),
  settings: optional(record(string(), unknown())),
})

const cachedModelSchema = object({
  id: string(),
  name: string(),
  provider: string(),
  description: optional(string()),
  contextLength: optional(number()),
  deprecated: optional(boolean()),
  inputModalities: optional(array(string())),
  reasoning: optional(object({ mandatory: optional(boolean()) })),
  metadata: optional(cachedModelMetadataSchema),
})

const cacheDocumentSchema = object({
  version: literal(CLOUD_MODEL_CATALOG_CACHE_VERSION),
  providerId: string(),
  configurationFingerprint: string(),
  fetchedAt: number(),
  defaultModel: optional(nullable(string())),
  models: array(cachedModelSchema),
})

export type CloudModelCatalogCacheDocument = InferOutput<typeof cacheDocumentSchema>

export type CloudModelCatalogCachedModel = CloudModelCatalogCacheDocument['models'][number]

export function isCloudModelCatalogCacheableProvider(
  providerId: string,
): providerId is CloudModelCatalogCacheableProviderId {
  return (CLOUD_MODEL_CATALOG_CACHEABLE_PROVIDER_IDS as readonly string[]).includes(providerId)
}

function normalizeCatalogBaseUrl(baseUrl: unknown): string {
  if (typeof baseUrl !== 'string' || !baseUrl.trim())
    return 'https://openrouter.ai/api/v1/'

  try {
    const url = new URL(baseUrl.trim())
    return `${url.origin}${url.pathname.replace(/\/$/, '') || ''}`
  }
  catch {
    return baseUrl.trim().replace(/\/$/, '')
  }
}

/**
 * Builds a stable storage key from provider id and endpoint origin.
 * Credentials are excluded so the public model list can be shared safely.
 */
export async function cloudModelCatalogConfigurationFingerprint(
  providerId: string,
  config: Record<string, unknown>,
): Promise<string> {
  const payload = JSON.stringify({
    providerId,
    baseURL: normalizeCatalogBaseUrl(config.baseUrl ?? config.baseURL),
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function cloudModelCatalogStorageFileName(
  providerId: string,
  configurationFingerprint: string,
): string {
  return `${providerId}-${configurationFingerprint.slice(0, 24)}.json`
}

export function isCloudModelCatalogCacheStale(
  fetchedAt: number,
  ttlMs: number = CLOUD_MODEL_CATALOG_CACHE_TTL_MS,
  now: number = Date.now(),
): boolean {
  return now - fetchedAt > ttlMs
}

export function parseCloudModelCatalogCacheDocument(raw: string): CloudModelCatalogCacheDocument | null {
  try {
    const json: unknown = JSON.parse(raw)
    return parse(cacheDocumentSchema, json)
  }
  catch {
    return null
  }
}

export function serializeCloudModelCatalogCacheDocument(document: CloudModelCatalogCacheDocument): string {
  return JSON.stringify(document)
}

export function createCloudModelCatalogCacheDocument(input: {
  providerId: string
  configurationFingerprint: string
  models: CloudModelCatalogCachedModel[]
  defaultModel?: string | null
  fetchedAt?: number
}): CloudModelCatalogCacheDocument {
  return {
    version: CLOUD_MODEL_CATALOG_CACHE_VERSION,
    providerId: input.providerId,
    configurationFingerprint: input.configurationFingerprint,
    fetchedAt: input.fetchedAt ?? Date.now(),
    defaultModel: input.defaultModel,
    models: input.models,
  }
}

/** Maps a persisted snapshot into provider-runtime model rows. */
export function modelsFromCloudModelCatalogCache(
  document: CloudModelCatalogCacheDocument,
): CloudModelCatalogCachedModel[] {
  return document.models.map(model => ({
    ...model,
    description: model.description ?? '',
    contextLength: model.contextLength ?? 0,
    deprecated: model.deprecated ?? false,
  }))
}
