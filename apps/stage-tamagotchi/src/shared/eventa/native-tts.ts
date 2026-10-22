import { defineInvokeEventa } from '@moeru/eventa'

export interface NativeTtsVoice {
  id: string
  name: string
  lang: string
  gender: string
}

export const electronGetNativeTtsVoices = defineInvokeEventa<NativeTtsVoice[]>('eventa:invoke:electron:speech:get-native-tts-voices')
export const electronGenerateNativeTts = defineInvokeEventa<ArrayBuffer | null, { text: string, voiceId?: string }>('eventa:invoke:electron:speech:generate-native-tts')
