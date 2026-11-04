import type { ModelInfo } from '../providers/types'

import { describe, expect, it } from 'vitest'

import {
  buildModelCatalogRow,
  filterModelCatalogRows,
  sortModelCatalogRows,
} from './catalog'
import { parseParameterBillions, parseParameterBillionsFromModel, parseQuantizationLabel } from './parse'

function model(partial: Partial<ModelInfo> & Pick<ModelInfo, 'id' | 'name'>): ModelInfo {
  return {
    provider: 'openrouter-ai',
    ...partial,
  }
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
})
