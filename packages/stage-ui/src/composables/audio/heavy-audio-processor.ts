import type { AudioConsoleEffectsSettings } from '../../libs/speech/voice-profile'

export const MAX_TONE_SEMITONES = 14
export const MAX_FORMANT_SEMITONES = 12

export function resampleLinear(input: Float32Array, outputLength: number): Float32Array {
  const output = new Float32Array(outputLength)
  if (outputLength === 0 || input.length === 0)
    return output
  if (outputLength === 1) {
    output[0] = input[0] ?? 0
    return output
  }
  const scale = (input.length - 1) / (outputLength - 1)
  for (let i = 0; i < outputLength; i++) {
    const position = i * scale
    const index = Math.floor(position)
    const fraction = position - index
    const sampleA = input[index] ?? 0
    const sampleB = input[Math.min(index + 1, input.length - 1)]
    output[i] = sampleA + fraction * (sampleB - sampleA)
  }
  return output
}

function sampleCubic(input: Float32Array, position: number): number {
  if (input.length === 0)
    return 0
  const index = Math.floor(position)
  const fraction = position - index
  const y0 = input[Math.max(0, index - 1)]
  const y1 = input[index]
  const y2 = input[Math.min(index + 1, input.length - 1)]
  const y3 = input[Math.min(index + 2, input.length - 1)]
  const a = y3 - y2 - y0 + y1
  const b = y0 - y1 - a
  const c = y2 - y0
  const d = y1
  return a * fraction ** 3 + b * fraction ** 2 + c * fraction + d
}

export function resampleCubic(input: Float32Array, outputLength: number): Float32Array {
  const output = new Float32Array(outputLength)
  if (outputLength === 0 || input.length === 0)
    return output
  const scale = (input.length - 1) / Math.max(1, outputLength - 1)
  for (let i = 0; i < outputLength; i++)
    output[i] = sampleCubic(input, i * scale)
  return output
}

export function semitonesFromTonePercent(percent: number): number {
  return (percent / 100) * MAX_TONE_SEMITONES
}

export function semitonesFromFormantPercent(percent: number): number {
  return (percent / 100) * MAX_FORMANT_SEMITONES
}

export function normalizePeak(channel: Float32Array, targetPeak = 0.98): Float32Array {
  let peak = 0
  for (let i = 0; i < channel.length; i++)
    peak = Math.max(peak, Math.abs(channel[i]))
  if (peak === 0)
    return channel
  const gain = targetPeak / peak
  const output = new Float32Array(channel.length)
  for (let i = 0; i < channel.length; i++)
    output[i] = channel[i] * gain
  return output
}

export function pitchShiftPreserveDuration(channel: Float32Array, semitones: number): Float32Array {
  if (semitones === 0 || channel.length === 0)
    return channel
  const ratio = 2 ** (semitones / 12)
  const pitched = resampleCubic(channel, Math.max(2, Math.round(channel.length / ratio)))
  const restored = resampleCubic(pitched, channel.length)
  return normalizePeak(restored)
}

export function formantShiftChannel(channel: Float32Array, percent: number): Float32Array {
  if (percent === 0 || channel.length === 0)
    return channel
  const semitones = semitonesFromFormantPercent(percent)
  const wet = Math.min(1, Math.abs(percent) / 100)
  const ratio = 2 ** (semitones / 12)
  const thin = resampleCubic(channel, Math.max(2, Math.round(channel.length / ratio)))
  const thinRestore = resampleCubic(thin, channel.length)
  const thick = resampleCubic(channel, Math.max(2, Math.round(channel.length * ratio)))
  const thickRestore = resampleCubic(thick, channel.length)
  const target = percent > 0 ? thickRestore : thinRestore
  const output = new Float32Array(channel.length)
  for (let i = 0; i < channel.length; i++)
    output[i] = channel[i] * (1 - wet) + target[i] * wet
  return normalizePeak(output)
}

export function needsHeavyConsoleProcessing(effects: Pick<AudioConsoleEffectsSettings, 'pitchTone' | 'formant'>): boolean {
  return (effects.pitchTone ?? 0) !== 0 || (effects.formant ?? 0) !== 0
}

export function applyHeavyConsoleProcessing(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  effects: AudioConsoleEffectsSettings,
): AudioBuffer {
  if (!needsHeavyConsoleProcessing(effects))
    return buffer

  const tonePercent = effects.pitchTone ?? 0
  const formantPercent = effects.formant ?? 0
  const channels: Float32Array[] = []

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex++) {
    let channel = new Float32Array(buffer.getChannelData(channelIndex))
    if (tonePercent !== 0)
      channel = new Float32Array(pitchShiftPreserveDuration(channel, semitonesFromTonePercent(tonePercent)))
    if (formantPercent !== 0)
      channel = new Float32Array(formantShiftChannel(channel, formantPercent))
    channels.push(channel)
  }

  const output = audioContext.createBuffer(channels.length, channels[0]!.length, buffer.sampleRate)
  channels.forEach((channel, index) => {
    output.copyToChannel(channel as Float32Array<ArrayBuffer>, index)
  })
  return output
}
