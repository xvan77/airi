import { describe, expect, it } from 'vitest'

import { providerRequiresApiKey, resolveProviderSettingsKind } from './provider-settings-kind'

describe('provider settings kind', () => {
  it('treats cloud providers as requiring an API key', () => {
    expect(providerRequiresApiKey({ requiresCredentials: true } as any)).toBe(true)
    expect(providerRequiresApiKey({} as any)).toBe(true)
  })

  it('treats local engines without credentials as in-app or external', async () => {
    expect(await resolveProviderSettingsKind({
      requiresCredentials: false,
    } as any, {})).toBe('in-app')

    expect(await resolveProviderSettingsKind({
      requiresCredentials: false,
      validationRequiredWhen: () => true,
    } as any, {})).toBe('external')

    expect(await resolveProviderSettingsKind({
      requiresCredentials: false,
      validationRequiredWhen: (config: { baseUrl?: string }) => Boolean(config.baseUrl?.trim()),
    } as any, { baseUrl: 'http://localhost:1234/v1/' })).toBe('external')
  })
})
