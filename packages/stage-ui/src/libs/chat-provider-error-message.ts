import { errorMessageFrom } from '@moeru/std'
import { isExcludedFromUsableChatModel, nonChatModelHaystackMatches } from '@proj-airi/stage-shared/chat-model-eligibility'

import { isOpenAiNoApiCreditsError } from './provider-api-credits-error'

export interface ChatProviderErrorContext {
  providerId?: string
  modelId?: string
}

export type ChatProviderErrorKind
  = | 'groq_free_tier_payload_too_large'
    | 'on_device_input_too_large'
    | 'openai_no_api_credits'
    | 'non_chat_model'
    | 'rate_limited'
    | 'model_unavailable'
    | 'model_retired'
    | 'live_api_only'
    | 'tools_not_supported'

const ON_DEVICE_INPUT_TOO_LARGE_PATTERNS = [
  /the input is too large/iu,
  /input (is )?too large/iu,
] as const

const GROQ_FREE_TIER_PAYLOAD_PATTERNS = [
  /request too large for model/iu,
  /service tier `on_demand`/iu,
] as const

const RATE_LIMIT_PATTERNS = [
  /\b429\b/u,
  /too many requests/iu,
  /rate[- ]limit/iu,
  /model_rate_limit_exceeded/iu,
  /rate_limit_exceeded/iu,
  /temporarily rate-limited/iu,
  /heavy demand/iu,
  /quota exceeded/iu,
  /exceeded your current quota/iu,
  /resource_exhausted/iu,
] as const

const TOOLS_NOT_SUPPORTED_PATTERNS = [
  /no endpoints found that support tool use/iu,
  /filter by tool compatibility/iu,
  /builtIn_debugRandomNumber/iu,
] as const

const MODEL_RETIRED_PATTERNS = [
  /no longer available to new users/iu,
] as const

const LIVE_API_ONLY_PATTERNS = [
  /bidigeneratecontent/iu,
  /bidirectional streaming/iu,
  /gemini live api/iu,
  /only supports real-time bidirectional/iu,
] as const

const MODEL_UNAVAILABLE_PATTERNS = [
  /\b404\b/u,
  /not found/iu,
  /no endpoints found/iu,
  /function id/iu,
  /specified function in account/iu,
  /provider returned error/iu,
] as const

const NON_CHAT_MODEL_RESPONSE_PATTERNS = [
  /remote sent 400 response/iu,
  /\b400\b/u,
  /not (support|available).{0,40}(chat|text)/iu,
  /does not support chat/iu,
  /chat completion(s)?\s+(is\s+)?not\s+supported/iu,
  /invalid model/i,
  /imagine-/iu,
] as const

/**
 * Returns true when the provider rejected the request for exceeding a token or payload limit.
 * Used to turn on compact requests after the first failure.
 */
export function triggersCompactRequestsAutoEnable(detail: string): boolean {
  const text = detail.trim()
  if (!text)
    return false

  const kind = classifyChatProviderError(text)
  if (kind === 'groq_free_tier_payload_too_large' || kind === 'on_device_input_too_large')
    return true

  const match = text.match(/limit\s+(\d+)\D+requested\s+(\d+)/iu)
  if (!match)
    return false

  return Number(match[2]) > Number(match[1])
}

function collectChatProviderErrorDetail(error: unknown, fallback: string): string {
  const parts: string[] = []
  const push = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed && !parts.includes(trimmed))
        parts.push(trimmed)
      return
    }
    if (!value || typeof value !== 'object')
      return
    try {
      const serialized = JSON.stringify(value)
      if (serialized && serialized !== '{}' && !parts.includes(serialized))
        parts.push(serialized)
    }
    catch {
      // NOTICE:
      // Some provider errors carry circular structures.
      // Classification can still use the message string above.
    }
  }

  push(errorMessageFrom(error))

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    push(record.cause)
    push(record.data)
    push(record.body)
    push(record.error)
    if (record.response && typeof record.response === 'object') {
      const response = record.response as Record<string, unknown>
      push(response.data)
      push(response.body)
    }
  }

  const joined = parts.join('\n')
  return joined || fallback
}

function isNonChatModelFailure(detail: string, context?: ChatProviderErrorContext): boolean {
  const text = detail.trim()
  if (!text)
    return false

  if (context?.modelId && context.providerId) {
    const ref = { id: context.modelId, name: '' }
    if (isExcludedFromUsableChatModel(ref, context.providerId)
      && NON_CHAT_MODEL_RESPONSE_PATTERNS.some(pattern => pattern.test(text))) {
      return true
    }
  }

  if (nonChatModelHaystackMatches(text) && NON_CHAT_MODEL_RESPONSE_PATTERNS.some(pattern => pattern.test(text)))
    return true

  return false
}

export function classifyChatProviderError(detail: string, context?: ChatProviderErrorContext): ChatProviderErrorKind | null {
  const text = detail.trim()
  if (!text)
    return null

  if (GROQ_FREE_TIER_PAYLOAD_PATTERNS.every(pattern => pattern.test(text)))
    return 'groq_free_tier_payload_too_large'

  if (ON_DEVICE_INPUT_TOO_LARGE_PATTERNS.some(pattern => pattern.test(text)))
    return 'on_device_input_too_large'

  if (isOpenAiNoApiCreditsError(text))
    return 'openai_no_api_credits'

  if (isNonChatModelFailure(text, context))
    return 'non_chat_model'

  if (RATE_LIMIT_PATTERNS.some(pattern => pattern.test(text)))
    return 'rate_limited'

  if (TOOLS_NOT_SUPPORTED_PATTERNS.some(pattern => pattern.test(text)))
    return 'tools_not_supported'

  if (MODEL_RETIRED_PATTERNS.some(pattern => pattern.test(text)))
    return 'model_retired'

  if (LIVE_API_ONLY_PATTERNS.some(pattern => pattern.test(text)))
    return 'live_api_only'

  if (MODEL_UNAVAILABLE_PATTERNS.some(pattern => pattern.test(text)))
    return 'model_unavailable'

  return null
}

const CHAT_ERROR_I18N_KEYS: Record<ChatProviderErrorKind, string> = {
  groq_free_tier_payload_too_large: 'stage.chat.errors.groq_free_tier_payload_too_large',
  on_device_input_too_large: 'stage.chat.errors.on_device_input_too_large',
  openai_no_api_credits: 'stage.chat.errors.openai_no_api_credits',
  non_chat_model: 'stage.chat.errors.non_chat_model',
  rate_limited: 'stage.chat.errors.rate_limited',
  model_unavailable: 'stage.chat.errors.model_unavailable',
  model_retired: 'stage.chat.errors.model_retired',
  live_api_only: 'stage.chat.errors.live_api_only',
  tools_not_supported: 'stage.chat.errors.tools_not_supported',
}

/**
 * Builds chat error bubble text. The first line is the user-facing summary.
 * A blank line and the raw provider message follow when the summary is friendly.
 */
export function formatChatProviderErrorContent(
  error: unknown,
  translate: (key: string) => string,
  unknownFallback: string,
  context?: ChatProviderErrorContext,
): string {
  const detail = collectChatProviderErrorDetail(error, unknownFallback)
  const kind = classifyChatProviderError(detail, context)

  if (kind) {
    const summary = translate(CHAT_ERROR_I18N_KEYS[kind])
    if (
      kind === 'openai_no_api_credits'
      || kind === 'non_chat_model'
      || kind === 'on_device_input_too_large'
      || kind === 'rate_limited'
    ) {
      return summary
    }
    return `${summary}\n\n${detail}`
  }

  return detail
}
