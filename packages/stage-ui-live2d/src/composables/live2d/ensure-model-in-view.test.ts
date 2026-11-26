import { describe, expect, it } from 'vitest'

import { ensureModelInView } from './ensure-model-in-view'

const centeredFit = {
  canvasWidth: 1000,
  canvasHeight: 800,
  modelWidth: 500,
  modelHeight: 800,
  fitScale: 1,
  fitX: 500,
  fitY: 400,
  scale: 1,
}

describe('ensureModelInView', () => {
  it('keeps a centered in-bounds model unchanged', () => {
    const result = ensureModelInView({
      ...centeredFit,
      positionX: 0,
      positionY: 0,
      scale: 1,
      modelWidth: 400,
      modelHeight: 400,
    })

    expect(result.changed).toBe(false)
    expect(result.positionX).toBe(0)
    expect(result.scale).toBe(1)
  })

  // ROOT CAUSE:
  //
  // A stale global Live2D position.x shoved the model into the right edge so
  // most of the stage stayed empty. Fit math only centers when position.x is 0.
  //
  // We fixed this by recentering when the model center leaves the canvas or one
  // side clips past the threshold.
  it('resets position.x to 0 when the model is clipped on the right', () => {
    const result = ensureModelInView({
      ...centeredFit,
      positionX: 40,
      positionY: 0,
      scale: 1,
      modelWidth: 500,
      modelHeight: 400,
      fitScale: 1,
    })

    expect(result.changed).toBe(true)
    expect(result.positionX).toBe(0)
    expect(result.scale).toBe(1)
  })

  it('does not change scale when the model is taller than the canvas', () => {
    const result = ensureModelInView({
      ...centeredFit,
      positionX: 0,
      positionY: 0,
      scale: 1,
      modelWidth: 400,
      modelHeight: 2000,
      fitScale: 1,
    })

    expect(result.changed).toBe(false)
    expect(result.scale).toBe(1)
  })

  it('does not shrink a wide model — scale is owned by first-load defaults', () => {
    const result = ensureModelInView({
      ...centeredFit,
      positionX: 0,
      positionY: 0,
      scale: 3,
      modelWidth: 500,
      modelHeight: 200,
      fitScale: 1,
    })

    expect(result.changed).toBe(false)
    expect(result.scale).toBe(3)
  })

  it('returns unchanged input for invalid canvas size', () => {
    const result = ensureModelInView({
      ...centeredFit,
      canvasWidth: 0,
      positionX: 40,
      positionY: 0,
    })

    expect(result.changed).toBe(false)
    expect(result.positionX).toBe(40)
  })
})
