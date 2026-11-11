import type { ProviderChatPingProgressEvent, ProviderContext, ProviderDefinition, ProviderExtraMethods, ProviderInstance } from '../types'

import isNetworkError from 'is-network-error'

import { errorMessageFrom } from '@moeru/std'
import { isUsableChatModel, nonChatModelIdMatches } from '@proj-airi/stage-shared/chat-model-eligibility'
import { responses } from '@xsai-ext/responses'
import { generateText } from '@xsai/generate-text'
import { listModels } from '@xsai/model'
import { message } from '@xsai/utils-chat'
import { Mutex } from 'es-toolkit'

import { getGenerationProvider, isModelProvider, ProviderValidationCheck } from '../types'
import { compareValidationPingModels, sortValidationPingModels } from './validation-ping-model-rank'

const MAX_CHAT_PING_MODEL_ATTEMPTS = 32

interface OpenAICompatibleValidationOptions<TConfig extends { apiKey?: string, baseUrl?: string, model?: string }> {
  checks?: ProviderValidationCheck[]
  additionalHeaders?: Record<string, string>
  allowValidationWithoutModel?: boolean
  normalizeModelId?: (modelId: string) => string
  schedule?: {
    mode: 'once' | 'interval'
    intervalMs?: number
  }
  skipApiKeyCheck?: boolean
  connectivityFailureReason?: (input: { config: TConfig, error: unknown, errorMessage: string }) => string
  modelListFailureReason?: (input: { config: TConfig, error: unknown, errorMessage: string }) => string
  chatCompletionTokenParameter?: 'max_tokens' | 'max_completion_tokens'
  /** Ping resolves these ids from the catalog, then tries the lightest match first. */
  preferredValidationModelIds?: readonly string[]
  /** Provider id for the same usable-chat rules as the Consciousness catalog. */
  catalogProviderId?: string
}

function extractStatusCode(error: unknown): number | null {
  if (!error)
    return null

  const anyError = error as {
    cause?: {
      status?: unknown
      statusCode?: unknown
      response?: { status?: unknown }
    }
  }

  const candidates = [
    anyError.cause?.status,
    anyError.cause?.statusCode,
    anyError.cause?.response?.status,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number')
      return candidate
  }

  const message = errorMessageFrom(error) ?? ''
  const statusMatch = message.match(/\b(?:http\s*)?(\d{3})\b/i)
  if (statusMatch)
    return Number(statusMatch[1])

  return null
}

function trimApiKey(config: { apiKey?: string | null | undefined }) {
  return typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
}

function requestHeaders(config: { apiKey?: string | null | undefined }, additionalHeaders?: Record<string, string>) {
  const apiKey = trimApiKey(config)
  return {
    ...additionalHeaders,
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
}

function extractModelId(model: any): string {
  if (!model)
    return ''
  if (typeof model === 'string')
    return model
  if (typeof model.id === 'string')
    return model.id

  return ''
}

function shouldSkipModelId(modelId: string): boolean {
  const normalized = modelId.toLowerCase()
  if (nonChatModelIdMatches(modelId))
    return true
  return normalized.includes('models/gemini-2.5-pro')
}

function matchesPreferredValidationModelId(modelId: string, preferred: string): boolean {
  const normalized = modelId.toLowerCase()
  const needle = preferred.toLowerCase()
  return normalized === needle
    || normalized.endsWith(`/${needle}`)
    || normalized.includes(needle)
}

function buildValidationModelCandidates(
  candidates: string[],
  preferredIds: readonly string[] | undefined,
  configuredModel?: string,
): string[] {
  const configured = configuredModel?.trim()
  const preferredResolved: string[] = []

  if (preferredIds?.length) {
    for (const preferred of preferredIds) {
      const match = candidates.find(candidate => matchesPreferredValidationModelId(candidate, preferred))
      if (!match || preferredResolved.includes(match))
        continue
      preferredResolved.push(match)
    }
  }

  const preferredSet = new Set(preferredResolved)
  const remainder = candidates.filter(candidate => !preferredSet.has(candidate))

  const ordered: string[] = []
  const push = (modelId: string) => {
    if (!modelId || ordered.includes(modelId))
      return
    if (configured && modelId === configured)
      return
    ordered.push(modelId)
  }

  if (configured)
    ordered.push(configured)

  for (const modelId of sortValidationPingModels(preferredResolved))
    push(modelId)
  for (const modelId of sortValidationPingModels(remainder))
    push(modelId)

  return ordered.slice(0, MAX_CHAT_PING_MODEL_ATTEMPTS)
}

function emitChatPingProgress(
  context: Pick<ProviderContext, 'onChatPingProgress'> | undefined,
  event: ProviderChatPingProgressEvent,
) {
  context?.onChatPingProgress?.(event)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const filtered = signals.filter(signal => !signal.aborted)
  if (filtered.length === 0) {
    return AbortSignal.abort()
  }
  if (filtered.length === 1) {
    return filtered[0]!
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(filtered)
  }
  // NOTICE:
  // Very old runtimes lack AbortSignal.any. Merge with a fallback controller.
  // Root cause: single-signal path only without any().
  // Removal condition: Minimum supported Chromium has AbortSignal.any.
  const merged = new AbortController()
  const forward = () => merged.abort()
  for (const signal of filtered) {
    if (signal.aborted) {
      forward()
      break
    }
    signal.addEventListener('abort', forward, { once: true })
  }
  return merged.signal
}

function shouldTryNextPingModel(error: unknown): boolean {
  const message = (errorMessageFrom(error) ?? '').toLowerCase()
  const status = extractStatusCode(error)

  if (status === 401 || status === 403)
    return false

  if (message.includes('interactions api'))
    return true

  if (message.includes('no longer available'))
    return true

  if (message.includes('high demand'))
    return true

  if (message.includes('rate limit') || message.includes('rate-limit'))
    return true

  if (message.includes('temporarily') && message.includes('unavailable'))
    return true

  if (status === 404 || status === 429 || status === 503 || status === 502 || status === 408)
    return true

  if (message.includes('model_terms_required') || message.includes('terms acceptance'))
    return true

  return status === 400 && message.includes('invalid_argument')
}

function outputModalitiesOf(model: unknown): string[] {
  if (!model || typeof model !== 'object')
    return []

  const record = model as {
    architecture?: { output_modalities?: unknown }
    output_modalities?: unknown
    outputModalities?: unknown
  }
  const raw = record.architecture?.output_modalities ?? record.output_modalities ?? record.outputModalities
  if (!Array.isArray(raw))
    return []

  return raw.filter((value): value is string => typeof value === 'string')
}

/**
 * Ping must use a plain text chat model. Multimodal or media-output models can
 * return OpenRouter 402 credit errors even when the API key is valid.
 */
function isUnsuitableForChatPing(model: unknown): boolean {
  const modelId = extractModelId(model)
  if (!modelId || shouldSkipModelId(modelId))
    return true

  const outputs = outputModalitiesOf(model)
  if (outputs.length === 0)
    return false

  return outputs.some(modality => modality === 'image' || modality === 'video' || modality === 'audio')
}

function isFreeModelId(modelId: string): boolean {
  return modelId.toLowerCase().endsWith(':free')
}

function isFreePingModel(model: unknown): boolean {
  const modelId = extractModelId(model)
  if (isFreeModelId(modelId))
    return true

  if (!model || typeof model !== 'object')
    return false

  const pricing = (model as { pricing?: { prompt?: unknown, completion?: unknown } }).pricing
  if (!pricing)
    return false

  const prompt = Number(pricing.prompt)
  const completion = Number(pricing.completion)
  if (Number.isFinite(prompt) && Number.isFinite(completion))
    return prompt === 0 && completion === 0

  return false
}

function modelRefFromUnknown(model: unknown): { id: string, name: string } {
  const id = extractModelId(model)
  if (!model || typeof model !== 'object') {
    return { id, name: '' }
  }
  const record = model as { name?: string, display_name?: string }
  const name = typeof record.name === 'string'
    ? record.name
    : typeof record.display_name === 'string'
      ? record.display_name
      : ''
  return { id, name }
}

function isEligibleForChatPing(model: unknown, catalogProviderId: string | undefined): boolean {
  if (isUnsuitableForChatPing(model))
    return false
  const ref = modelRefFromUnknown(model)
  if (!ref.id)
    return false
  return isUsableChatModel(ref, catalogProviderId ?? '')
}

function rankChatPingModelsFromCatalog(models: unknown[], catalogProviderId: string | undefined): string[] {
  return [...models]
    .filter(model => isEligibleForChatPing(model, catalogProviderId))
    .sort((left, right) => {
      const leftFree = isFreePingModel(left) ? 0 : 1
      const rightFree = isFreePingModel(right) ? 0 : 1
      if (leftFree !== rightFree)
        return leftFree - rightFree
      return compareValidationPingModels(extractModelId(left), extractModelId(right))
    })
    .map(model => extractModelId(model))
    .filter(Boolean)
}

async function resolveModels<TConfig extends { apiKey?: string | null, baseUrl?: string | URL | null }>(
  config: TConfig,
  provider: ProviderInstance,
  providerExtra: ProviderExtraMethods<TConfig> | undefined,
) {
  if (providerExtra?.listModels) {
    return providerExtra.listModels(config, provider)
  }
  if (!isModelProvider(provider)) {
    return listModels({
      baseURL: config.baseUrl!,
      apiKey: trimApiKey(config),
      headers: requestHeaders(config),
    })
  }

  return listModels(provider.model())
}

async function pickValidationModelCandidates<TConfig extends { apiKey?: string | null, baseUrl?: string | URL | null, model?: string }>(
  config: TConfig,
  provider: ProviderInstance,
  providerExtra: ProviderExtraMethods<TConfig> | undefined,
  preferredValidationModelIds?: readonly string[],
  catalogProviderId?: string,
): Promise<string[]> {
  const configuredModel = typeof config.model === 'string'
    ? config.model.trim()
    : ''

  if (
    configuredModel
    && !isUnsuitableForChatPing(configuredModel)
    && isUsableChatModel({ id: configuredModel, name: '' }, catalogProviderId ?? '')
  ) {
    return [configuredModel]
  }

  try {
    const models = await resolveModels(config, provider, providerExtra)
    const candidates = rankChatPingModelsFromCatalog(models, catalogProviderId)
    return buildValidationModelCandidates(candidates, preferredValidationModelIds)
  }
  catch {
    return configuredModel ? [configuredModel] : []
  }
}

export function createOpenAICompatibleValidators<TConfig extends { apiKey?: string, baseUrl?: string, model?: string }>(
  options?: OpenAICompatibleValidationOptions<TConfig>,
): ProviderDefinition<TConfig>['validators'] {
  const checks = options?.checks ?? [ProviderValidationCheck.Connectivity, ProviderValidationCheck.ModelList]
  const additionalHeaders = options?.additionalHeaders
  const missingValidationModelReason = 'No model available for validation. Configure a model manually and try again.'

  interface ChatCheckResult {
    connectivityOk: boolean
    chatOk: boolean
    errorMessage?: string
    error?: unknown
  }

  async function runChatCheck(
    config: TConfig,
    provider: ProviderInstance,
    providerExtra: ProviderExtraMethods<TConfig> | undefined,
    contextOptions?: Pick<ProviderContext, 'onChatPingProgress' | 'chatPingRunHandles'>,
  ): Promise<ChatCheckResult> {
    const candidates = await pickValidationModelCandidates(
      config,
      provider,
      providerExtra,
      options?.preferredValidationModelIds,
      options?.catalogProviderId,
    )

    if (candidates.length === 0) {
      if (options?.allowValidationWithoutModel) {
        return { connectivityOk: true, chatOk: true }
      }

      return {
        connectivityOk: false,
        chatOk: false,
        errorMessage: missingValidationModelReason,
      }
    }

    emitChatPingProgress(contextOptions, {
      phase: 'start',
      attempt: 0,
      totalAttempts: candidates.length,
    })

    let lastError: unknown
    let lastErrorMessage = ''
    const pingHandles = contextOptions?.chatPingRunHandles

    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index]!
      const normalizedModel = options?.normalizeModelId?.(candidate) ?? candidate
      const generation = getGenerationProvider(provider)?.generation(normalizedModel)

      if (pingHandles) {
        pingHandles.attemptAbortController.abort()
        pingHandles.attemptAbortController = new AbortController()
      }
      const attemptMergedSignal = pingHandles
        ? mergeAbortSignals([
            pingHandles.runAbortController.signal,
            pingHandles.attemptAbortController.signal,
          ])
        : undefined

      emitChatPingProgress(contextOptions, {
        phase: 'try',
        attempt: index + 1,
        totalAttempts: candidates.length,
        modelId: normalizedModel,
      })

      try {
        if (generation?.protocol === 'responses') {
          const result = responses({
            ...generation.config,
            input: 'ping',
            maxOutputTokens: 16,
            store: false,
            headers: requestHeaders(config, additionalHeaders),
            ...(attemptMergedSignal ? { abortSignal: attemptMergedSignal } : {}),
          })
          await Promise.all([result.steps, result.input, result.usage, result.totalUsage])
          emitChatPingProgress(contextOptions, {
            phase: 'success',
            attempt: index + 1,
            totalAttempts: candidates.length,
            modelId: normalizedModel,
          })
          return { connectivityOk: true, chatOk: true }
        }
        const apiKey = trimApiKey(config)
        await generateText({
          apiKey,
          baseURL: config.baseUrl!,
          headers: requestHeaders(config, additionalHeaders),
          model: normalizedModel,
          messages: message.messages(message.user('ping')),
          ...(attemptMergedSignal ? { abortSignal: attemptMergedSignal } : {}),
          // NOTICE:
          // Some OpenAI-compatible providers reject output limits below 16.
          // OpenRouter documents this minimum for some upstream providers.
          // Source/context: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
          // Removal condition: All supported providers accept lower limits, or the probe learns each model's minimum.
          ...(options?.chatCompletionTokenParameter === 'max_completion_tokens'
            ? { max_completion_tokens: 16 }
            : { max_tokens: 16 }),
        })

        emitChatPingProgress(contextOptions, {
          phase: 'success',
          attempt: index + 1,
          totalAttempts: candidates.length,
          modelId: normalizedModel,
        })
        return { connectivityOk: true, chatOk: true }
      }
      catch (e) {
        lastError = e
        lastErrorMessage = errorMessageFrom(e) ?? 'Unknown error.'

        if (pingHandles?.runAbortController.signal.aborted) {
          return {
            connectivityOk: true,
            chatOk: false,
            error: lastError,
            errorMessage: 'Ping canceled.',
          }
        }

        if (isNetworkError(e)) {
          return { connectivityOk: false, chatOk: false, error: e, errorMessage: lastErrorMessage }
        }

        const hasNext = index + 1 < candidates.length
        if (hasNext && isAbortError(e)) {
          emitChatPingProgress(contextOptions, {
            phase: 'retry',
            attempt: index + 1,
            totalAttempts: candidates.length,
            modelId: normalizedModel,
            userSkippedModel: true,
          })
          continue
        }

        if (hasNext && shouldTryNextPingModel(e)) {
          emitChatPingProgress(contextOptions, {
            phase: 'retry',
            attempt: index + 1,
            totalAttempts: candidates.length,
            modelId: normalizedModel,
          })
          continue
        }

        if (!shouldTryNextPingModel(e))
          break
      }
    }

    return {
      connectivityOk: true,
      chatOk: false,
      error: lastError,
      errorMessage: lastErrorMessage,
    }
  }

  const chatCheckCacheKey = 'openai-compatible:chat-check'
  const chatCheckMutexKey = 'openai-compatible:chat-check:mutex'
  const getChatCheckResult = async (
    config: TConfig,
    provider: ProviderInstance,
    providerExtra: ProviderExtraMethods<TConfig> | undefined,
    contextOptions?: ProviderContext,
  ): Promise<ChatCheckResult> => {
    if (contextOptions?.chatPingRunHandles) {
      return runChatCheck(config, provider, providerExtra, contextOptions)
    }

    const cache = contextOptions?.validationCache
    const existing = cache?.get(chatCheckCacheKey) as Promise<ChatCheckResult> | undefined
    if (existing)
      return existing

    if (!cache) {
      return runChatCheck(config, provider, providerExtra, contextOptions)
    }

    let mutex = cache.get(chatCheckMutexKey) as Mutex | undefined
    if (!mutex) {
      mutex = new Mutex()
      cache.set(chatCheckMutexKey, mutex)
    }

    await mutex.acquire()

    try {
      const cached = cache.get(chatCheckCacheKey) as Promise<ChatCheckResult> | undefined
      if (cached)
        return cached

      const sharedCheck = runChatCheck(config, provider, providerExtra, contextOptions)

      cache.set(chatCheckCacheKey, sharedCheck)

      return sharedCheck
    }
    finally {
      mutex.release()
    }
  }

  const validatorConfig: ProviderDefinition<TConfig>['validators'] = {
    validateConfig: [],
    validateProvider: [],
  }

  validatorConfig.validateConfig?.push(({ t }) => ({
    id: 'openai-compatible:check-config',
    name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-config.title'),
    validator: async (config) => {
      const errors: Array<{ error: unknown }> = []
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
      const baseUrl = (config.baseUrl as string | URL | undefined) instanceof URL ? config.baseUrl?.toString() : (typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '')

      if (!options?.skipApiKeyCheck && !apiKey)
        errors.push({ error: new Error('API key is required.') })
      if (!baseUrl)
        errors.push({ error: new Error('Base URL is required.') })

      if (baseUrl) {
        try {
          const parsed = new URL(baseUrl)
          if (!parsed.host)
            errors.push({ error: new Error('Base URL is not absolute. Check your input.') })
        }
        catch {
          errors.push({ error: new Error('Base URL is invalid. It must be an absolute URL.') })
        }
      }

      return {
        errors,
        reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
        reasonKey: '',
        valid: errors.length === 0,
      }
    },
  }))

  if (checks.includes(ProviderValidationCheck.Connectivity)) {
    validatorConfig.validateProvider?.push(({ t }) => ({
      id: 'openai-compatible:check-connectivity',
      name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-connectivity.title'),
      schedule: options?.schedule,
      validator: async (config) => {
        const errors: Array<{ error: unknown }> = []
        const baseUrl = String(config.baseUrl ?? '')
        const modelsUrl = baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)

        try {
          const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: requestHeaders(config, additionalHeaders),
            signal: controller.signal,
          })

          if (response.status === 401 || response.status === 403) {
            const errorMessage = `Authentication failed: HTTP ${response.status}`
            const reason = options?.connectivityFailureReason
              ? options.connectivityFailureReason({ config, error: new Error(errorMessage), errorMessage })
              : `Connectivity check failed: ${errorMessage}`
            errors.push({ error: new Error(reason) })
          }
          else if (response.status >= 500) {
            const errorMessage = `Server error: HTTP ${response.status}`
            const reason = options?.connectivityFailureReason
              ? options.connectivityFailureReason({ config, error: new Error(errorMessage), errorMessage })
              : `Connectivity check failed: ${errorMessage}`
            errors.push({ error: new Error(reason) })
          }
        }
        catch (e) {
          const errorMessage = errorMessageFrom(e) || 'Unknown error.'
          const reason = options?.connectivityFailureReason
            ? options.connectivityFailureReason({ config, error: e, errorMessage })
            : `Connectivity check failed: ${errorMessage}`
          errors.push({ error: new Error(reason) })
        }
        finally {
          clearTimeout(timeout)
        }

        return {
          errors,
          reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
          reasonKey: '',
          valid: errors.length === 0,
        }
      },
    }))
  }

  if (checks.includes(ProviderValidationCheck.ChatCompletions)) {
    validatorConfig.validateProvider?.push(({ t }) => ({
      id: 'openai-compatible:check-chat-completions',
      name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-supports-chat-completion.title'),
      schedule: options?.schedule,
      validator: async (config, provider, providerExtra, contextOptions) => {
        const errors: Array<{ error: unknown }> = []
        const result = await getChatCheckResult(
          config,
          provider,
          providerExtra,
          contextOptions,
        )
        if (!result.chatOk) {
          errors.push({ error: new Error(`Chat completions check failed: ${result.errorMessage || 'Unknown error.'}`) })
        }

        return {
          errors,
          reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
          reasonKey: '',
          valid: errors.length === 0,
        }
      },
    }))
  }

  if (checks.includes(ProviderValidationCheck.ModelList)) {
    validatorConfig.validateProvider?.push(({ t }) => ({
      id: 'openai-compatible:check-model-list',
      name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-supports-model-listing.title'),
      schedule: options?.schedule,
      validator: async (config, provider, providerExtra) => {
        const errors: Array<{ error: unknown }> = []
        try {
          const models = await resolveModels(config, provider, providerExtra)
          if (!models || models.length === 0) {
            errors.push({ error: new Error('Model list check failed: no models found') })
          }
        }
        catch (e) {
          const errorMessage = errorMessageFrom(e) || 'Unknown error.'
          const reason = options?.modelListFailureReason
            ? options.modelListFailureReason({ config, error: e, errorMessage })
            : `Model list check failed: ${errorMessage}`
          errors.push({ error: new Error(reason) })
        }

        return {
          errors,
          reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
          reasonKey: '',
          valid: errors.length === 0,
        }
      },
    }))
  }

  return validatorConfig
}
