import { describe, expect, it } from 'vitest'

import { distortionCurveForPercent } from './audio-effects'

describe('distortionCurveForPercent', () => {
  it('returns a symmetric curve with zero at center', () => {
    const curve = distortionCurveForPercent(50)
    expect(curve.length).toBe(256)
    expect(curve[128]).toBeCloseTo(0, 2)
    expect(curve[0]).toBeLessThan(0)
    expect(curve[255]).toBeGreaterThan(0)
  })

  it('increases curvature as percent rises', () => {
    const mild = distortionCurveForPercent(20)
    const hot = distortionCurveForPercent(100)
    expect(Math.abs(hot[255])).toBeGreaterThan(Math.abs(mild[255]))
  })
})
