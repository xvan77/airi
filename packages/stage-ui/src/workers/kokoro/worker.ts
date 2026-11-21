/**
 * Kokoro TTS Web Worker Entry Point
 *
 * Uses the unified inference protocol from protocol.ts.
 * Domain-specific messages (getVoices) are handled via RunInferenceRequest.
 */

import type {
  ErrorResponse,
  InferenceResultResponse,
  LoadModelRequest,
  ModelReadyResponse,
  ProgressResponse,
  RunInferenceRequest,
  WorkerInboundMessage,
} from '../../libs/inference/protocol'
import type { VoiceKey, Voices } from './types'

import { env } from '@huggingface/transformers'
import { errorMessageFromValue } from '@proj-airi/stage-shared'
import { KokoroTTS } from 'kokoro-js'

import { MODEL_IDS, MODEL_NAMES } from '../../libs/inference/constants'
import {
  isCorruptKokoroOnnxError,
  kokoroOnnxCacheUrlsForQuantization,
} from '../../libs/inference/kokoro-speech-model-download-state'
import { classifyError, isRecoverable } from '../../libs/inference/protocol'

env.allowLocalModels = false
env.useBrowserCache = true
env.backends.onnx.logLevel = 'error'

// Four threads is the default. ONNX uses one thread until the window is cross-origin isolated.
const hardwareThreads = typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency
env.backends.onnx.wasm!.numThreads = Math.min(4, Math.max(1, hardwareThreads || 4))

const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

async function listTransformersCacheUrls(): Promise<string[]> {
  if (typeof caches === 'undefined')
    return []

  const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
  const keys = await cache.keys()
  return keys.map(request => request.url)
}

async function configureRemoteModelAccessForLoad(quantization: string): Promise<void> {
  try {
    const onnxUrls = kokoroOnnxCacheUrlsForQuantization(await listTransformersCacheUrls(), quantization)
    if (onnxUrls.length > 0) {
      console.info('[Kokoro Worker] Model files found in cache. Disabling remote checks to load offline.')
      env.allowLocalModels = true
      env.allowRemoteModels = false
    }
    else {
      console.info('[Kokoro Worker] Model files not found in cache. Enabling remote checks.')
      env.allowLocalModels = false
      env.allowRemoteModels = true
    }
  }
  catch (error) {
    console.warn('[Kokoro Worker] Cache check failed, proceeding with default settings:', errorMessageFromValue(error))
  }
}

async function deleteCachedKokoroOnnx(quantization: string): Promise<void> {
  if (typeof caches === 'undefined')
    return

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    const drop = new Set(kokoroOnnxCacheUrlsForQuantization(keys.map(request => request.url), quantization))
    await Promise.all(
      keys
        .filter(request => drop.has(request.url))
        .map(request => cache.delete(request)),
    )
  }
  catch (error) {
    console.warn('[Kokoro Worker] Could not delete the damaged voice file:', errorMessageFromValue(error))
  }
}

// ---------------------------------------------------------------------------
// Inference-specific input/output types
// ---------------------------------------------------------------------------

export interface KokoroGenerateInput {
  action: 'generate'
  text: string
  voice: VoiceKey
}

export interface KokoroGetVoicesInput {
  action: 'getVoices'
}

export type KokoroInferenceInput = KokoroGenerateInput | KokoroGetVoicesInput

export interface KokoroGenerateOutput {
  action: 'generate'
  samples: Float32Array
  samplingRate: number
}

export interface KokoroVoicesOutput {
  action: 'getVoices'
  voices: Voices
}

export type KokoroInferenceOutput = KokoroGenerateOutput | KokoroVoicesOutput

// ---------------------------------------------------------------------------
// Model singleton
// ---------------------------------------------------------------------------

let ttsModel: KokoroTTS | null = null
let currentQuantization: string | null = null
let currentDevice: string | null = null

// NOTICE: Fallback chains for dtype/device when the requested format is
// unsupported at runtime. Tries progressively lower precision before giving up.
const DTYPE_FALLBACK: Record<string, string[]> = {
  fp16: ['fp32', 'q8', 'q4'],
  fp32: ['q8', 'q4'],
  q8: ['q4', 'fp32'],
  q4: ['q4f16', 'fp32'],
  q4f16: ['q4', 'fp32'],
}

const DEVICE_FALLBACK: Record<string, string[]> = {
  webgpu: ['wasm'],
  wasm: [],
  cpu: [],
}

// NOTICE: Cancellation tracking — see Whisper worker for the full rationale.
// We cannot interrupt a transformers.js call synchronously; this set lets us
// drop stale results when they arrive.
const cancelledRequestIds = new Set<string>()

function markCancelled(targetRequestId: string): void {
  cancelledRequestIds.add(targetRequestId)
  const msg: ErrorResponse = {
    type: 'error',
    requestId: targetRequestId,
    payload: {
      code: 'CANCELLED',
      message: 'Operation cancelled by caller',
      recoverable: false,
    },
  }
  globalThis.postMessage(msg)
}

function isCancelled(requestId: string): boolean {
  return cancelledRequestIds.has(requestId)
}

function clearCancelled(requestId: string): void {
  cancelledRequestIds.delete(requestId)
}

function sendError(requestId: string, error: unknown, phase?: 'load' | 'inference'): void {
  const message = errorMessageFromValue(error)
  const code = classifyError(error, phase)
  const msg: ErrorResponse = {
    type: 'error',
    requestId,
    payload: {
      code,
      message,
      recoverable: isRecoverable(code),
    },
  }
  globalThis.postMessage(msg)
}

interface KokoroDownloadProgress {
  progress?: number
  status?: string
  file?: string
  loaded?: number
  total?: number
}

async function loadModel(request: LoadModelRequest): Promise<void> {
  const { requestId, device, dtype } = request
  const quantization = dtype ?? 'fp32'
  const modelQuantization = quantization.endsWith('-webgpu')
    ? quantization.slice(0, -'-webgpu'.length)
    : quantization

  try {
    if (ttsModel && currentQuantization === quantization && currentDevice === device) {
      if (isCancelled(requestId)) {
        clearCancelled(requestId)
        return
      }
      const ready: ModelReadyResponse = {
        type: 'model-ready',
        requestId,
        modelId: MODEL_NAMES.KOKORO,
        device: device as 'webgpu' | 'wasm' | 'cpu',
        metadata: { voices: ttsModel.voices },
      }
      globalThis.postMessage(ready)
      return
    }

    await configureRemoteModelAccessForLoad(modelQuantization)

    // Build ordered list of (dtype, device) pairs to attempt
    const attempts: Array<{ dtype: string, device: string }> = [
      { dtype: modelQuantization, device },
    ]
    for (const fallbackDtype of (DTYPE_FALLBACK[modelQuantization] ?? []))
      attempts.push({ dtype: fallbackDtype, device })
    for (const fallbackDevice of (DEVICE_FALLBACK[device] ?? []))
      attempts.push({ dtype: modelQuantization, device: fallbackDevice })

    const retriedCorruptLoads = new Set<string>()
    let lastError: unknown
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index]
      if (!attempt)
        continue

      try {
        ttsModel = await KokoroTTS.from_pretrained(
          MODEL_IDS.KOKORO,
          {
            dtype: attempt.dtype as 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16',
            device: attempt.device as 'wasm' | 'webgpu' | 'cpu',
            progress_callback: (progress: KokoroDownloadProgress) => {
              const rawProgress = progress?.progress
              const normalizedPercent = rawProgress == null || rawProgress < 0
                ? -1
                : rawProgress <= 1
                  ? Math.min(100, rawProgress * 100)
                  : Math.min(100, rawProgress)
              const msg: ProgressResponse = {
                type: 'progress',
                requestId,
                payload: {
                  phase: 'download',
                  percent: normalizedPercent,
                  message: progress?.status,
                  file: progress?.file,
                  loaded: progress?.loaded,
                  total: progress?.total,
                },
              }
              globalThis.postMessage(msg)
            },
          },
        )

        currentQuantization = quantization
        currentDevice = attempt.device

        if (isCancelled(requestId)) {
          clearCancelled(requestId)
          return
        }
        const ready: ModelReadyResponse = {
          type: 'model-ready',
          requestId,
          modelId: MODEL_NAMES.KOKORO,
          device: attempt.device as 'webgpu' | 'wasm' | 'cpu',
          metadata: {
            voices: ttsModel.voices,
            actualDtype: attempt.dtype,
            actualDevice: attempt.device,
          },
        }
        globalThis.postMessage(ready)
        return
      }
      catch (error) {
        lastError = error
        const message = errorMessageFromValue(error)
        const retryKey = `${attempt.dtype}:${attempt.device}`
        // NOTICE:
        // Delete a broken ONNX file before the same size is tried again.
        // transformers.js keeps the cached file after remote downloads turn back on.
        // Console 2322: protobuf parsing failed on q4f16. Cancel stopped the redownload.
        // Remove this when the loader rejects a bad cache entry.
        if (isCorruptKokoroOnnxError(message) && !retriedCorruptLoads.has(retryKey)) {
          retriedCorruptLoads.add(retryKey)
          console.info('[Kokoro Worker] Saved voice file is damaged. Deleting it and downloading the same size again.')
          await deleteCachedKokoroOnnx(attempt.dtype)
          env.allowRemoteModels = true
          env.allowLocalModels = false
          attempts.splice(index + 1, 0, attempt)
          continue
        }

        console.warn(
          `[Kokoro Worker] Failed with dtype=${attempt.dtype} device=${attempt.device}, trying next fallback...`,
          message,
        )
        if (!env.allowRemoteModels) {
          console.info('[Kokoro Worker] Load failed with remote models disabled. Re-enabling remote models to repair or redownload files.')
          env.allowRemoteModels = true
          env.allowLocalModels = false
        }
      }
    }

    // All attempts exhausted
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, lastError ?? new Error('All dtype/device combinations failed'), 'load')
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'load')
  }
}

async function runInference(request: RunInferenceRequest<KokoroInferenceInput>): Promise<void> {
  const { requestId, input } = request

  try {
    if (input.action === 'getVoices') {
      if (!ttsModel)
        throw new Error('Model not loaded. Send load-model first.')

      if (isCancelled(requestId)) {
        clearCancelled(requestId)
        return
      }

      const result: InferenceResultResponse<KokoroVoicesOutput> = {
        type: 'inference-result',
        requestId,
        output: { action: 'getVoices', voices: ttsModel.voices },
      }
      globalThis.postMessage(result)
      return
    }

    // action === 'generate'
    if (!ttsModel)
      throw new Error('Kokoro TTS generation failed: No model loaded.')

    const { text, voice } = input
    const audioResult = await ttsModel.generate(text, { voice })

    if (isCancelled(requestId)) {
      clearCancelled(requestId)
      return
    }

    // Transfer raw PCM Float32Array directly — avoids WAV blob encode/decode overhead.
    const samples = audioResult.audio
    const result: InferenceResultResponse<KokoroGenerateOutput> = {
      type: 'inference-result',
      requestId,
      output: { action: 'generate', samples, samplingRate: audioResult.sampling_rate },
    }
    ;(globalThis as any).postMessage(result, [samples.buffer])
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'inference')
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

globalThis.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage<KokoroInferenceInput>>) => {
  const message = event.data

  switch (message.type) {
    case 'load-model':
      await loadModel(message)
      break
    case 'run-inference':
      await runInference(message as RunInferenceRequest<KokoroInferenceInput>)
      break
    case 'unload-model':
      ttsModel = null
      currentQuantization = null
      currentDevice = null
      globalThis.postMessage({ type: 'model-unloaded', requestId: message.requestId })
      break
    case 'cancel':
      markCancelled(message.targetRequestId)
      break
    default:
      console.warn('[Kokoro Worker] Unknown message type:', (message as any).type)
  }
})
