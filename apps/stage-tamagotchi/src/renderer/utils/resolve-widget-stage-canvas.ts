export interface WidgetStageCanvasExpose {
  canvasElement?: (() => HTMLCanvasElement | undefined) | HTMLCanvasElement
}

export function resolveWidgetStageCanvas(
  stage: WidgetStageCanvasExpose | undefined,
): HTMLCanvasElement | undefined {
  if (!stage)
    return undefined

  const canvasElement = stage.canvasElement
  if (typeof canvasElement === 'function')
    return canvasElement()

  if (canvasElement instanceof HTMLCanvasElement)
    return canvasElement

  return undefined
}
