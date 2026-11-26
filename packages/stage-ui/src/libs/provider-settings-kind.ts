import type { ProviderDefinition } from './providers/types'

export type ProviderSettingsKind = 'cloud' | 'external' | 'in-app'

const PROVIDER_I18N_ALIASES: Record<string, string> = {
  'player2-speech': 'player2',
}

export function providerDefinitionIdForSettings(providerId: string): string {
  const stripped = providerId.startsWith('vision-') ? providerId.slice('vision-'.length) : providerId
  return PROVIDER_I18N_ALIASES[stripped] ?? stripped
}

export function providerRequiresApiKey(definition: ProviderDefinition | undefined): boolean {
  if (!definition)
    return true
  return definition.requiresCredentials !== false
}

export async function resolveProviderSettingsKind(
  definition: ProviderDefinition,
  config: Record<string, unknown>,
): Promise<ProviderSettingsKind> {
  if (definition.requiresCredentials !== false)
    return 'cloud'

  const when = definition.validationRequiredWhen
  if (!when)
    return 'in-app'

  const requiredNow = await when(config)
  const requiredEmpty = await when({})
  if (requiredNow || requiredEmpty)
    return 'external'

  return 'in-app'
}
