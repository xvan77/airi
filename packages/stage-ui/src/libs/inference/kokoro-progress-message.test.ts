import { describe, expect, it } from 'vitest'

import {
  kokoroProgressIsDownloadPhase,
  kokoroProgressMessage,
  resolveKokoroProgressSpeechModelId,
} from './kokoro-progress-message'

const labels = {
  cancellingDownload: 'Cancelling download...',
  loadingVoices: 'Loading voices...',
  downloadingModel: 'Downloading model...',
  downloadingPercent: (percent: number) => `Downloading model… ${percent}%`,
  compiling: 'Compiling shaders...',
  warmingUp: 'Warming up audio engine...',
}

describe('resolveKokoroProgressSpeechModelId', () => {
  it('prefers the browsed catalog card over sync and committed runtime models', () => {
    expect(resolveKokoroProgressSpeechModelId({
      syncedSpeechModelId: 'fp32',
      browsingSpeechModelId: 'q4f16',
      activeSpeechModelId: 'fp32',
    })).toBe('q4f16')
  })

  it('prefers the browsed catalog card over the committed runtime model', () => {
    expect(resolveKokoroProgressSpeechModelId({
      browsingSpeechModelId: 'q4f16',
      activeSpeechModelId: 'q4',
    })).toBe('q4f16')
  })

  it('hides progress ownership after Clear downloads until a size is picked', () => {
    expect(resolveKokoroProgressSpeechModelId({
      syncedSpeechModelId: 'fp32',
      browsingSpeechModelId: '',
      activeSpeechModelId: '',
      awaitingSizeChoice: true,
    })).toBe('')
  })
})

describe('kokoroProgressMessage', () => {
  // ROOT CAUSE:
  //
  // Progress used the committed runtime model, already on disk, so an undownloaded
  // browsed size still said Loading voices. Progress now follows the browsed size.
  it('says downloading model when the browsed size is not on disk yet', () => {
    expect(kokoroProgressMessage(
      labels,
      null,
      'q4f16',
      { modelId: 'kokoro-q4f16', state: 'downloading' } as never,
      true,
      false,
      false,
    )).toBe('Downloading model...')
  })

  it('says loading voices when the same size is already on disk', () => {
    expect(kokoroProgressMessage(
      labels,
      null,
      'q4',
      null,
      true,
      true,
      false,
    )).toBe('Loading voices...')
  })
})

describe('kokoroProgressIsDownloadPhase', () => {
  it('treats an undownloaded size with voices loading as a download', () => {
    expect(kokoroProgressIsDownloadPhase({
      voicesLoading: true,
      modelOnDisk: false,
      status: null,
    })).toBe(true)
  })

  it('does not treat a cached size voice load as a download', () => {
    expect(kokoroProgressIsDownloadPhase({
      voicesLoading: true,
      modelOnDisk: true,
      status: null,
    })).toBe(false)
  })
})
