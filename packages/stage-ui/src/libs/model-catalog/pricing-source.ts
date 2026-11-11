import type { ProviderPricing } from '../providers/attributes'

import { fetchUrlTextForCatalog } from '@proj-airi/stage-shared/catalog-url-fetch'
import { nullable, object, optional, parse, picklist, record, string } from 'valibot'
import { shallowRef } from 'vue'

/** Saved read of one provider pricing page. */
export interface ProviderTierTable {
  /** ISO time of the page read that produced this table. */
  checkedAt: string
  /** One tier for every model from that provider. */
  uniform?: ProviderPricing
  /** Model id, without a `models/` prefix, to its tier. */
  tiers?: Readonly<Record<string, ProviderPricing>>
  /**
   * Family prefix from a page section that names a family and lists no model id.
   * `gemma-` covers Gemma ids the page prices as one free family.
   */
  prefixes?: readonly { prefix: string, tier: ProviderPricing }[]
}

/** One provider whose pricing page can change the catalog workflow. */
export interface PricingPageSource {
  providerId: string
  pageUrl: string
  /** Age after which the catalog reads the page again. */
  maxAgeMs: number
  /** Last page read shipped with the app. The catalog uses it before a new read succeeds. */
  snapshot: ProviderTierTable
  parse: (pageText: string, checkedAt: string) => ProviderTierTable | null
}

export interface PricingSourceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface StoredPricingRead {
  fetchedAt: string
  table: ProviderTierTable | null
}

const STORAGE_KEY = 'airi/provider-pricing-sources'
const pricingTier = picklist(['free', 'limited', 'paid'])

const storedReadSchema = object({
  fetchedAt: string(),
  table: nullable(object({
    checkedAt: string(),
    uniform: optional(pricingTier),
    tiers: optional(record(string(), pricingTier)),
    prefixes: optional(record(string(), pricingTier)),
  })),
})

const pricingPageSources: PricingPageSource[] = []

const pricingTierTables = shallowRef<Record<string, ProviderTierTable>>({})

/**
 * Registers a pricing page.
 * The catalog reads that page when the saved result is missing or older than `maxAgeMs`.
 * One tier on the page keeps one label. Several tiers label each model id.
 */
export function registerPricingPageSource(source: PricingPageSource) {
  if (pricingPageSources.some(entry => entry.providerId === source.providerId))
    return
  pricingPageSources.push(source)
  pricingTierTables.value = {
    ...pricingTierTables.value,
    [source.providerId]: source.snapshot,
  }
}

export function listPricingPageSources(): readonly PricingPageSource[] {
  return pricingPageSources
}

/** Tables the catalog uses now. A later page read replaces the snapshot for that provider. */
export function currentPricingTierTables(): Readonly<Record<string, ProviderTierTable>> {
  return pricingTierTables.value
}

export function normalizeCatalogModelId(modelId: string): string {
  const trimmed = modelId.trim()
  return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed
}

/**
 * Resolves a model tier from pricing-page tables.
 * `undefined` means this provider has no page result, so the caller keeps the usual label.
 * `null` means the page lists tiers and this model id is absent.
 */
export function tierFromTables(
  tables: Readonly<Record<string, ProviderTierTable>> | undefined,
  providerId: string,
  modelId: string,
): ProviderPricing | null | undefined {
  const table = tables?.[providerId]
  if (!table)
    return undefined
  if (table.uniform)
    return table.uniform

  const id = normalizeCatalogModelId(modelId)
  const tiers = table.tiers
  if (tiers?.[id])
    return tiers[id]

  if (tiers) {
    let bestLength = -1
    let bestTier: ProviderPricing | undefined
    for (const [key, tier] of Object.entries(tiers)) {
      if (!id.startsWith(`${key}-`) || key.length <= bestLength)
        continue
      bestLength = key.length
      bestTier = tier
    }
    if (bestTier)
      return bestTier
  }

  const prefix = table.prefixes?.find(entry => id.startsWith(entry.prefix))
  if (prefix)
    return prefix.tier

  if (tiers || table.prefixes?.length)
    return null
  return undefined
}

function browserStorage(): PricingSourceStorage | null {
  if (typeof localStorage === 'undefined')
    return null
  return localStorage
}

function readStoredReads(storage: PricingSourceStorage): Record<string, StoredPricingRead> {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw)
    return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object')
      return {}
    const reads: Record<string, StoredPricingRead> = {}
    for (const [providerId, value] of Object.entries(parsed)) {
      const read = parse(storedReadSchema, value)
      reads[providerId] = {
        fetchedAt: read.fetchedAt,
        table: read.table
          ? {
              checkedAt: read.table.checkedAt,
              ...(read.table.uniform ? { uniform: read.table.uniform } : {}),
              ...(read.table.tiers ? { tiers: read.table.tiers } : {}),
              ...(read.table.prefixes
                ? {
                    prefixes: Object.entries(read.table.prefixes).map(([prefix, tier]) => ({ prefix, tier })),
                  }
                : {}),
            }
          : null,
      }
    }
    return reads
  }
  catch {
    return {}
  }
}

interface StoredTierTable {
  checkedAt: string
  uniform?: ProviderPricing
  tiers?: Readonly<Record<string, ProviderPricing>>
  prefixes?: Record<string, ProviderPricing>
}

function writeStoredReads(storage: PricingSourceStorage, reads: Record<string, StoredPricingRead>) {
  const payload: Record<string, {
    fetchedAt: string
    table: StoredTierTable | null
  }> = {}
  for (const [providerId, read] of Object.entries(reads)) {
    payload[providerId] = {
      fetchedAt: read.fetchedAt,
      table: read.table
        ? {
            checkedAt: read.table.checkedAt,
            ...(read.table.uniform ? { uniform: read.table.uniform } : {}),
            ...(read.table.tiers ? { tiers: read.table.tiers } : {}),
            ...(read.table.prefixes
              ? { prefixes: Object.fromEntries(read.table.prefixes.map(entry => [entry.prefix, entry.tier])) }
              : {}),
          }
        : null,
    }
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function ageMs(isoTime: string, now: number): number {
  const parsed = Date.parse(isoTime)
  if (!Number.isFinite(parsed))
    return Number.POSITIVE_INFINITY
  return now - parsed
}

function applyTables(tables: Record<string, ProviderTierTable>) {
  pricingTierTables.value = tables
}

/**
 * Reads each registered pricing page when the saved result is missing or old.
 * A failed read keeps the previous table and waits until `maxAgeMs` before the next read.
 */
export async function ensurePricingSourcesFresh(options: {
  now?: number
  fetchText?: (url: string) => Promise<string | null>
  storage?: PricingSourceStorage | null
} = {}): Promise<void> {
  const now = options.now ?? Date.now()
  const fetchText = options.fetchText ?? fetchUrlTextForCatalog
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const stored = storage ? readStoredReads(storage) : {}
  const next: Record<string, ProviderTierTable> = {}
  let changed = false

  for (const source of pricingPageSources) {
    const saved = stored[source.providerId]
    const current = saved?.table ?? source.snapshot
    const fetchedAt = saved?.fetchedAt ?? source.snapshot.checkedAt
    if (ageMs(fetchedAt, now) < source.maxAgeMs) {
      next[source.providerId] = current
      continue
    }

    const pageText = await fetchText(source.pageUrl)
    const parsed = pageText ? source.parse(pageText, new Date(now).toISOString()) : null
    const fetchedAtNow = new Date(now).toISOString()
    stored[source.providerId] = {
      fetchedAt: fetchedAtNow,
      table: parsed,
    }
    next[source.providerId] = parsed ?? current
    changed = true
  }

  if (changed && storage)
    writeStoredReads(storage, stored)
  applyTables(next)
}
