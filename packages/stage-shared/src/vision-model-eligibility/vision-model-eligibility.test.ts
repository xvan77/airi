import { describe, expect, it } from 'vitest'

import {
  isImageGenerationCatalogModel,
  isUsableVisionModel,
  visionUnderstandingMarkerMatches,
} from './index'

describe('isUsableVisionModel', () => {
  it('accepts explicit vision metadata', () => {
    expect(isUsableVisionModel({
      id: 'vendor/plain-chat',
      name: 'Plain Chat',
      metadata: { abilities: { vision: true } },
    })).toBe(true)
  })

  it('accepts image input modalities', () => {
    expect(isUsableVisionModel({
      id: 'vendor/plain-chat',
      name: 'Plain Chat',
      inputModalities: ['text', 'image'],
    })).toBe(true)
  })

  it('accepts VL and multimodal name markers', () => {
    expect(isUsableVisionModel({ id: 'llava:7b', name: 'LLaVA' })).toBe(true)
    expect(isUsableVisionModel({ id: 'qwen2.5-vl:7b', name: 'Qwen2.5 VL' })).toBe(true)
    expect(isUsableVisionModel({ id: 'openai/gpt-4o', name: 'GPT-4o' })).toBe(true)
    expect(isUsableVisionModel({ id: 'google/gemini-2.5-flash', name: 'Gemini' })).toBe(true)
  })

  it('rejects text-only chat models without vision signals', () => {
    expect(isUsableVisionModel({
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B',
    })).toBe(false)
  })

  it('rejects speech, embed, and image-generation checkpoints', () => {
    expect(isUsableVisionModel({ id: 'whisper-1', name: 'Whisper' })).toBe(false)
    expect(isUsableVisionModel({ id: 'text-embedding-004', name: 'Embed' })).toBe(false)
    expect(isImageGenerationCatalogModel({ id: 'dall-e-3', name: 'DALL·E 3' })).toBe(true)
    expect(isUsableVisionModel({ id: 'dall-e-3', name: 'DALL·E 3' })).toBe(false)
  })
})

describe('visionUnderstandingMarkerMatches', () => {
  it('matches common local VL ids', () => {
    expect(visionUnderstandingMarkerMatches('moondream:latest')).toBe(true)
    expect(visionUnderstandingMarkerMatches('minicpm-v')).toBe(true)
  })
})
