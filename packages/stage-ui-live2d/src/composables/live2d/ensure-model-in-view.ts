export interface ModelInViewInput {
  canvasWidth: number
  canvasHeight: number
  /** Unscaled model size captured before view scale is applied. */
  modelWidth: number
  modelHeight: number
  /** Scale and anchor from {@link useFitModel}. */
  fitScale: number
  fitX: number
  fitY: number
  /** User offset as a percent of canvas size. */
  positionX: number
  positionY: number
  /** User scale multiplier on top of fitScale. */
  scale: number
  /**
   * Fraction of the model width clipped on one side that forces a horizontal recenter.
   *
   * @default 0.25
   */
  clipThreshold?: number
}

export interface ModelInViewCorrection {
  positionX: number
  positionY: number
  scale: number
  changed: boolean
}

interface ModelBounds {
  centerX: number
  width: number
  left: number
  right: number
}

function boundsOf(input: {
  canvasWidth: number
  modelWidth: number
  modelHeight: number
  fitScale: number
  fitX: number
  fitY: number
  positionX: number
  positionY: number
  scale: number
  canvasHeight: number
}): ModelBounds | undefined {
  if (!(input.canvasWidth > 0) || !(input.canvasHeight > 0))
    return undefined
  if (!(input.modelWidth > 0) || !(input.modelHeight > 0))
    return undefined
  if (!(input.fitScale > 0) || !(input.scale > 0))
    return undefined

  const displayScale = input.fitScale * input.scale
  const width = input.modelWidth * displayScale
  // position is a percent of canvas size. Y is inverted to match Model.vue.
  const centerX = input.fitX + (input.positionX / 100) * input.canvasWidth

  return {
    centerX,
    width,
    left: centerX - width / 2,
    right: centerX + width / 2,
  }
}

function heavilyClipped(clipped: number, size: number, threshold: number) {
  if (!(size > 0))
    return false
  return clipped / size >= threshold
}

/**
 * Recenters Live2D horizontally after resize when the model left the window.
 *
 * Does not change scale. Fit-model already owns default size (scale 1 ≈ twice
 * the viewport height). Call after canvas resize, not on every slider move.
 */
export function ensureModelInView(input: ModelInViewInput): ModelInViewCorrection {
  const clipThreshold = input.clipThreshold ?? 0.25
  const current: ModelInViewCorrection = {
    positionX: input.positionX,
    positionY: input.positionY,
    scale: input.scale,
    changed: false,
  }

  const initial = boundsOf(input)
  if (!initial)
    return current

  let positionX = input.positionX
  const clippedLeft = Math.max(0, -initial.left)
  const clippedRight = Math.max(0, initial.right - input.canvasWidth)
  const centerOutsideX = initial.centerX < 0 || initial.centerX > input.canvasWidth
  if (
    centerOutsideX
    || heavilyClipped(clippedLeft, initial.width, clipThreshold)
    || heavilyClipped(clippedRight, initial.width, clipThreshold)
  ) {
    positionX = 0
  }

  const changed = positionX !== input.positionX

  return {
    positionX,
    positionY: input.positionY,
    scale: input.scale,
    changed,
  }
}
