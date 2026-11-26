import { describe, expect, it } from 'vitest'

import {
  classifyChatProviderError,
  formatChatProviderErrorContent,
  humanizeChatProviderErrorDetail,
  triggersCompactRequestsAutoEnable,
} from './chat-provider-error-message'

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

  it('maps Gemini free-tier speech quota dumps to the rate-limit summary only', () => {
    const detail = '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaDimensions":{"model":"gemini-2.5-flash-tts"},"quotaValue":"10"}]}]}}'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.rate_limited' ? 'Quota limit' : key,
      'Unknown',
    )

    expect(classifyChatProviderError(detail)).toBe('rate_limited')
    expect(content).toBe('Quota limit')
    expect(content).not.toContain('RESOURCE_EXHAUSTED')
    expect(content).not.toContain('quotaValue')
  })

  it('replaces OpenRouter function UUID noise with plain text on model errors', () => {
    const detail = 'Remote sent 404 response: Function id \'3e84ff75-527b-4491-8647-530406876074\' is not found'
    const human = humanizeChatProviderErrorDetail(detail)
    expect(human).toBe('That model or endpoint was not found on your account.')
    expect(human).not.toContain('404')
    expect(human).not.toContain('3e84ff75')
  })

  it('drops parser line noise but keeps the provider explanation', () => {
    const detail = 'Error 404. parser 2743 failed on line 71. You do not have credits left.'
    const human = humanizeChatProviderErrorDetail(detail)
    expect(human).toBe('You do not have credits left.')
    expect(human).not.toMatch(/parser/i)
    expect(human).not.toMatch(/404/)
  })

  it('returns only the summary when OpenRouter audio credit errors include JSON', () => {
    const detail = 'OpenRouter audio request failed: 402 {"error":{"message":"This request requires at least $0.50 in balance for audio output","code":402,"metadata":{"limit_source":"openrouter_credits","remedy_hint":"Add credits at https://openrouter.ai/settings/credits"}}}'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.openai_no_api_credits' ? 'No balance' : key,
      'Unknown',
    )
    expect(classifyChatProviderError(detail)).toBe('openai_no_api_credits')
    expect(content).toBe('No balance')
    expect(content).not.toContain('{"error"')
    expect(content).not.toContain('openrouter_credits')
  })

  it('classifies OpenRouter credit exhaustion from chat payloads', () => {
    const detail = 'This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 9179.'
    expect(classifyChatProviderError(detail)).toBe('openai_no_api_credits')
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.openai_no_api_credits' ? 'Out of credits' : key,
      'Unknown',
    )
    expect(content).toBe('Out of credits')
  })

  it('classifies invalid token responses as auth failures', () => {
    const detail = 'Remote sent 401 response: {"error":{"message":"invalid token (request id: 20261122125905370353524RoHdOTPW)","type":"cometapi_error"}}'
    expect(classifyChatProviderError(detail)).toBe('provider_auth_failed')
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.provider_auth_failed' ? 'Bad API key' : key,
      'Unknown',
    )
    expect(content).toBe('Bad API key')
  })

  it('appends scrubbed provider text after a model-unavailable summary', () => {
    const detail = 'Remote sent 404 response: No endpoints found that support tool use. Try disabling "builtIn_debugRandomNumber".'
    const content = formatChatProviderErrorContent(
      new Error(detail),
      key => key === 'stage.chat.errors.tools_not_supported' ? 'Tools not supported' : key,
      'Unknown',
    )
    expect(content).toBe('Tools not supported')
  })
})
