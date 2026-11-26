import { describe, expect, it } from 'vitest'

import { measureModelContentBias } from './measure-model-content-bias'

describe('measureModelContentBias', () => {
  it('returns zero when meshes fill the canvas evenly', () => {
    const bias = measureModelContentBias({
      getDrawableCount: () => 1,
      getDrawableBounds: () => ({ x: 0, y: 0, width: 1000, height: 800 }),
    }, 1000, 800)

    expect(bias).toEqual({ x: 0, y: 0 })
  })

  // ROOT CAUSE:
  //
  // Chibi Live2D files often keep empty padding on the left of the canvas.
  // Centering the canvas (position.x = 0) still parks the character on the right.
  //
  // We fixed this by measuring drawable bounds and shifting by the content bias.
  it('reports a positive x bias when meshes sit on the right half of the canvas', () => {
    const bias = measureModelContentBias({
      getDrawableCount: () => 1,
      getDrawableBounds: () => ({ x: 600, y: 100, width: 300, height: 600 }),
    }, 1000, 800)

    // Content center at 750, canvas center at 500 → bias +250.
    expect(bias.x).toBe(250)
    expect(bias.y).toBe(0)
  })

  it('unions every drawable before measuring', () => {
    const bias = measureModelContentBias({
      getDrawableCount: () => 2,
      getDrawableBounds: index => index === 0
        ? { x: 100, y: 100, width: 100, height: 100 }
        : { x: 700, y: 100, width: 100, height: 100 },
    }, 1000, 800)

    // Union 100..800 → center 450, canvas center 500 → bias -50.
    expect(bias.x).toBe(-50)
  })

  it('ignores empty drawables', () => {
    const bias = measureModelContentBias({
      getDrawableCount: () => 2,
      getDrawableBounds: index => index === 0
        ? { x: 0, y: 0, width: 0, height: 0 }
        : { x: 0, y: 0, width: 1000, height: 800 },
    }, 1000, 800)

    expect(bias).toEqual({ x: 0, y: 0 })
  })
})
