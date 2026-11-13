import type { AiriExtension } from '../../types/airiCard'

import { VIRTUAL_AUDIO_STUDIO_PROVIDER_ID } from '../../libs/speech/voice-profile'

const EMPTY_SPEECH_PROVIDER_CONFIG: Record<string, unknown> = Object.freeze({})

function isUsableSpeechProvider(provider: string | undefined): provider is string {
  return !!provider
    && provider !== 'speech-noop'
    && provider !== VIRTUAL_AUDIO_STUDIO_PROVIDER_ID
}

function configString(config: Record<string, unknown>, key: string): string {
  const value = config[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Speech settings pick the chat TTS provider. Card speech is only a fallback
 * when the Speech module is unset. Mixing them sent Test Voice to Gemini and
 * chat to a stale OpenRouter card row.
 */
export function resolveChatSpeechSelection(
  selection: AiriExtension['modules']['speech'],
  runtime: { provider: string, model: string, voiceId: string },
  providerConfig: Record<string, unknown> = EMPTY_SPEECH_PROVIDER_CONFIG,
): AiriExtension['modules']['speech'] {
  let provider = selection.provider
  if (isUsableSpeechProvider(runtime.provider))
    provider = runtime.provider
  else if (!isUsableSpeechProvider(provider))
    provider = runtime.provider

  const useRuntime = provider === runtime.provider && isUsableSpeechProvider(runtime.provider)
  const configModel = configString(providerConfig, 'model')
  const configVoice = configString(providerConfig, 'voiceId') || configString(providerConfig, 'voice')

  const model = useRuntime
    ? (runtime.model || configModel)
    : (selection.model || configModel)
  const voice_id = useRuntime
    ? (runtime.voiceId || configVoice)
    : (selection.voice_id || configVoice)

  return { provider, model, voice_id }
}

export { EMPTY_SPEECH_PROVIDER_CONFIG }
