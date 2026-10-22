import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { isElectronWindow, isStageTamagotchi } from '@proj-airi/stage-shared'
import { z } from 'zod'

import { defineProvider } from '../registry'

const NATIVE_TTS_MODEL_ID = 'system-native-tts'

const appLocalAudioSpeechConfigSchema = z.object({
  voiceId: z.string().optional().default(''),
})

type AppLocalAudioSpeechConfig = z.input<typeof appLocalAudioSpeechConfigSchema>

const electronGetNativeTtsVoices = defineInvokeEventa<Array<{
  id: string
  name: string
  lang: string
  gender: string
}>>('eventa:invoke:electron:speech:get-native-tts-voices')

const electronGenerateNativeTts = defineInvokeEventa<ArrayBuffer | null, { text: string, voiceId?: string }>('eventa:invoke:electron:speech:generate-native-tts')

function withNativeTtsInvokers<T>(run: (invokers: {
  getVoices: () => Promise<Array<{ id: string, name: string, lang: string, gender: string }>>
  generateTts: (payload: { text: string, voiceId?: string }) => Promise<ArrayBuffer | null>
}) => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || !isElectronWindow(window))
    throw new Error('Native TTS is only available in the desktop app')

  const { context, dispose } = createContext(window.electron.ipcRenderer)
  const invokers = {
    getVoices: defineInvoke(context, electronGetNativeTtsVoices),
    generateTts: defineInvoke(context, electronGenerateNativeTts),
  }
  return run(invokers).finally(() => dispose())
}

export const providerAppLocalAudioSpeech = defineProvider<AppLocalAudioSpeechConfig, 'app-local-audio-speech'>({
  id: 'app-local-audio-speech',
  name: 'App (Local)',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.app-local-audio-speech.title'),
  description: 'Native text-to-speech through the operating system voice engine.',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.app-local-audio-speech.description'),
  tasks: ['text-to-speech', 'tts'],
  icon: 'i-solar:volume-loud-bold-duotone',
  isAvailableBy: isStageTamagotchi,
  requiresCredentials: false,
  validationRequiredWhen: () => false,
  createProviderConfig: () => appLocalAudioSpeechConfigSchema,
  createProvider() {
    return {
      speech: () => ({
        baseURL: 'http://app-local-speech.invalid/v1/',
        model: NATIVE_TTS_MODEL_ID,
        fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
          let text = ''
          let voiceId = ''
          if (init?.body && typeof init.body === 'string') {
            const body = JSON.parse(init.body) as { input?: string, voice?: string }
            text = body.input ?? ''
            voiceId = body.voice ?? ''
          }

          if (!text) {
            return new Response(new ArrayBuffer(0), {
              headers: { 'Content-Type': 'audio/wav' },
            })
          }

          const arrayBuffer = await withNativeTtsInvokers(invokers => invokers.generateTts({ text, voiceId }))
          return new Response(arrayBuffer ?? new ArrayBuffer(0), {
            headers: { 'Content-Type': 'audio/wav' },
          })
        },
      }),
    }
  },
  validators: {
    validateConfig: [
      () => ({
        id: 'app-local-audio-speech:check-config',
        name: 'System TTS',
        validator: async () => ({ errors: [], reason: '', reasonKey: '', valid: true }),
      }),
    ],
  },
  extraMethods: {
    listModels: async () => [{
      id: NATIVE_TTS_MODEL_ID,
      name: 'System TTS',
      provider: 'app-local-audio-speech',
      description: 'Built-in operating system text-to-speech',
    }],
    listVoices: async () => {
      try {
        const rawVoices = await withNativeTtsInvokers(invokers => invokers.getVoices())
        return rawVoices.map(voice => ({
          id: voice.id,
          name: voice.name,
          provider: 'app-local-audio-speech',
          languages: [{
            code: voice.lang,
            title: voice.lang,
          }],
          description: `${voice.name} (${voice.lang})`,
          gender: voice.gender ? voice.gender.toLowerCase() : 'neutral',
        }))
      }
      catch (error) {
        console.error('[App Local Speech] Failed to fetch native voices:', error)
        return []
      }
    },
  },
})
