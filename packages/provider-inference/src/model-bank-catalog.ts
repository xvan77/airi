import type { AIChatModelCard } from 'model-bank/types'

import type { ModelInfo } from './types'

import ai302Models from 'model-bank/ai302'
import aihubmixModels from 'model-bank/aihubmix'
import anthropicModels from 'model-bank/anthropic'
import cerebrasModels from 'model-bank/cerebras'
import cometapiModels from 'model-bank/cometapi'
import deepseekModels from 'model-bank/deepseek'
import fireworksModels from 'model-bank/fireworksai'
import googleModels from 'model-bank/google'
import groqModels from 'model-bank/groq'
import minimaxModels from 'model-bank/minimax'
import mistralModels from 'model-bank/mistral'
import modelscopeModels from 'model-bank/modelscope'
import moonshotModels from 'model-bank/moonshot'
import novitaModels from 'model-bank/novita'
import nvidiaModels from 'model-bank/nvidia'
import openRouterModels from 'model-bank/openrouter'
import perplexityModels from 'model-bank/perplexity'
import togetherModels from 'model-bank/togetherai'
import xaiModels from 'model-bank/xai'
import mimoModels from 'model-bank/xiaomimimo'
import zhipuModels from 'model-bank/zhipu'

import { openaiChatModels } from 'model-bank/openai'

import { enrichCatalogModelsWithModelBank } from './model-catalog'

function chatModels(models: readonly { type?: string }[]): AIChatModelCard[] {
  return models.filter((model): model is AIChatModelCard => model.type === 'chat')
}

/**
 * Official chat catalogs from model-bank (long More-info prose + context/pricing).
 * Keys are AIRI provider ids.
 */
export const providerChatModelBanks: Record<string, readonly AIChatModelCard[]> = {
  'openrouter-ai': chatModels(openRouterModels),
  'openai': openaiChatModels,
  'google-generative-ai': chatModels(googleModels),
  'xai': chatModels(xaiModels),
  'groq': chatModels(groqModels),
  'deepseek': chatModels(deepseekModels),
  'mistral': chatModels(mistralModels),
  'moonshot': chatModels(moonshotModels),
  'together': chatModels(togetherModels),
  'fireworks': chatModels(fireworksModels),
  'cerebras': chatModels(cerebrasModels),
  'novita': chatModels(novitaModels),
  'nvidia': chatModels(nvidiaModels),
  'perplexity': chatModels(perplexityModels),
  'zai': chatModels(zhipuModels),
  'minimax': chatModels(minimaxModels),
  'minimax-global': chatModels(minimaxModels),
  'aihubmix': chatModels(aihubmixModels),
  '302-ai': chatModels(ai302Models),
  'comet-api': chatModels(cometapiModels),
  'modelscope': chatModels(modelscopeModels),
  'mimo': chatModels(mimoModels),
  'anthropic': chatModels(anthropicModels),
}

function formatContextWindow(tokens: number | undefined) {
  if (!tokens || tokens <= 0)
    return undefined
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000
    const label = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(/\.0$/, '')
    return `${label}M tokens`
  }
  if (tokens >= 1_000) {
    const thousands = tokens / 1_000
    const label = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace(/\.0$/, '')
    return `${label}K tokens`
  }
  return `${tokens} tokens`
}

/**
 * Newer API models (for example grok-4.6) often ship before model-bank has a row.
 * Build a short honest blurb from name + context so More info still appears.
 */
export function fallbackCatalogModelDescription(model: ModelInfo): string {
  const name = model.name?.trim() || model.id
  const context = formatContextWindow(model.contextLength)
  if (context)
    return `${name}. Context window about ${context}. Chat model from this provider.`
  return `${name}. Chat model from this provider.`
}

/** Merge model-bank prose onto discovered catalog rows for a provider. */
export function enrichModelsForProvider(
  providerId: string,
  models: readonly ModelInfo[],
): ModelInfo[] {
  const bank = providerChatModelBanks[providerId]
  const enriched = bank?.length
    ? enrichCatalogModelsWithModelBank(models, bank)
    : [...models]

  return enriched.map((model) => {
    if (model.description?.trim())
      return model
    return {
      ...model,
      description: fallbackCatalogModelDescription(model),
    }
  })
}
