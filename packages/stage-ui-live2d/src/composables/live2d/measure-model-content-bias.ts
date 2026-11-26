export interface DrawableBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ModelContentBiasSource {
  getDrawableCount: () => number
  getDrawableBounds: (index: number) => DrawableBounds
}

export interface ModelContentBias {
  /** Content center minus model canvas center, in model canvas pixels. */
  x: number
  y: number
}

function unionInto(target: DrawableBounds, next: DrawableBounds) {
  const right = Math.max(target.x + target.width, next.x + next.width)
  const bottom = Math.max(target.y + target.height, next.y + next.height)
  target.x = Math.min(target.x, next.x)
  target.y = Math.min(target.y, next.y)
  target.width = right - target.x
  target.height = bottom - target.y
}

/**
 * Measures how far the visible Live2D meshes sit from the model canvas center.
 *
 * Many models (especially chibi) keep empty padding on one side of the canvas.
 * Centering the canvas then leaves the character visually off to the side.
 * Callers subtract `bias.x * displayScale` from the stage X to center the art.
 */
export function measureModelContentBias(
  source: ModelContentBiasSource,
  modelWidth: number,
  modelHeight: number,
): ModelContentBias {
  if (!(modelWidth > 0) || !(modelHeight > 0))
    return { x: 0, y: 0 }

  const count = source.getDrawableCount()
  if (!(count > 0))
    return { x: 0, y: 0 }

  let union: DrawableBounds | undefined
  for (let index = 0; index < count; index++) {
    const drawable = source.getDrawableBounds(index)
    if (!(drawable.width > 0) || !(drawable.height > 0))
      continue

    if (!union)
      union = { ...drawable }
    else
      unionInto(union, drawable)
  }

  if (!union)
    return { x: 0, y: 0 }

  return {
    x: (union.x + union.width / 2) - modelWidth / 2,
    y: (union.y + union.height / 2) - modelHeight / 2,
  }
}
