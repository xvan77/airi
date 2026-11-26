import { computed } from 'vue'

import { providerRequiresApiKey } from '../libs/provider-settings-kind'
import { useProviderStore } from '../stores/providers/provider'

export function useProviderSettingsPolicy(providerId: string) {
  const providersStore = useProviderStore()

  const showApiKey = computed(() => {
    const definition = providersStore.findProviderDefinition(providerId)
    return providerRequiresApiKey(definition)
  })

  const suppressValidationAlerts = computed(() => {
    const definition = providersStore.findProviderDefinition(providerId)
    return definition?.requiresCredentials === false
      && !definition.validationRequiredWhen
  })

  return {
    showApiKey,
    suppressValidationAlerts,
  }
}
