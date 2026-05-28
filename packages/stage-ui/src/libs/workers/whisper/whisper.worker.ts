/**
 * Unified Whisper Web Worker
 *
 * Implements the unified inference protocol from protocol.ts.
 * Supports WebGPU-first execution with automated WASM fallback and progress updates.
 */

import type {
  ErrorResponse,
  InferenceResultResponse,
  LoadModelRequest,
  ModelReadyResponse,
  ProgressResponse,
  RunInferenceRequest,
  WorkerInboundMessage,
} from '../../inference/protocol'

import { env, pipeline } from '@huggingface/transformers'

import { classifyError, isRecoverable } from '../../inference/protocol'

// Initialize HuggingFace environment
env.allowLocalModels = false
env.useBrowserCache = true

// Pipeline cache and status
let transcriber: any = null
let currentModelId: string | null = null
let currentDevice: string | null = null

// Cancellation tracking
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
  const message = error instanceof Error ? error.message : String(error)
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

// Resampling helper
function resample(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate)
    return audio
  const ratio = fromRate / toRate
  const newLength = Math.round(audio.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio
    const index = Math.floor(pos)
    const frac = pos - index
    if (index + 1 < audio.length) {
      result[i] = audio[index] * (1 - frac) + audio[index + 1] * frac
    }
    else {
      result[i] = audio[index]
    }
  }
  return result
}

// WAV header parser
function parseWav(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  if (view.byteLength < 44)
    return null
  if (view.getUint32(0) !== 0x52494646) // "RIFF"
    return null
  if (view.getUint32(8) !== 0x57415645) // "WAVE"
    return null

  let offset = 12
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = 0
  let dataSize = 0

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = view.getUint32(offset)
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 0x666D7420) { // "fmt "
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    }
    else if (chunkId === 0x64617461) { // "data"
      dataOffset = offset + 8
      dataSize = chunkSize
      break
    }
    offset += 8 + chunkSize
  }

  if (!dataOffset || !sampleRate)
    return null
  return { sampleRate, bitsPerSample, dataOffset, dataSize }
}

function ensureFloat32Array(audio: any): Float32Array {
  const TARGET_RATE = 16000

  if (audio instanceof Blob) {
    throw new TypeError('Blobs cannot be processed directly in worker sync — convert to ArrayBuffer first.')
  }

  let float32: Float32Array
  let sourceRate = TARGET_RATE

  if (audio instanceof ArrayBuffer) {
    const wav = parseWav(audio)
    if (wav) {
      sourceRate = wav.sampleRate
      if (wav.bitsPerSample === 16) {
        const i16 = new Int16Array(audio, wav.dataOffset, Math.floor(wav.dataSize / 2))
        float32 = new Float32Array(i16.length)
        for (let i = 0; i < i16.length; ++i) {
          float32[i] = i16[i] / 32768.0
        }
      }
      else if (wav.bitsPerSample === 32) {
        float32 = new Float32Array(audio, wav.dataOffset, Math.floor(wav.dataSize / 4))
      }
      else {
        throw new Error(`Unsupported WAV bits per sample: ${wav.bitsPerSample}`)
      }
    }
    else {
      sourceRate = 48000
      float32 = new Float32Array(audio)
    }
  }
  else if (audio instanceof Float32Array) {
    float32 = audio
    sourceRate = 48000
  }
  else if (audio instanceof Int16Array) {
    sourceRate = 48000
    float32 = new Float32Array(audio.length)
    for (let i = 0; i < audio.length; ++i) {
      float32[i] = audio[i] / 32768.0
    }
  }
  else {
    throw new TypeError(`Unsupported data type: ${audio?.constructor?.name || typeof audio}`)
  }

  if (sourceRate !== TARGET_RATE) {
    return resample(float32, sourceRate, TARGET_RATE)
  }

  return float32
}

async function loadModel(request: LoadModelRequest): Promise<void> {
  const { requestId, modelId, device } = request

  try {
    if (transcriber && currentModelId === modelId && currentDevice === device) {
      if (isCancelled(requestId)) {
        clearCancelled(requestId)
        return
      }
      const ready: ModelReadyResponse = {
        type: 'model-ready',
        requestId,
        modelId,
        device: device as 'webgpu' | 'wasm' | 'cpu',
      }
      globalThis.postMessage(ready)
      return
    }

    const attempts = [
      { device, dtype: 'fp16' },
      { device: 'wasm', dtype: 'fp32' },
    ]

    let lastError: unknown
    for (const attempt of attempts) {
      try {
        console.info(`[Whisper Worker] Attempting load: device=${attempt.device}, dtype=${attempt.dtype}`)
        transcriber = await pipeline('automatic-speech-recognition', modelId, {
          device: attempt.device as any,
          dtype: attempt.dtype as any,
          progress_callback: (progress: any) => {
            const msg: ProgressResponse = {
              type: 'progress',
              requestId,
              payload: {
                phase: 'download',
                percent: progress?.progress ?? -1,
                message: progress?.status,
                file: progress?.file,
                loaded: progress?.loaded,
                total: progress?.total,
              },
            }
            globalThis.postMessage(msg)
          },
        })

        currentModelId = modelId
        currentDevice = attempt.device

        if (isCancelled(requestId)) {
          clearCancelled(requestId)
          return
        }

        const ready: ModelReadyResponse = {
          type: 'model-ready',
          requestId,
          modelId,
          device: attempt.device as 'webgpu' | 'wasm' | 'cpu',
        }
        globalThis.postMessage(ready)
        return
      }
      catch (error) {
        lastError = error
        console.warn(`[Whisper Worker] Load attempt failed for device=${attempt.device}, dtype=${attempt.dtype}`, error)
      }
    }

    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, lastError ?? new Error('All model load attempts failed'), 'load')
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'load')
  }
}

async function runInference(request: RunInferenceRequest<any>): Promise<void> {
  const { requestId, input } = request

  try {
    if (!transcriber)
      throw new Error('Model not loaded. Send load-model first.')

    const audioData = input.audio || input.audioFloat32
    if (!audioData)
      throw new Error('No audio input provided.')

    const audioBuffer = ensureFloat32Array(audioData)
    const isEnglishOnly = currentModelId?.endsWith('.en')
    const options: any = {
      chunk_length_s: 30,
      stride_length_s: 5,
    }
    if (!isEnglishOnly) {
      options.language = input.language || 'en'
    }

    const start = Date.now()
    const result = await transcriber(audioBuffer, options)
    const durationMs = Date.now() - start

    if (isCancelled(requestId)) {
      clearCancelled(requestId)
      return
    }

    const response: InferenceResultResponse<{ text: string[] }> = {
      type: 'inference-result',
      requestId,
      output: {
        text: [result.text],
      },
      durationMs,
    }
    globalThis.postMessage(response)
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'inference')
  }
}

globalThis.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage<any>>) => {
  const message = event.data

  switch (message.type) {
    case 'load-model':
      await loadModel(message)
      break
    case 'run-inference':
      await runInference(message)
      break
    case 'unload-model':
      transcriber = null
      currentModelId = null
      currentDevice = null
      globalThis.postMessage({ type: 'model-unloaded', requestId: message.requestId })
      break
    case 'cancel':
      markCancelled(message.targetRequestId)
      break
    default:
      console.warn('[Whisper Worker] Unknown message type:', (message as any).type)
  }
})
