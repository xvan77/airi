import type { RendererWindowLoadLabelId } from './renderer-window-load-label'

export interface RendererWindowLoadActivity {
  /** Label ids for renderer windows that are loading their main frame. */
  activeLabelIds: RendererWindowLoadLabelId[]
}

export function mergeRendererWindowLoadActivity(
  frameLoads: Array<{ labelId: RendererWindowLoadLabelId, loadCount: number }>,
  bootPending: Map<RendererWindowLoadLabelId, number>,
): RendererWindowLoadActivity {
  const bootIds = [...bootPending.keys()]
  if (bootIds.length > 0)
    return { activeLabelIds: bootIds }

  const loadingIds = frameLoads
    .filter(entry => entry.loadCount > 0)
    .map(entry => entry.labelId)

  return { activeLabelIds: [...new Set(loadingIds)] }
}
