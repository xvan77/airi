export const OPENAI_NO_API_CREDITS_PATTERNS = [
  /credit_balance_exhausted/iu,
  /insufficient_quota/iu,
  /no credits remaining/iu,
] as const

export function isOpenAiNoApiCreditsError(detail: string): boolean {
  const text = detail.trim()
  if (!text)
    return false
  return OPENAI_NO_API_CREDITS_PATTERNS.some(pattern => pattern.test(text))
}
