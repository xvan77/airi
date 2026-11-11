import { isOpenAiNoApiCreditsError } from './provider-api-credits-error'

const CHAT_COMPLETIONS_CHECK_PREFIX = /^chat completions check failed:\s*/iu

/**
 * Returns a short user-facing ping failure line when the provider error is recognized.
 * Otherwise returns null and the caller can keep the original reason.
 */
export function formatProviderPingFailureReason(
  reason: string,
  translate: (key: string) => string,
): string {
  const trimmed = reason.trim()
  if (!trimmed)
    return trimmed

  const withoutPrefix = trimmed.replace(CHAT_COMPLETIONS_CHECK_PREFIX, '')
  const haystack = `${trimmed}\n${withoutPrefix}`

  if (isOpenAiNoApiCreditsError(haystack)) {
    return translate('settings.dialogs.onboarding.pingFailedNoApiCredits')
  }

  return trimmed
}
