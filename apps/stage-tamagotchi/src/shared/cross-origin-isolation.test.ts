import { describe, expect, it } from 'vitest'

import { mergeCrossOriginIsolationHeaders } from './cross-origin-isolation'

describe('mergeCrossOriginIsolationHeaders', () => {
  it('adds the headers that allow several Kokoro threads', () => {
    expect(mergeCrossOriginIsolationHeaders({ 'Content-Type': ['text/html'] })).toEqual({
      'Content-Type': ['text/html'],
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['credentialless'],
    })
  })

  it('replaces an older isolation header', () => {
    expect(mergeCrossOriginIsolationHeaders({
      'cross-origin-embedder-policy': 'require-corp',
    })['cross-origin-embedder-policy']).toEqual(['credentialless'])
  })
})
