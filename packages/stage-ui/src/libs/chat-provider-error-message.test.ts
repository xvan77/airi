import { describe, expect, it } from 'vitest'

import { classifyChatProviderError, formatChatProviderErrorContent, triggersCompactRequestsAutoEnable } from './chat-provider-error-message'

describe('chat provider error message', () => {
  it('detects OpenRouter shared-pool rate limits', () => {
    const detail = 'Remote sent 429 response: {"error":{"metadata":{"raw":"liquid/lfm-2.5-2.6b:free is temporarily rate-limited upstream"}}}'
    expect(classifyChatProviderError(detail)).toBe('rate_limited')
  })

  it('detects Nvidia model not found on OpenRouter', () => {
    const detail = 'Remote sent 404 response: Function id \'3e84ff75-527b-4491-8647-530406876074\' is not found'
    expect(classifyChatProviderError(detail)).toBe('model_unavailable')
  })

  it('detects Google Gemini models retired for new API users', () => {
    const detail = 'This model models/gemini-2.5-flash is no longer available to new users.'
    expect(classifyChatProviderError(detail)).toBe('model_retired')
  })

  it('detects Google quota exhaustion as rate limited', () => {
    const detail = '429 RESOURCE_EXHAUSTED quota exceeded for metric generativelanguage.googleapis.com'
    expect(classifyChatProviderError(detail)).toBe('rate_limited')
  })

  it('detects Groq free-tier payload too large before generic rate limits', () => {
    const detail = 'Remote sent 413 response: {"error":{"message":"Request too large for model `openai/gpt-oss-20b` in organization `org_test` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 10585","code":"rate_limit_exceeded"}}'
    expect(classifyChatProviderError(detail)).toBe('groq_free_tier_payload_too_large')
    expect(triggersCompactRequestsAutoEnable(detail)).toBe(true)
  })

  it('triggers compact requests from a generic limit line', () => {
    expect(triggersCompactRequestsAutoEnable('Limit 8000, Requested 9830')).toBe(true)
    expect(triggersCompactRequestsAutoEnable('Limit 8000, Requested 7000')).toBe(false)
  })

  it('detects Chrome Prompt API input size errors', () => {
    const detail = 'The input is too large.'
    expect(classifyChatProviderError(detail)).toBe('on_device_input_too_large')
    expect(triggersCompactRequestsAutoEnable(detail)).toBe(true)
  })

  it('detects Gemini Live native audio models', () => {
    const detail = 'models/gemini-2.5-flash-native-audio-latest only supports real-time bidirectional streaming via WebSocket (bidiGenerateContent).'
    expect(classifyChatProviderError(detail)).toBe('live_api_only')
  })

  it('detects tool compatibility routing failures', () => {
    const detail = 'Remote sent 404 response: No endpoints found that support tool use. Try disabling "builtIn_debugRandomNumber".'
    expect(classifyChatProviderError(detail)).toBe('tools_not_supported')
  })

  it('maps OpenAI credit exhaustion to the ping-style summary without raw JSON', () => {
    const detail = 'Error from server: {"error":{"code":"credit_balance_exhausted","message":"You have no credits remaining."}}'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.openai_no_api_credits' ? 'No OpenAI credits' : key,
      'Unknown',
    )
    expect(classifyChatProviderError(detail)).toBe('openai_no_api_credits')
    expect(content).toBe('No OpenAI credits')
    expect(content).not.toContain('credit_balance_exhausted')
  })

  it('still classifies nested provider payloads on shallow error messages', () => {
    const error = Object.assign(new Error('Error from server'), {
      data: { error: { code: 'insufficient_quota', message: 'You exceeded your current quota.' } },
    })
    const content = formatChatProviderErrorContent(
      error,
      key => key === 'stage.chat.errors.openai_no_api_credits' ? 'No credits' : key,
      'Unknown',
    )
    expect(content).toBe('No credits')
  })

  it('maps excluded media models and 400 responses to the non-chat summary', () => {
    const detail = 'Remote sent 400 response'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.non_chat_model' ? 'Pick a chat model' : key,
      'Unknown',
      { providerId: 'xai', modelId: 'grok-imagine-image-2.0' },
    )
    expect(classifyChatProviderError(detail, { providerId: 'xai', modelId: 'grok-imagine-image-2.0' })).toBe('non_chat_model')
    expect(content).toBe('Pick a chat model')
  })

  it('prefixes a friendly summary before the raw provider message', () => {
    const detail = 'Remote sent 429 response: rate limit'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.rate_limited' ? 'Friendly rate limit' : key,
      'Unknown',
    )

    expect(content.startsWith('Friendly rate limit\n\n')).toBe(true)
    expect(content).toContain(detail)
  })
})
