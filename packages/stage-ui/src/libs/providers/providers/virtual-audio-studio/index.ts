import { z } from 'zod'

import { VIRTUAL_AUDIO_STUDIO_MODEL_ID, VIRTUAL_AUDIO_STUDIO_PROVIDER_ID } from '../../../speech/voice-profile'
import { defineProvider } from '../registry'

const virtualAudioStudioConfigSchema = z.object({})

type VirtualAudioStudioConfig = z.input<typeof virtualAudioStudioConfigSchema>

export const providerVirtualAudioStudio = defineProvider<VirtualAudioStudioConfig, typeof VIRTUAL_AUDIO_STUDIO_PROVIDER_ID>({
  id: VIRTUAL_AUDIO_STUDIO_PROVIDER_ID,
  name: 'Audio Studio',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.virtual-audio-studio.title'),
  description: 'Build virtual voice profiles with local post-processing and dialogue filters.',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.virtual-audio-studio.description'),
  tasks: ['text-to-speech', 'tts'],
  icon: 'i-solar:music-library-bold-duotone',
  isAvailableBy: () => false,
  requiresCredentials: false,
  validationRequiredWhen: () => false,
  createProviderConfig: () => virtualAudioStudioConfigSchema,
  createProvider() {
    return {
      speech: () => ({
        baseURL: 'http://virtual-audio-studio.invalid/v1/',
        model: VIRTUAL_AUDIO_STUDIO_MODEL_ID,
        fetch: async () => {
          throw new Error('Virtual Audio Studio routes synthesis through saved voice profiles')
        },
      }),
    }
  },
  validators: {
    validateConfig: [
      () => ({
        id: 'virtual-audio-studio:check-config',
        name: 'Audio Studio',
        validator: async () => ({ errors: [], reason: '', reasonKey: '', valid: true }),
      }),
    ],
  },
  extraMethods: {
    listModels: async () => [{
      id: VIRTUAL_AUDIO_STUDIO_MODEL_ID,
      name: 'Virtual Engine',
      provider: VIRTUAL_AUDIO_STUDIO_PROVIDER_ID,
      description: 'Saved voice profile bundles',
    }],
    listVoices: async () => [],
  },
})
