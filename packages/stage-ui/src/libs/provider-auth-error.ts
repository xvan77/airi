export const PROVIDER_AUTH_FAILED_PATTERNS = [
  /invalid token/iu,
  /invalid api[- ]?key/iu,
  /incorrect api key/iu,
  /authentication failed/iu,
  /must be signed in/iu,
  /unauthorized/iu,
  /\b401\b/u,
] as const

export function isProviderAuthError(detail: string): boolean {
  const text = detail.trim()
  if (!text)
    return false
  return PROVIDER_AUTH_FAILED_PATTERNS.some(pattern => pattern.test(text))
}
