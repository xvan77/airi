import type {
  Live2DExpressionCoreModel,
  Live2DExpressionDefinition,
  Live2DExpressionParameterDefinition,
} from '../contexts/expressions'

export function applyExpressionParametersToCoreModel(
  coreModel: Live2DExpressionCoreModel,
  expressionParameters: readonly Live2DExpressionParameterDefinition[],
  getParameterDefault: (parameterId: string) => number,
): void {
  for (const parameter of expressionParameters) {
    const modelDefault = getParameterDefault(parameter.parameterId)
    let value = parameter.value
    if (parameter.blend === 'Add')
      value = modelDefault + value
    else if (parameter.blend === 'Multiply')
      value = coreModel.getParameterValueById(parameter.parameterId) * value

    coreModel.setParameterValueById(parameter.parameterId, value)
  }
}

/** Applies each expression in order, matching VTube Studio `SavedActiveExpressions` stacking. */
export function applyExpressionDefinitionStackToCoreModel(
  coreModel: Live2DExpressionCoreModel,
  definitions: readonly Live2DExpressionDefinition[],
  getParameterDefault: (parameterId: string) => number,
): void {
  for (const definition of definitions)
    applyExpressionParametersToCoreModel(coreModel, definition.parameters, getParameterDefault)
}

export function readCoreModelParameterDefault(
  coreModel: Live2DExpressionCoreModel,
  parameterId: string,
): number {
  const coreModelWithDefaultLookup = coreModel as Live2DExpressionCoreModel & {
    getParameterDefaultValueById?: (id: string) => number
  }
  const defaultValue = coreModelWithDefaultLookup.getParameterDefaultValueById?.(parameterId)
  return typeof defaultValue === 'number'
    ? defaultValue
    : coreModel.getParameterValueById(parameterId)
}
