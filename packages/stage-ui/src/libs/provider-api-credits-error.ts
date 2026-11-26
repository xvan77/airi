export const OPENAI_NO_API_CREDITS_PATTERNS = [
  /credit_balance_exhausted/iu,
  /insufficient_quota/iu,
  /no credits remaining/iu,
] as const

export const PROVIDER_INSUFFICIENT_CREDITS_PATTERNS = [
  ...OPENAI_NO_API_CREDITS_PATTERNS,
  /requires more credits/iu,
  /can only afford/iu,
  /payment required/iu,
  /\b402\b/u,
  /insufficient flux/iu,
  /do not have credits left/iu,
  /no credits left/iu,
] as const

export function isOpenAiNoApiCreditsError(detail: string): boolean {
  return isProviderInsufficientCreditsError(detail)
}

export function isProviderInsufficientCreditsError(detail: string): boolean {
  const text = detail.trim()
  if (!text)
    return false
  return PROVIDER_INSUFFICIENT_CREDITS_PATTERNS.some(pattern => pattern.test(text))
}
