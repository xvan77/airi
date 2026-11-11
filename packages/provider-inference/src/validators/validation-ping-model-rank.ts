/**
 * Lower scores are lighter chat models. Ping tries lighter models first on every provider.
 */
export function validationPingModelWeight(modelId: string): number {
  const id = modelId.toLowerCase()
  let weight = 0

  if (id.includes('lite'))
    weight -= 50
  if (id.includes('nano') || id.includes('mini'))
    weight -= 40
  if (id.includes('small') || id.includes('tiny'))
    weight -= 35
  if (id.includes('fast') || id.includes('instant'))
    weight -= 25
  if (id.includes('flash') && !id.includes('flash-lite'))
    weight -= 20
  if (id.includes('haiku'))
    weight -= 30

  if (id.includes('pro'))
    weight += 35
  if (id.includes('ultra') || id.includes('opus') || id.includes('large'))
    weight += 45
  if (id.includes('max') && !id.includes('max_tokens'))
    weight += 40
  if (id.includes('turbo') && id.includes('128k'))
    weight += 15

  const geminiVersion = id.match(/gemini-(\d+)\.(\d+)/u)
  if (geminiVersion) {
    weight += Number(geminiVersion[1]) * 4 + Number(geminiVersion[2]) * 6
  }

  const paramScale = id.match(/(?:^|\D)(\d+(?:\.\d+)?)(m|b)(?:\b|[-_:])/iu)
  if (paramScale) {
    const value = Number(paramScale[1])
    const billions = paramScale[2]!.toLowerCase() === 'm' ? value / 1000 : value
    weight += billions * 4
  }

  return weight
}

export function compareValidationPingModels(left: string, right: string): number {
  const weightDiff = validationPingModelWeight(left) - validationPingModelWeight(right)
  if (weightDiff !== 0)
    return weightDiff
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}

export function sortValidationPingModels(modelIds: readonly string[]): string[] {
  return [...modelIds].sort(compareValidationPingModels)
}
