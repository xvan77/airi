import { describe, expect, it } from 'vitest'

import { resolveSavedExpressionNames } from './live2d-vtube-sidecar'

describe('resolveSavedExpressionNames', () => {
  const expressions = [
    { name: 'Base Hiyori', fileName: 'Custom Hiyori/basehiyori.exp3.json' },
    { name: 'Preset 2 Hiyori ', fileName: 'Custom Hiyori/preset 2 hiyori.exp3.json' },
    { name: 'Catears', fileName: 'Custom Hiyori/catears.exp3.json' },
    { name: 'Catears2', fileName: 'Custom Hiyori/catears2.exp3.json' },
  ]

  it('maps each SavedActiveExpressions entry by file basename, in list order', () => {
    const names = resolveSavedExpressionNames(
      [
        'Catears.exp3.json',
        'catears2.exp3.json',
        'basehiyori.exp3.json',
        'preset 2 hiyori.exp3.json',
      ],
      expressions,
    )

    expect(names).toEqual(['Catears', 'Catears2', 'Base Hiyori', 'Preset 2 Hiyori '])
  })

  it('prefers an exact basename match over a display-name stem match', () => {
    const names = resolveSavedExpressionNames(['basehiyori.exp3.json'], expressions)
    expect(names).toEqual(['Base Hiyori'])
  })
})
