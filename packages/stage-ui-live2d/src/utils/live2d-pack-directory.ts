import JSZip from 'jszip'

function isIgnoredArchivePath(filePath: string): boolean {
  return filePath
    .split('/')
    .some(segment => segment === '__MACOSX' || segment.startsWith('._'))
}

function archivePathForFile(file: File): string {
  const relative = file.webkitRelativePath
  if (relative.length > 0)
    return relative.replace(/\\/g, '/')
  return file.name
}

/** Name for the generated zip from the folder root in `webkitRelativePath`. */
export function inferLive2DArchiveNameFromFiles(files: readonly File[]): string {
  const first = files[0]
  if (!first)
    return 'live2d-model'

  const relative = first.webkitRelativePath
  if (relative.length > 0) {
    const root = relative.split(/[/\\]/)[0]
    if (root.length > 0)
      return root
  }

  return first.name.replace(/\.[^.]+$/, '') || 'live2d-model'
}

/**
 * Packs a browser folder selection into one Live2D zip so import uses the same path as manual zips.
 * Paths come from `webkitRelativePath` on each `File`.
 */
export async function packLive2DDirectoryFiles(
  files: readonly File[],
  archiveBaseName?: string,
): Promise<File> {
  if (files.length === 0)
    throw new Error('The folder has no files.')

  const zip = new JSZip()
  let added = 0

  for (const file of files) {
    const path = archivePathForFile(file)
    if (isIgnoredArchivePath(path))
      continue

    zip.file(path, await file.arrayBuffer())
    added += 1
  }

  if (added === 0)
    throw new Error('The folder has no usable model files (only system metadata was found).')

  const baseName = archiveBaseName ?? inferLive2DArchiveNameFromFiles(files)
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([bytes], `${baseName}.zip`, { type: 'application/zip', lastModified: Date.now() })
}
