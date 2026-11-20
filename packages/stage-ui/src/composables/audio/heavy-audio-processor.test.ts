import { describe, expect, it } from 'vitest'

import {
  formantShiftChannel,
  pitchShiftPreserveDuration,
  resampleLinear,
  semitonesFromTonePercent,
} from './heavy-audio-processor'

describe('heavy-audio-processor', () => {
  it('keeps output length when shifting pitch', () => {
    const input = new Float32Array(4800)
    for (let i = 0; i < input.length; i++)
      input[i] = Math.sin(i / 40)
    const output = pitchShiftPreserveDuration(input, semitonesFromTonePercent(100))
    expect(output.length).toBe(input.length)
  })

  it('changes samples when tone shift is non-zero', () => {
    const input = new Float32Array(2048)
    for (let i = 0; i < input.length; i++)
      input[i] = Math.sin(i / 12)
    const output = pitchShiftPreserveDuration(input, 4)
    let diff = 0
    for (let i = 0; i < input.length; i++)
      diff += Math.abs(input[i] - output[i])
    expect(diff).toBeGreaterThan(1)
  })

  it('resamples linearly to requested length', () => {
    const input = new Float32Array([0, 1, 0, -1])
    const output = resampleLinear(input, 8)
    expect(output.length).toBe(8)
  })

  it('keeps length for formant shift', () => {
    const input = new Float32Array(1024)
    input.fill(0.25)
    const output = formantShiftChannel(input, 40)
    expect(output.length).toBe(input.length)
  })
})
