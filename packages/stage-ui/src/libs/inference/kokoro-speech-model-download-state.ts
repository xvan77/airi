import type { KokoroModel } from '../../workers/kokoro/constants'

import { KOKORO_MODELS } from '../../workers/kokoro/constants'
import { MODEL_IDS } from './constants'

const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

async function listTransformersCacheUrls(): Promise<string[]> {
  if (typeof caches === 'undefined')
    return []

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    return keys.map(request => request.url)
  }
  catch {
    return []
  }
}

function isKokoroCacheUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.includes(MODEL_IDS.KOKORO.toLowerCase()) || lower.includes('kokoro-82m')
}

/** ONNX files in the Kokoro repo that are not the full-precision `model.onnx`. */
const KOKORO_LABELED_QUANT_ONNX_MARKERS = [
  'model_q4f16',
  'model_q4',
  'model_q8f16',
  'model_q8',
  'model_fp16',
  'model_quantized',
  'model_uint8',
] as const

function isKokoroUnquantizedFp32OnnxUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (KOKORO_LABELED_QUANT_ONNX_MARKERS.some(marker => lower.includes(marker)))
    return false
  return /\/model\.onnx(?:[?#]|$)/.test(lower) || lower.endsWith('/model.onnx')
}

/**
 * Match a cache URL to a Kokoro quantization without false positives (q4 vs q4f16).
 */
export function cacheUrlMatchesKokoroQuantization(url: string, quantization: string): boolean {
  const lower = url.toLowerCase()
  const quant = quantization.toLowerCase()

  if (quant === 'q4f16') {
    return lower.includes('q4f16') || lower.includes('model_q4f16') || lower.includes('_q4f16.')
  }

  if (quant === 'q4') {
    if (lower.includes('q4f16') || lower.includes('model_q4f16') || lower.includes('_q4f16.'))
      return false
    return lower.includes('model_q4')
      || lower.includes('_q4.')
      || lower.includes('/q4/')
      || lower.includes('-q4-')
      || lower.includes('_q4_')
  }

  if (quant === 'q8') {
    return lower.includes('model_quantized')
      || lower.includes('_quantized.')
      || lower.includes('model_q8f16')
      || lower.includes('q8f16')
      || lower.includes('model_q8')
      || lower.includes('_q8.')
      || lower.includes('/q8/')
      || lower.includes('-q8-')
      || lower.includes('_q8_')
  }

  if (quant === 'fp16') {
    if (lower.includes('q8f16') || lower.includes('model_q8f16'))
      return false
    if (lower.includes('fp32') && !lower.includes('fp16'))
      return false
    return lower.includes('model_fp16')
      || lower.includes('_fp16.')
      || lower.includes('/fp16/')
  }

  if (quant === 'fp32') {
    return isKokoroUnquantizedFp32OnnxUrl(lower)
      || lower.includes('model_fp32')
      || lower.includes('_fp32.')
      || lower.includes('/fp32/')
  }

  return lower.includes(quant)
    || lower.includes(`model_${quant}`)
    || lower.includes(`_${quant}.`)
    || lower.includes(`/${quant}/`)
}

function cacheUrlMatchesKokoroSpeechModel(url: string, model: KokoroModel): boolean {
  if (!isKokoroCacheUrl(url))
    return false

  const lower = url.toLowerCase()
  if (!lower.includes('.onnx'))
    return false

  return cacheUrlMatchesKokoroQuantization(url, model.quantization)
}

/**
 * True when the transformers cache contains files for this Kokoro speech model id.
 * Models that share the same ONNX quant (e.g. fp16 WebGPU and fp16 WASM) both return
 * true when those shared files are present.
 */
export async function isKokoroSpeechModelDownloaded(speechModelId: string): Promise<boolean> {
  const model = KOKORO_MODELS.find(entry => entry.id === speechModelId)
  if (!model)
    return false

  const urls = await listTransformersCacheUrls()
  return urls.some(url => cacheUrlMatchesKokoroSpeechModel(url, model))
}

export async function listKokoroSpeechModelsDownloaded(): Promise<string[]> {
  const urls = await listTransformersCacheUrls()
  if (urls.length === 0)
    return []

  return KOKORO_MODELS
    .filter(model => urls.some(url => cacheUrlMatchesKokoroSpeechModel(url, model)))
    .map(model => model.id)
}
