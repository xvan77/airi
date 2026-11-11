import { describe, expect, it } from 'vitest'

import { formatProviderPingFailureReason } from './provider-connection-error-message'

describe('formatProviderPingFailureReason', () => {
  const translate = (key: string) => key

  it('replaces OpenAI credit exhaustion JSON with a short message', () => {
    const raw = 'Chat completions check failed: Error from server: {"error":{"code":"credit_balance_exhausted","message":"You have no credits remaining."}}'
    expect(formatProviderPingFailureReason(raw, translate)).toBe('settings.dialogs.onboarding.pingFailedNoApiCredits')
  })

  it('keeps unknown errors unchanged', () => {
    const raw = 'Connectivity check failed: Failed to fetch'
    expect(formatProviderPingFailureReason(raw, translate)).toBe(raw)
  })
})
