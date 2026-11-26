import { formatChatProviderErrorContent } from './chat-provider-error-message'

function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function firstFailureSentence(text: string): string {
  const normalized = text.replace(/^Validation error:\s*/iu, '').trim()
  const paragraph = normalized.split(/\n\n/u)[0] ?? normalized
  return (paragraph.split('\n')[0] ?? paragraph).trim()
}

/**
 * Returns a short user-facing line for provider settings validation and ping failures.
 */
export function formatProviderPingFailureReason(
  reason: string,
  translate: (key: string) => string,
): string {
  const stripped = stripMarkup(reason.trim())
  if (!stripped)
    return stripped

  const candidate = stripped.includes('\n') || stripped.length > 220
    ? firstFailureSentence(stripped)
    : stripped

  const formatted = formatChatProviderErrorContent(
    candidate,
    (key) => {
      if (key === 'stage.chat.errors.openai_no_api_credits')
        return translate('settings.dialogs.onboarding.pingFailedNoApiCredits')
      return translate(key)
    },
    translate('settings.dialogs.onboarding.pingFailedGeneric'),
  )

  if (formatted === candidate && /remote sent \d{3}|connectivity check failed:/iu.test(candidate))
    return translate('settings.dialogs.onboarding.pingFailedGeneric')

  if (formatted === candidate && /failed to reach|failed to fetch|validation error:/iu.test(candidate))
    return translate('settings.dialogs.onboarding.pingFailedReachProgram')

  return formatted
}
