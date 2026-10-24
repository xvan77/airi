import type { Cubism4ModelSettings } from 'pixi-live2d-display/cubism4'

import type { Live2DArchiveMetadataSettings } from './live2d-zip-loader'

export interface Live2DExpressionFileReference {
  name: string
  fileName: string
}

/** Uses model3.json expression entries when present, like stage `Model.vue`. */
export function expressionReferencesFromArchiveSettings(
  settings: Live2DArchiveMetadataSettings,
): Live2DExpressionFileReference[] {
  const cubismSettings = settings as Cubism4ModelSettings
  const fromManifest = (cubismSettings.expressions ?? []).map((expression: { Name: string, File: string }) => ({
    name: expression.Name,
    fileName: expression.File,
  }))
  if (fromManifest.length > 0)
    return fromManifest

  return (settings._expFiles ?? []).map(entry => ({
    name: entry.name,
    fileName: entry.fileName,
  }))
}
