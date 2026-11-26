export interface VisionModelRef {
  id: string
  name?: string
  inputModalities?: string[]
  metadata?: {
    abilities?: {
      vision?: boolean
    }
  }
}

function haystackForModel(model: VisionModelRef): string {
  return `${model.id} ${model.name ?? ''}`.toLowerCase()
}

/** True when the id or name marks image or video generation, not image understanding. */
export function isImageGenerationCatalogModel(model: VisionModelRef): boolean {
  const haystack = haystackForModel(model)
  const markers = [
    'dall-e',
    'dalle',
    'gpt-image',
    'sora',
    'veo',
    'flux',
    'text-to-image',
    'image-generation',
    'video-generation',
    'imagine',
  ] as const
  return markers.some(marker => haystack.includes(marker))
}

/** True when the id or name marks a non-vision checkpoint (speech, embed, safety). */
export function isNonVisionUnderstandingCatalogModel(model: VisionModelRef): boolean {
  const haystack = haystackForModel(model)
  const markers = [
    'embed',
    'tts',
    'whisper',
    'transcribe',
    'speech-to-text',
    'text-to-speech',
    'text_to_speech',
    'stt',
    'realtime',
    'audio',
    'safeguard',
    'moderation',
  ] as const
  return markers.some(marker => haystack.includes(marker))
}

/**
 * True when the id or name marks a multimodal / VL chat model used for image understanding.
 * Used when the provider catalog omits `inputModalities` or `abilities.vision`.
 */
export function visionUnderstandingMarkerMatches(haystack: string): boolean {
  const normalized = haystack.trim().toLowerCase()
  if (!normalized)
    return false

  const markers = [
    'llava',
    'bakllava',
    'moondream',
    'minicpm-v',
    'minicpm_v',
    'internvl',
    'pixtral',
    'qwen-vl',
    'qwen2-vl',
    'qwen2.5-vl',
    'qwen2.5vl',
    '-vl',
    ':vl',
    '_vl',
    '/vl',
    'vision',
    'multimodal',
    'phi-3-vision',
    'phi-3.5-vision',
    'phi-4-multimodal',
    'gpt-4o',
    'gpt-4.1',
    'gpt-4-turbo',
    'gpt-5',
    'claude-3',
    'claude-4',
    'claude-sonnet',
    'claude-opus',
    'claude-haiku',
    'gemini',
    'llama-4',
    'llama4',
  ] as const

  return markers.some(marker => normalized.includes(marker))
}

/**
 * True when AIRI can use this model for Vision image understanding.
 *
 * Precedence: reject generation and non-vision ids, accept explicit vision
 * metadata, then accept known multimodal name markers.
 */
export function isUsableVisionModel(model: VisionModelRef): boolean {
  if (isNonVisionUnderstandingCatalogModel(model))
    return false
  if (isImageGenerationCatalogModel(model))
    return false

  if (model.metadata?.abilities?.vision === true)
    return true

  if (model.inputModalities?.some(modality => modality.toLowerCase() === 'image'))
    return true

  return visionUnderstandingMarkerMatches(haystackForModel(model))
}
