export const PROVIDER_API_KEY_MIN_LENGTH = 8

export function hasValidatableApiKey(apiKey: unknown): boolean {
  if (typeof apiKey !== 'string')
    return false
  return apiKey.trim().length >= PROVIDER_API_KEY_MIN_LENGTH
}
