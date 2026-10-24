import { extractArtMeshColorsFromVTube, listVTubeColorRelatedKeys } from './vtube-artmesh-colors'

export interface Live2DVTubeZipMetadata {
  savedActiveExpressions: string[]
  artMeshColors: Record<string, string>
}

export function parseLive2DVTubeSidecar(text: string): Live2DVTubeZipMetadata {
  const vtubeData = JSON.parse(text) as Record<string, unknown>
  const artMeshColors = extractArtMeshColorsFromVTube(vtubeData)
  if (Object.keys(artMeshColors).length === 0) {
    console.warn(
      '[Live2D] .vtube.json parsed but no ArtMesh multiply/screen colors found. Related keys:',
      listVTubeColorRelatedKeys(vtubeData),
    )
  }

  const savedActiveExpressions = Array.isArray(vtubeData.SavedActiveExpressions)
    ? vtubeData.SavedActiveExpressions.filter((entry): entry is string => typeof entry === 'string')
    : []

  return { savedActiveExpressions, artMeshColors }
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function expressionMatchesSavedPath(
  expression: { name: string, fileName: string },
  savedPath: string,
): boolean {
  const savedBase = basename(savedPath).toLowerCase()
  const fileBase = basename(expression.fileName).toLowerCase()
  if (fileBase === savedBase)
    return true

  const normalizedSaved = normalizeArchivePath(savedPath)
  const normalizedFile = normalizeArchivePath(expression.fileName)
  if (normalizedFile === normalizedSaved || normalizedFile.endsWith(`/${normalizedSaved}`))
    return true

  const savedStem = savedBase.replace(/\.exp3\.json$/i, '')
  const fileStem = fileBase.replace(/\.exp3\.json$/i, '')
  return fileStem === savedStem || expression.name.toLowerCase() === savedStem
}

/** Maps VTube `SavedActiveExpressions` file paths to Live2D expression control names. */
export function resolveSavedExpressionNames(
  savedActiveExpressions: string[],
  expressions: Array<{ name: string, fileName: string }>,
): string[] {
  const names: string[] = []

  for (const savedPath of savedActiveExpressions) {
    const savedBase = basename(savedPath).toLowerCase()
    const candidates = expressions.filter(expression => expressionMatchesSavedPath(expression, savedPath))
    const match = candidates.find(expression => basename(expression.fileName).toLowerCase() === savedBase)
      ?? candidates.find(expression => normalizeArchivePath(expression.fileName).endsWith(`/${savedBase}`))
      ?? candidates[0]

    if (match)
      names.push(match.name)
  }

  return names
}
