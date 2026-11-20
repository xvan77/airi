export const VIRTUAL_AUDIO_STUDIO_MODEL_ID = 'virtual'
export const VIRTUAL_AUDIO_STUDIO_PROVIDER_ID = 'virtual-audio-studio'

export interface AudioConsoleUstSettings {
  enabled: boolean
  mode: 'mute' | 'flatten' | 'custom'
  customStripChars: string
  stripEmojis: boolean
  tildeReplacement: string
}

export interface AudioConsoleEffectsSettings {
  pitch: number
  rate: number
  volume: number
  highpass: number
  eqBass: number
  eqMid: number
  eqTreble: number
  deesser: number
  limiter: number
  chorus: number
  grit: number
  gate: number
  pitchTone: number
  formant: number
  asmr: number
  radio: number
  robot: number
  reverb: number
  spatial: number
}

export interface AudioConsoleSettings {
  effects: AudioConsoleEffectsSettings
  ust: AudioConsoleUstSettings
}

export function createDefaultAudioConsoleSettings(): AudioConsoleSettings {
  return {
    effects: {
      pitch: 0,
      rate: 1,
      volume: 100,
      highpass: 0,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0,
      deesser: 0,
      limiter: 0,
      chorus: 0,
      grit: 0,
      gate: 0,
      pitchTone: 0,
      formant: 0,
      asmr: 0,
      radio: 0,
      robot: 0,
      reverb: 0,
      spatial: 0,
    },
    ust: {
      enabled: true,
      mode: 'mute',
      customStripChars: '*_[]()<>"\'',
      stripEmojis: true,
      tildeReplacement: 'nyan',
    },
  }
}

export interface VoiceProfile {
  id: string
  name: string
  baseProvider: string
  baseModel: string
  baseVoice: string
  effects: {
    pitch: number
    rate: number
    volume: number
    highpass: number
    eqBass: number
    eqMid: number
    eqTreble: number
    deesser: number
    limiter: number
    chorus: number
    grit: number
    gate: number
    pitchTone: number
    formant: number
    asmr: number
    radio: number
    robot: number
    reverb: number
    spatial: number
  }
  ust: {
    enabled: boolean
    mode: 'mute' | 'flatten' | 'custom'
    customStripChars: string
    stripEmojis: boolean
    tildeReplacement: string
  }
}

export function createDefaultVoiceProfile(id?: string): VoiceProfile {
  return {
    id: id ?? `voice_profile_${Date.now()}`,
    name: 'New Custom Voice',
    baseProvider: 'speech-noop',
    baseModel: '',
    baseVoice: '',
    effects: {
      pitch: 0,
      rate: 1,
      volume: 100,
      highpass: 0,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0,
      deesser: 0,
      limiter: 0,
      chorus: 0,
      grit: 0,
      gate: 0,
      pitchTone: 0,
      formant: 0,
      asmr: 0,
      radio: 0,
      robot: 0,
      reverb: 0,
      spatial: 0,
    },
    ust: {
      enabled: true,
      mode: 'mute',
      customStripChars: '*_[]()<>"\'',
      stripEmojis: true,
      tildeReplacement: 'nyan',
    },
  }
}
