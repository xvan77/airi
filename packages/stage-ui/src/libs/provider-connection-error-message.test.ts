import { describe, expect, it } from 'vitest'

import { formatProviderPingFailureReason } from './provider-connection-error-message'

describe('formatProviderPingFailureReason', () => {
  const translate = (key: string) => {
    if (key === 'settings.dialogs.onboarding.pingFailedNoApiCredits')
      return 'No API credits'
    if (key === 'stage.chat.errors.provider_auth_failed')
      return 'Enter a valid API key'
    if (key === 'settings.dialogs.onboarding.pingFailedGeneric')
      return 'Could not connect'
    if (key === 'settings.dialogs.onboarding.pingFailedReachProgram')
      return 'Could not reach program'
    return key
  }

  it('replaces OpenAI credit exhaustion JSON with a short message', () => {
    const raw = 'Chat completions check failed: Error from server: {"error":{"code":"credit_balance_exhausted","message":"You have no credits remaining."}}'
    expect(formatProviderPingFailureReason(raw, translate)).toBe('No API credits')
  })

  it('replaces combined connectivity and model list 401 failures', () => {
    const raw = 'Connectivity check failed: Authentication failed: HTTP 401; Model list check failed: Remote sent 401 response: {"error":{"message":"You must be signed in to access this resource","type":"invalid_request_error","param":null,"code":"unauthorized"}}'
    expect(formatProviderPingFailureReason(raw, translate)).toBe('Enter a valid API key')
    expect(formatProviderPingFailureReason(raw, translate)).not.toContain('Remote sent 401')
  })

  it('uses a generic line for unknown connectivity failures', () => {
    const raw = 'Connectivity check failed: Failed to fetch'
    expect(formatProviderPingFailureReason(raw, translate)).toBe('Could not connect')
  })

  it('collapses long local server failures to a short reach message', () => {
    const raw = 'Validation error: Failed to reach Ollama server, error: Failed to fetch occurred.\n\nCORS issue with <a href="https://example.com">guide</a>.'
    expect(formatProviderPingFailureReason(raw, translate)).toBe('Could not reach program')
    expect(formatProviderPingFailureReason(raw, translate)).not.toContain('CORS')
  })
})
