import type { ProviderContext, ProviderExtraMethods, ProviderInstance, ProviderRuntimeValidator } from '../types'

import { errorMessageFrom } from '@moeru/std'

import { SPEECH_CREDENTIALS_VALIDATOR_ID } from '../types'

const PROBE_TIMEOUT_MS = 10_000

export interface SpeechCredentialProbeOptions {
  /**
   * Some OpenAI-compatible TTS servers have no `/models` route.
   * HTTP 404 then does not prove the key is wrong.
   */
  acceptNotFound?: boolean
}

/**
 * Sends one GET that must use the API key. Chat providers already do this
 * against `/models`. Cloud speech providers only checked that the key field
 * was nonempty, so any string passed.
 */
export async function probeSpeechCredentialRequest(
  url: URL,
  init: RequestInit = {},
  options: SpeechCredentialProbeOptions = {},
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      method: init.method ?? 'GET',
      signal: controller.signal,
    })
    if (response.ok)
      return
    if (options.acceptNotFound && response.status === 404)
      return

    const body = (await response.text().catch(() => '')).trim()
    const detail = body ? `: ${body.slice(0, 200)}` : ''
    throw new Error(`Speech credential check failed: HTTP ${response.status}${detail}`)
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('Speech credential check failed:'))
      throw error
    throw new Error(`Speech credential check failed: ${errorMessageFrom(error) ?? 'Unknown error.'}`)
  }
  finally {
    clearTimeout(timeout)
  }
}

export async function probeSpeechVoiceCatalog<TConfig>(
  config: TConfig,
  provider: ProviderInstance,
  extra: ProviderExtraMethods<TConfig>,
): Promise<void> {
  if (!extra.listVoices)
    throw new Error('Speech credential check failed: voice catalog is unavailable.')

  await extra.listVoices(config, provider)
}

export function createSpeechCredentialValidator<TConfig>(options: {
  /** Provider-prefixed id. It must include {@link SPEECH_CREDENTIALS_VALIDATOR_ID}. */
  id: string
  probe: (
    config: TConfig,
    provider: ProviderInstance,
    extra: ProviderExtraMethods<TConfig>,
  ) => Promise<void>
}): (context: ProviderContext) => ProviderRuntimeValidator<TConfig> {
  const id = options.id.includes(SPEECH_CREDENTIALS_VALIDATOR_ID)
    ? options.id
    : `${options.id}:${SPEECH_CREDENTIALS_VALIDATOR_ID}`

  return ({ t }) => ({
    id,
    name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-connectivity.title'),
    validator: async (config, provider, extra) => {
      try {
        await options.probe(config, provider, extra)
        return { errors: [], reason: '', reasonKey: '', valid: true }
      }
      catch (error) {
        const reason = errorMessageFrom(error) ?? 'Speech credential check failed.'
        return { errors: [{ error }], reason, reasonKey: '', valid: false }
      }
    },
  })
}
