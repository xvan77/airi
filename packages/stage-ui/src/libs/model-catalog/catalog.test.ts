import type { ModelInfo } from '../providers/types'

import { describe, expect, it } from 'vitest'

import {
  buildModelCatalogRow,
  filterModelCatalogRows,
  prepareModelCatalogRows,
  sortModelCatalogRows,
} from './catalog'
import { parseParameterBillions, parseParameterBillionsFromModel, parseQuantizationLabel } from './parse'
import { listPricingPageSources } from './pricing-source'

function model(partial: Partial<ModelInfo> & Pick<ModelInfo, 'id' | 'name'>): ModelInfo {
  return {
    provider: 'openrouter-ai',
    ...partial,
  }
}

function tierTablesFor(providerId: string) {
  const source = listPricingPageSources().find(entry => entry.providerId === providerId)
  if (!source)
    throw new Error(`${providerId} pricing page source is not registered.`)
  return { [source.providerId]: source.snapshot }
}

describe('model catalog parse helpers', () => {
  it('parses billions and millions from model names', () => {
    expect(parseParameterBillions('Llama-3.2-3B-Instruct')).toBe(3)
    expect(parseParameterBillions('gemma-3-270m-it')).toBe(0.27)
  })

  it('parses quantization labels from gguf filenames', () => {
    expect(parseQuantizationLabel('qwen2.5-1.5b-instruct-q4_k_m.gguf')).toBe('Q4')
  })

  it('parses parameter counts from OpenRouter-style descriptions', () => {
    expect(parseParameterBillionsFromModel({
      id: 'nvidia/nemotron-3.5-super-vl',
      name: 'NVIDIA: Nemotron 3.5 Super VL',
      description: 'Mixture-of-experts model with 12B active parameters out of 120B total.',
    })).toBe(12)
  })
})

describe('prepareModelCatalogRows', () => {
  it('drops speech and audio models for every provider', () => {
    const models = [
      model({ id: 'chat-model', name: 'Chat' }),
      model({ id: 'vendor/audio-gen', name: 'Audio Gen' }),
      model({ id: 'vendor/flash-tts', name: 'Flash' }),
      model({ id: 'whisper-1', name: 'Whisper' }),
      model({ id: 'dall-e-3', name: 'DALL·E 3' }),
      model({ id: 'grok-imagine-video', name: 'Grok Imagine Video' }),
    ]
    expect(prepareModelCatalogRows(models, { providerId: 'openrouter-ai' }).map(row => row.model.id)).toEqual([
      'chat-model',
    ])
    expect(prepareModelCatalogRows(models, { providerId: 'google-generative-ai' }).map(row => row.model.id)).toEqual([
      'chat-model',
    ])
  })
})

describe('model catalog ordering', () => {
  it('sorts free local models before paid cloud models, then by parameter size', () => {
    const rows = [
      buildModelCatalogRow(model({ id: 'paid-cloud', name: 'Cloud 70B' }), { providerId: 'openrouter-ai' }),
      buildModelCatalogRow(model({ id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B' }), { providerId: 'openrouter-ai' }),
      buildModelCatalogRow(model({ id: 'gemma-3-270m-it-Q4_K_M.gguf', name: 'Gemma 3 270M IT' }), { providerId: 'local-llm', diskSizeByModelId: { 'gemma-3-270m-it-Q4_K_M.gguf': 180_000_000 } }),
    ]

    const sorted = sortModelCatalogRows(rows, 'default').map(row => row.model.id)
    expect(sorted).toEqual([
      'gemma-3-270m-it-Q4_K_M.gguf',
      'meta-llama/llama-3.3-70b-instruct:free',
      'paid-cloud',
    ])
  })

  it('reverses parameter sort when direction is desc', () => {
    const rows = [
      buildModelCatalogRow(model({ id: 'small', name: 'Small 3B' }), { providerId: 'openrouter-ai' }),
      buildModelCatalogRow(model({ id: 'large', name: 'Large 70B' }), { providerId: 'openrouter-ai' }),
    ]
    const asc = sortModelCatalogRows(rows, 'params', 'asc').map(row => row.model.id)
    const desc = sortModelCatalogRows(rows, 'params', 'desc').map(row => row.model.id)
    expect(asc).toEqual(['small', 'large'])
    expect(desc).toEqual(['large', 'small'])
  })

  it('always exposes five stat chips for cloud models', () => {
    const row = buildModelCatalogRow(model({ id: 'vendor/model', name: 'Vendor Model 7B' }), { providerId: 'openrouter-ai' })
    expect(row.badges).toHaveLength(5)
    expect(row.badges[4]?.label).toBe('—')
  })

  it('filters pricing and deployment buckets', () => {
    const rows = [
      buildModelCatalogRow(model({ id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B' }), { providerId: 'openrouter-ai' }),
      buildModelCatalogRow(model({ id: 'gemma-3-270m-it-Q4_K_M.gguf', name: 'Gemma 3 270M IT' }), { providerId: 'local-llm' }),
    ]

    expect(filterModelCatalogRows(rows, { pricing: 'free', deployment: 'local' }).map(row => row.model.id)).toEqual([
      'gemma-3-270m-it-Q4_K_M.gguf',
    ])
  })

  it('labels Google models from the pricing page tiers', () => {
    const flash = buildModelCatalogRow(
      model({ id: 'models/gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'google-generative-ai' }),
      { providerId: 'google-generative-ai', tierTables: tierTablesFor('google-generative-ai') },
    )
    const argon = buildModelCatalogRow(
      model({ id: 'gemini-4-argon', name: 'Gemini 4 Argon', provider: 'google-generative-ai' }),
      { providerId: 'google-generative-ai', tierTables: tierTablesFor('google-generative-ai') },
    )
    const gemma = buildModelCatalogRow(
      model({ id: 'gemma-4-31b-it', name: 'Gemma 4', provider: 'google-generative-ai' }),
      { providerId: 'google-generative-ai', tierTables: tierTablesFor('google-generative-ai') },
    )
    const unlisted = buildModelCatalogRow(
      model({ id: 'gemini-9-experimental', name: 'Gemini 9 Experimental', provider: 'google-generative-ai' }),
      { providerId: 'google-generative-ai', tierTables: tierTablesFor('google-generative-ai') },
    )

    expect(flash.pricing).toBe('limited')
    expect(argon.pricing).toBe('paid')
    expect(gemma.pricing).toBe('free')
    expect(unlisted.pricing).toBeNull()
    expect(filterModelCatalogRows([flash, argon, gemma, unlisted], { pricing: 'limited', deployment: 'all' }).map(entry => entry.model.id)).toEqual([
      'models/gemini-3.8-flash',
    ])
    expect(filterModelCatalogRows([flash, argon, gemma, unlisted], { pricing: 'paid', deployment: 'all' }).map(entry => entry.model.id)).toEqual([
      'gemini-4-argon',
    ])
    expect(filterModelCatalogRows([flash, argon, gemma, unlisted], { pricing: 'free', deployment: 'all' }).map(entry => entry.model.id)).toEqual([
      'gemma-4-31b-it',
    ])
    expect(filterModelCatalogRows([flash, argon, gemma, unlisted], { pricing: 'all', deployment: 'all' })).toHaveLength(4)
  })

  it('labels Groq free-plan chat models as limited', () => {
    const tables = tierTablesFor('groq')
    const llama = buildModelCatalogRow(
      model({ id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq' }),
      { providerId: 'groq', tierTables: tables },
    )
    const oss = buildModelCatalogRow(
      model({ id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'groq' }),
      { providerId: 'groq', tierTables: tables },
    )
    const orpheus = buildModelCatalogRow(
      model({ id: 'canopylabs/orpheus-v1-english', name: 'Orpheus', provider: 'groq' }),
      { providerId: 'groq', tierTables: tables },
    )
    const unknown = buildModelCatalogRow(
      model({ id: 'vendor/future-model', name: 'Future', provider: 'groq' }),
      { providerId: 'groq', tierTables: tables },
    )

    expect(llama.pricing).toBe('limited')
    expect(oss.pricing).toBe('limited')
    expect(orpheus.pricing).toBe('paid')
    expect(unknown.pricing).toBeNull()
    expect(filterModelCatalogRows([llama, oss, orpheus, unknown], { pricing: 'limited', deployment: 'all' }).map(entry => entry.model.id)).toEqual([
      'llama-3.1-8b-instant',
      'openai/gpt-oss-20b',
    ])
  })
})
