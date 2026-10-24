import type { PixiLive2DInternalModel } from '../composables/live2d/motion-manager'
import type { Live2DExpressionCoreModel, Live2DExpressionDefinition } from '../contexts/expressions'
import type { Live2DExpressionFileReference } from './live2d-expression-references'

import { parseLive2DExpression } from '../contexts/expressions'
import {
  applyExpressionDefinitionStackToCoreModel,
  readCoreModelParameterDefault,
} from './apply-expression-stack'
import { resolveSavedExpressionNames } from './live2d-vtube-sidecar'

export function describeVtubeSavedExpressionStack(
  savedActiveExpressions: readonly string[],
  expFiles: ReadonlyArray<{ name: string, fileName: string, data: unknown }>,
  expressionReferences?: readonly Live2DExpressionFileReference[],
): { savedPaths: number, expFilesInZip: number, resolvedNames: string[], definitionCount: number } {
  const references = resolveExpressionReferences(expressionReferences, expFiles)
  const definitions = buildVtubeSavedExpressionDefinitions(savedActiveExpressions, expFiles, references)
  const resolvedNames = resolveSavedExpressionNames([...savedActiveExpressions], references)

  return {
    savedPaths: savedActiveExpressions.length,
    expFilesInZip: expFiles.length,
    resolvedNames,
    definitionCount: definitions.length,
  }
}

function resolveExpressionReferences(
  expressionReferences: readonly Live2DExpressionFileReference[] | undefined,
  expFiles: ReadonlyArray<{ name: string, fileName: string }>,
): Live2DExpressionFileReference[] {
  if (expressionReferences?.length)
    return [...expressionReferences]
  return expFiles.map(entry => ({ name: entry.name, fileName: entry.fileName }))
}

function findExpFileForReference(
  name: string,
  reference: Live2DExpressionFileReference | undefined,
  expFiles: ReadonlyArray<{ name: string, fileName: string, data: unknown }>,
) {
  const byName = expFiles.find(file => file.name === name)
  if (byName)
    return byName

  if (!reference)
    return undefined

  const refFile = reference.fileName.replace(/\\/g, '/').toLowerCase()
  return expFiles.find((file) => {
    const fileName = file.fileName.replace(/\\/g, '/').toLowerCase()
    return fileName === refFile || fileName.endsWith(`/${refFile}`)
  })
}

function buildVtubeSavedExpressionDefinitions(
  savedActiveExpressions: readonly string[],
  expFiles: ReadonlyArray<{ name: string, fileName: string, data: unknown }>,
  expressionReferences?: readonly Live2DExpressionFileReference[],
): Live2DExpressionDefinition[] {
  if (savedActiveExpressions.length === 0 || expFiles.length === 0)
    return []

  const references = resolveExpressionReferences(expressionReferences, expFiles)
  const names = resolveSavedExpressionNames([...savedActiveExpressions], references)

  return names.flatMap((name) => {
    const reference = references.find(entry => entry.name === name)
    const entry = findExpFileForReference(name, reference, expFiles)
    if (!entry?.data)
      return []

    try {
      return [parseLive2DExpression(name, entry.fileName, JSON.stringify(entry.data))]
    }
    catch {
      return []
    }
  })
}

export function applyVtubeSavedExpressionStack(
  coreModel: Live2DExpressionCoreModel,
  savedActiveExpressions: readonly string[],
  expFiles: ReadonlyArray<{ name: string, fileName: string, data: unknown }>,
  expressionReferences?: readonly Live2DExpressionFileReference[],
): void {
  const definitions = buildVtubeSavedExpressionDefinitions(savedActiveExpressions, expFiles, expressionReferences)
  if (definitions.length === 0)
    return

  applyExpressionDefinitionStackToCoreModel(
    coreModel,
    definitions,
    parameterId => readCoreModelParameterDefault(coreModel, parameterId),
  )
}

/**
 * Re-applies the VTube expression stack after each `internalModel.update()`, like the stage
 * expression motion plugin. Idle motion otherwise overwrites one-shot parameter writes.
 */
export function hookVtubeSavedExpressionsAfterModelUpdate(
  internalModel: PixiLive2DInternalModel,
  savedActiveExpressions: readonly string[],
  expFiles: ReadonlyArray<{ name: string, fileName: string, data: unknown }>,
  expressionReferences?: readonly Live2DExpressionFileReference[],
): void {
  const definitions = buildVtubeSavedExpressionDefinitions(savedActiveExpressions, expFiles, expressionReferences)
  if (definitions.length === 0)
    return

  const originalUpdate = internalModel.update.bind(internalModel)
  internalModel.update = function (dt: number, now: number) {
    originalUpdate(dt, now)
    applyExpressionDefinitionStackToCoreModel(
      internalModel.coreModel,
      definitions,
      parameterId => readCoreModelParameterDefault(internalModel.coreModel, parameterId),
    )
  }
}
