import { errorMessageFrom } from '@moeru/std'
import { isExcludedFromUsableChatModel, nonChatModelHaystackMatches } from '@proj-airi/stage-shared/chat-model-eligibility'

import { isProviderInsufficientCreditsError } from './provider-api-credits-error'
import { isProviderAuthError } from './provider-auth-error'

export interface ChatProviderErrorContext {
  providerId?: string
  modelId?: string
}

export type ChatProviderErrorKind
  = | 'groq_free_tier_payload_too_large'
    | 'on_device_input_too_large'
    | 'openai_no_api_credits'
    | 'provider_auth_failed'
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

/** Merges message strings and provider payloads from thrown errors for UI formatting. */
export function collectChatProviderErrorDetail(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    const text = error.trim()
    return text || fallback
  }

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

  if (isProviderInsufficientCreditsError(text))
    return 'openai_no_api_credits'

  if (isProviderAuthError(text))
    return 'provider_auth_failed'

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
  provider_auth_failed: 'stage.chat.errors.provider_auth_failed',
  non_chat_model: 'stage.chat.errors.non_chat_model',
  rate_limited: 'stage.chat.errors.rate_limited',
  model_unavailable: 'stage.chat.errors.model_unavailable',
  model_retired: 'stage.chat.errors.model_retired',
  live_api_only: 'stage.chat.errors.live_api_only',
  tools_not_supported: 'stage.chat.errors.tools_not_supported',
}

const REMOTE_HTTP_PREFIX = /^Remote sent \d{3} response:\s*/iu
const SERVER_ERROR_PREFIX = /^Error from server:\s*/iu

function tryParseJsonValue(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
    return null
  try {
    return JSON.parse(trimmed)
  }
  catch {
    return null
  }
}

function pushHumanMessage(messages: string[], candidate: string) {
  const cleaned = cleanProviderMessageFragment(candidate)
  if (!cleaned || messages.includes(cleaned))
    return
  if (isTechnicalNoiseOnly(cleaned))
    return
  messages.push(cleaned)
}

function cleanProviderMessageFragment(text: string): string {
  let fragment = text.trim()
  if (!fragment)
    return ''

  fragment = fragment.replace(REMOTE_HTTP_PREFIX, '')
  fragment = fragment.replace(SERVER_ERROR_PREFIX, '')
  fragment = fragment.replace(/^Error\s+\d{3}\.\s*/iu, '')
  fragment = fragment.replace(/\bparser\s+\d+\s+failed\s+on\s+line\s+\d+\.?/giu, '')
  fragment = fragment.replace(
    /Function id\s+'[0-9a-f-]{36}'\s+is not found/iu,
    'That model or endpoint was not found on your account.',
  )
  fragment = fragment.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/giu, '')
  fragment = fragment.replace(/\(request id:[^)]+\)/giu, '')
  fragment = fragment.replace(/^\d{3}\s+[A-Z_]+(?::|\s+)/u, '')
  fragment = fragment.replace(/\s{2,}/g, ' ').trim()

  if (tryParseJsonValue(fragment))
    return ''

  return fragment
}

function isTechnicalNoiseOnly(text: string): boolean {
  if (/^Remote sent \d{3}/iu.test(text))
    return true
  if (/^Error from server$/iu.test(text))
    return true
  if (/^\d{3}$/u.test(text))
    return true
  if (text.startsWith('{') || text.startsWith('['))
    return true
  if (/^type\.googleapis\.com\//iu.test(text))
    return true
  return false
}

function collectHumanMessagesFromValue(value: unknown, messages: string[], depth = 0) {
  if (depth > 8)
    return

  if (typeof value === 'string') {
    pushHumanMessage(messages, value)
    return
  }

  if (!value || typeof value !== 'object')
    return

  const record = value as Record<string, unknown>
  for (const key of ['message', 'error_description', 'detail', 'msg', 'title'] as const) {
    if (typeof record[key] === 'string')
      pushHumanMessage(messages, record[key])
  }

  if (record.error)
    collectHumanMessagesFromValue(record.error, messages, depth + 1)
  if (record.data)
    collectHumanMessagesFromValue(record.data, messages, depth + 1)
  if (Array.isArray(record.errors)) {
    for (const item of record.errors)
      collectHumanMessagesFromValue(item, messages, depth + 1)
  }
}

/**
 * Pulls plain-language lines from a provider failure. HTTP codes, JSON envelopes, and UUIDs stay out.
 */
export function humanizeChatProviderErrorDetail(detail: string): string {
  const messages: string[] = []

  for (const part of detail.split('\n')) {
    const trimmed = part.trim()
    if (!trimmed)
      continue

    const withoutServerPrefix = trimmed.replace(SERVER_ERROR_PREFIX, '').trim()
    const parsed = tryParseJsonValue(withoutServerPrefix) ?? tryParseJsonValue(trimmed)
    if (parsed) {
      collectHumanMessagesFromValue(parsed, messages)
      continue
    }

    const jsonSuffixIndex = trimmed.indexOf('{')
    if (jsonSuffixIndex >= 0) {
      const parsedSuffix = tryParseJsonValue(trimmed.slice(jsonSuffixIndex))
      if (parsedSuffix) {
        collectHumanMessagesFromValue(parsedSuffix, messages)
        continue
      }
    }

    const afterRemote = trimmed.replace(REMOTE_HTTP_PREFIX, '').trim()
    const parsedPayload = tryParseJsonValue(afterRemote)
    if (parsedPayload) {
      collectHumanMessagesFromValue(parsedPayload, messages)
      continue
    }

    pushHumanMessage(messages, trimmed)
  }

  return messages.slice(0, 3).join('\n')
}

/**
 * Builds chat error bubble text. Classified failures use one translated summary line.
 * Unknown failures use one scrubbed provider sentence, not raw payloads.
 */
export function formatChatProviderErrorContent(
  error: unknown,
  translate: (key: string) => string,
  unknownFallback: string,
  context?: ChatProviderErrorContext,
): string {
  const detail = collectChatProviderErrorDetail(error, unknownFallback)
  const kind = classifyChatProviderError(detail, context)

  if (kind)
    return translate(CHAT_ERROR_I18N_KEYS[kind])

  const humanLine = humanizeChatProviderErrorDetail(detail).split('\n').find(line => line.trim())?.trim()
  return humanLine || unknownFallback
}
