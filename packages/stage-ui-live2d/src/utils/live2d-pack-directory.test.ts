import { describe, expect, it } from 'vitest'

import { inferLive2DArchiveNameFromFiles, packLive2DDirectoryFiles } from './live2d-pack-directory'
import { validateLive2DZip } from './live2d-validator'

function fileWithRelativePath(data: BlobPart, name: string, relativePath: string): File {
  const file = new File([data], name)
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('packLive2DDirectoryFiles', () => {
  it('preserves folder layout and passes Live2D validation', async () => {
    const files = [
      fileWithRelativePath(
        JSON.stringify({
          Version: 3,
          FileReferences: {
            Moc: 'avatar.moc3',
            Textures: ['textures/texture_00.png'],
          },
        }),
        'avatar.model3.json',
        'hiyori/model/avatar.model3.json',
      ),
      fileWithRelativePath(new Uint8Array([77, 79, 67, 51, 5]), 'avatar.moc3', 'hiyori/model/avatar.moc3'),
      fileWithRelativePath(new Uint8Array([1, 2, 3]), 'texture_00.png', 'hiyori/model/textures/texture_00.png'),
    ]

    expect(inferLive2DArchiveNameFromFiles(files)).toBe('hiyori')

    const zipFile = await packLive2DDirectoryFiles(files)
    expect(zipFile.name).toBe('hiyori.zip')

    const report = await validateLive2DZip(zipFile)
    expect(report.status).not.toBe('INVALID')
    expect(report.model.entryPoint).toBe('hiyori/model/avatar.model3.json')
  })

  it('skips macOS metadata folders', async () => {
    const files = [
      fileWithRelativePath('{}', 'avatar.model3.json', 'model/avatar.model3.json'),
      fileWithRelativePath(new Uint8Array([1]), '._avatar.model3.json', '__MACOSX/model/._avatar.model3.json'),
    ]

    const zipFile = await packLive2DDirectoryFiles(files, 'solo')
    const report = await validateLive2DZip(zipFile)
    expect(report.model.archiveFileCount).toBe(1)
    expect(report.model.entryPoint).toBe('model/avatar.model3.json')
  })
})
