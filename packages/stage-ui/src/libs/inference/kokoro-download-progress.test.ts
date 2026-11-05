import { describe, expect, it } from 'vitest'

import { kokoroSpeechModelIdForStatusId, publishKokoroDownloadProgress, registerKokoroDownloadProgressSetter } from './kokoro-download-progress'

describe('kokoroSpeechModelIdForStatusId', () => {
  it('maps adapter status ids to speech model ids', () => {
    expect(kokoroSpeechModelIdForStatusId('kokoro-q4')).toBe('q4')
    expect(kokoroSpeechModelIdForStatusId('kokoro-q4f16')).toBe('q4f16')
    expect(kokoroSpeechModelIdForStatusId('kokoro-fp16')).toBe('fp16')
  })
})

describe('publishKokoroDownloadProgress', () => {
  it('forwards updates through the registered setter', () => {
    let latest: unknown = 'unset'
    registerKokoroDownloadProgressSetter((update) => {
      latest = update
    })
    publishKokoroDownloadProgress({ speechModelId: 'q4', state: 'downloading', percent: 12, recordedAt: Date.now() })
    expect(latest).toEqual(expect.objectContaining({ speechModelId: 'q4', state: 'downloading', percent: 12 }))
    registerKokoroDownloadProgressSetter(null)
  })
})
