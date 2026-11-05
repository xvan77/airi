import { describe, expect, it } from 'vitest'

import { buildKokoroCatalogRow, sortKokoroCatalogRows } from './kokoro'

describe('kokoro speech catalog', () => {
  it('sorts by disk size ascending by default', () => {
    const rows = [
      buildKokoroCatalogRow({ id: 'fp32', name: 'FP32', provider: 'kokoro-local', description: '' }),
      buildKokoroCatalogRow({ id: 'q4', name: 'Q4', provider: 'kokoro-local', description: '' }),
    ]

    const sorted = sortKokoroCatalogRows(rows, 'disk', 'asc')
    expect(sorted.map(row => row.model.id)).toEqual(['q4', 'fp32'])
  })
})
