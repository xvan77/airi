import type { InferenceModelStatus } from '../../composables/use-inference-status'
import type { KokoroDownloadProgressSnapshot } from './kokoro-download-progress'

import { resolveProgressPercent } from './protocol'

export const KOKORO_LOADING_STATES = new Set<InferenceModelStatus['state']>([
  'downloading',
  'compiling',
  'warming-up',
])

export interface KokoroProgressLabels {
  cancellingDownload: string
  loadingVoices: string
  downloadingModel: string
  downloadingPercent: (percent: number) => string
  compiling: string
  warmingUp: string
}

/**
 * Picks the Kokoro size that owns the progress line.
 * A live download wins. Otherwise the browsed catalog card wins over the committed runtime model.
 */
export function resolveKokoroProgressSpeechModelId(input: {
  syncedSpeechModelId?: string | null
  browsingSpeechModelId?: string | null
  activeSpeechModelId?: string | null
  awaitingSizeChoice?: boolean
}): string {
  const browsing = input.browsingSpeechModelId?.trim()
  const active = input.activeSpeechModelId?.trim()
  if (input.awaitingSizeChoice && !browsing && !active)
    return ''

  if (browsing)
    return browsing

  const synced = input.syncedSpeechModelId?.trim()
  if (synced)
    return synced

  return active ?? ''
}

export function kokoroProgressIsDownloadPhase(input: {
  voicesLoading: boolean
  modelOnDisk: boolean
  status: InferenceModelStatus | null
}): boolean {
  if (input.voicesLoading && input.modelOnDisk)
    return false

  if (input.status?.state === 'downloading' && input.modelOnDisk) {
    const hasByteProgress = input.status.progress?.loaded != null && input.status.progress.loaded > 0
    if (!hasByteProgress)
      return false
  }

  if (input.status && KOKORO_LOADING_STATES.has(input.status.state))
    return true

  return input.voicesLoading && !input.modelOnDisk
}

function kokoroDownloadingStatusLabel(
  labels: KokoroProgressLabels,
  percent: number,
  hasByteProgress: boolean,
): string {
  if (hasByteProgress || percent > 0)
    return labels.downloadingPercent(Math.round(percent))

  return labels.downloadingModel
}

function kokoroDownloadProgressMessage(
  labels: KokoroProgressLabels,
  synced: KokoroDownloadProgressSnapshot | null,
  speechModelId: string,
): string | null {
  if (!synced || synced.speechModelId !== speechModelId)
    return null

  if (synced.state === 'downloading') {
    const hasByteProgress = synced.loaded != null && synced.loaded > 0
    return kokoroDownloadingStatusLabel(labels, synced.percent, hasByteProgress)
  }

  if (synced.state === 'compiling')
    return labels.compiling
  if (synced.state === 'warming-up')
    return labels.warmingUp

  return null
}

export function kokoroProgressMessage(
  labels: KokoroProgressLabels,
  synced: KokoroDownloadProgressSnapshot | null,
  speechModelId: string,
  status: InferenceModelStatus | null,
  voicesLoading: boolean,
  modelOnDisk: boolean,
  cancelling: boolean,
): string {
  if (cancelling)
    return labels.cancellingDownload

  // A size already on disk is loading voices, not downloading again.
  if (voicesLoading && modelOnDisk)
    return labels.loadingVoices

  if (
    modelOnDisk
    && status?.state === 'downloading'
    && (status.progress?.loaded == null || !(status.progress.loaded > 0))
  ) {
    return labels.loadingVoices
  }

  const syncedMessage = kokoroDownloadProgressMessage(labels, synced, speechModelId)
  if (syncedMessage)
    return syncedMessage

  if (status && KOKORO_LOADING_STATES.has(status.state)) {
    if (status.state === 'downloading') {
      const progress = status.progress
      const percent = progress ? resolveProgressPercent(progress) : -1
      const hasByteProgress = progress?.loaded != null && progress.loaded > 0
      return kokoroDownloadingStatusLabel(labels, percent >= 0 ? percent : 0, hasByteProgress)
    }

    if (status.state === 'compiling')
      return labels.compiling
    if (status.state === 'warming-up')
      return labels.warmingUp
  }

  if (voicesLoading && !modelOnDisk)
    return labels.downloadingModel

  if (voicesLoading)
    return labels.loadingVoices

  return ''
}
