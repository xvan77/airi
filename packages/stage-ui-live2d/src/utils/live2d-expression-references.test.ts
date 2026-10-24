import type { Live2DArchiveMetadataSettings } from './live2d-zip-loader'

import { describe, expect, it } from 'vitest'

import { expressionReferencesFromArchiveSettings } from './live2d-expression-references'

describe('expressionReferencesFromArchiveSettings', () => {
  it('prefers model3.json expression entries over zip file stems', () => {
    const references = expressionReferencesFromArchiveSettings({
      expressions: [{ Name: 'Alt Manta', File: 'Custom Manta/Alt_Manta.exp3.json' }],
      _expFiles: [{ name: 'Alt_Manta', fileName: 'Custom Manta/Alt_Manta.exp3.json', data: {} }],
    } as Live2DArchiveMetadataSettings & { expressions: Array<{ Name: string, File: string }> })

    expect(references).toEqual([{
      name: 'Alt Manta',
      fileName: 'Custom Manta/Alt_Manta.exp3.json',
    }])
  })
})
