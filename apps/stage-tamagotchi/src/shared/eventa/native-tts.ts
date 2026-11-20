import type { WindowsVoicePackInstallResult, WindowsVoicePackState } from '@proj-airi/stage-shared'

import { defineInvokeEventa } from '@moeru/eventa'

export interface NativeTtsVoice {
  id: string
  name: string
  lang: string
  gender: string
}

export const electronGetNativeTtsVoices = defineInvokeEventa<NativeTtsVoice[]>('eventa:invoke:electron:speech:get-native-tts-voices')
export const electronGenerateNativeTts = defineInvokeEventa<ArrayBuffer | null, { text: string, voiceId?: string }>('eventa:invoke:electron:speech:generate-native-tts')
export const electronListWindowsVoicePacks = defineInvokeEventa<WindowsVoicePackState[]>('eventa:invoke:electron:speech:list-windows-voice-packs')
export const electronInstallWindowsVoicePack = defineInvokeEventa<WindowsVoicePackInstallResult, { locale: string }>('eventa:invoke:electron:speech:install-windows-voice-pack')
export const electronRemoveWindowsVoicePack = defineInvokeEventa<WindowsVoicePackInstallResult, { locale: string }>('eventa:invoke:electron:speech:remove-windows-voice-pack')
