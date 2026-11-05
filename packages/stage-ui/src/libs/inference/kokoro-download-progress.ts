import type { ProgressPayload } from './protocol'

import { KOKORO_MODELS } from '../../workers/kokoro/constants'
import { resolveProgressPercent } from './protocol'

export interface KokoroDownloadProgressSnapshot {
  speechModelId: string
  state: 'downloading' | 'compiling' | 'warming-up'
  percent: number
  file?: string
  loaded?: number
  total?: number
  recordedAt: number
}

type KokoroDownloadProgressSetter = (update: KokoroDownloadProgressSnapshot | null) => void

let progressSetter: KokoroDownloadProgressSetter | null = null

/** Speech catalog store registers the cross-window progress sink on startup. */
export function registerKokoroDownloadProgressSetter(setter: KokoroDownloadProgressSetter | null): void {
  progressSetter = setter
}

export function kokoroSpeechModelIdForStatusId(modelStatusId: string): string | null {
  if (!modelStatusId.startsWith('kokoro-'))
    return null
  const quantization = modelStatusId.slice('kokoro-'.length)
  const byQuantization = KOKORO_MODELS.filter(model => model.quantization === quantization)
  if (byQuantization.length === 1)
    return byQuantization[0]!.id
  const wasmMatch = byQuantization.find(model => model.platform === 'wasm')
  return wasmMatch?.id ?? byQuantization[0]?.id ?? quantization
}

export function publishKokoroDownloadProgress(update: KokoroDownloadProgressSnapshot | null): void {
  progressSetter?.(update)
}

export function mirrorKokoroInferenceProgress(
  modelStatusId: string,
  state: KokoroDownloadProgressSnapshot['state'] | 'ready' | 'idle' | 'running' | 'error',
  progress?: ProgressPayload,
): void {
  if (state === 'ready' || state === 'idle' || state === 'running' || state === 'error') {
    publishKokoroDownloadProgress(null)
    return
  }

  const speechModelId = kokoroSpeechModelIdForStatusId(modelStatusId)
  if (!speechModelId)
    return

  const percent = progress ? resolveProgressPercent(progress) : -1
  publishKokoroDownloadProgress({
    speechModelId,
    state,
    percent: percent >= 0 ? percent : 0,
    file: progress?.file,
    loaded: progress?.loaded,
    total: progress?.total,
    recordedAt: Date.now(),
  })
}
