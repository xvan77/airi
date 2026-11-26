import type { AIChatModelCard } from 'model-bank/types'

import type { ModelInfo, ProviderModelCatalog } from './types'

import openRouterModels from 'model-bank/openrouter'

import { pickBestCatalogDescription } from '@proj-airi/stage-shared/catalog-description'
import { listModels } from '@xsai/model'
import { array, boolean, number, object, optional, parse, string } from 'valibot'

const discoveredModelSchema = object({
  id: string(),
  inputModalities: optional(array(string())),
  architecture: optional(object({ input_modalities: optional(array(string())) })),
  reasoning: optional(object({ mandatory: optional(boolean()) })),
  name: optional(string()),
  display_name: optional(string()),
  description: optional(string()),
  context_length: optional(number()),
  contextLength: optional(number()),
  deprecated: optional(boolean()),
  pricing: optional(object({
    prompt: optional(string()),
    completion: optional(string()),
  })),
})

function metadataFromOpenRouterPricing(pricing?: { prompt?: string, completion?: string }): ModelInfo['metadata'] | undefined {
  if (!pricing?.prompt)
    return undefined

  const perToken = Number.parseFloat(pricing.prompt)
  if (!Number.isFinite(perToken))
    return undefined

  return {
    pricing: {
      units: [{
        name: 'textInput',
        rate: perToken * 1_000_000,
        strategy: 'fixed',
        unit: 'millionTokens',
      }],
    },
  }
}

const openRouterChatModelBank = openRouterModels.filter(model => model.type === 'chat')

/** Re-applies model-bank descriptions when a cached row still carries a truncated preview. */
export function enrichOpenRouterCatalogModels(models: readonly ModelInfo[]): ModelInfo[] {
  return enrichCatalogModelsWithModelBank(models, openRouterChatModelBank)
}

/** Match API ids like `models/gemini-3-flash-preview` to model-bank ids. */
export function catalogModelIdKey(id: string) {
  return id.trim().replace(/^models\//i, '').toLowerCase()
}

export function enrichCatalogModelsWithModelBank(
  models: readonly ModelInfo[],
  bank: readonly AIChatModelCard[],
): ModelInfo[] {
  const metadata = new Map(bank.map(model => [catalogModelIdKey(model.id), model]))
  return models.map((model) => {
    const details = metadata.get(catalogModelIdKey(model.id))
    if (!details)
      return model

    return {
      ...model,
      name: details.displayName ?? model.name,
      description: pickBestCatalogDescription(model.description, details.description) ?? model.description,
      contextLength: model.contextLength || details.contextWindowTokens,
      metadata: model.metadata ?? {
        abilities: details.abilities,
        maxOutput: details.maxOutput,
        pricing: details.pricing,
        settings: details.settings,
      },
    }
  })
}

/**
 * Lists endpoint models, then adds exact-ID metadata from the route's model-bank catalog.
 * Custom endpoints receive no metadata from another route. Credentials only go to the configured endpoint.
 * Catalog enrichment does not select protocols or hosted tools. No second catalog request is made.
 */
export async function listModelCatalog(
  config: Parameters<typeof listModels>[0],
  route: { models: readonly AIChatModelCard[], providerId: string, baseURL: string },
): Promise<ProviderModelCatalog> {
  const discovered = await listModels(config)
  const models: ModelInfo[] = discovered.map((value) => {
    const model = parse(discoveredModelSchema, value)
    return {
      id: model.id,
      inputModalities: model.inputModalities ?? model.architecture?.input_modalities,
      name: model.name ?? model.display_name ?? model.id,
      provider: route.providerId,
      description: model.description,
      contextLength: model.contextLength ?? model.context_length,
      deprecated: model.deprecated,
      reasoning: model.reasoning,
      metadata: metadataFromOpenRouterPricing(model.pricing),
    }
  })
  const endpoint = new URL(config.baseURL)
  const official = new URL(route.baseURL)
  if (endpoint.origin !== official.origin || endpoint.pathname.replace(/\/$/, '') !== official.pathname.replace(/\/$/, ''))
    return { models }

  return { models: enrichCatalogModelsWithModelBank(models, route.models) }
}
