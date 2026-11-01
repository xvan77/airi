import type { RendererWindowLoadLabelId } from './renderer-window-load-label'

export interface RendererWindowLoadActivityEntry {
  labelId: RendererWindowLoadLabelId
  routePath: string
}

export interface RendererWindowLoadActivity {
  activeLabelIds: RendererWindowLoadLabelId[]
  activeEntries: RendererWindowLoadActivityEntry[]
}

interface BootPendingEntry {
  count: number
  routePath: string
}

export function mergeRendererWindowLoadActivity(
  frameLoads: Array<{ labelId: RendererWindowLoadLabelId, loadCount: number, routePath: string }>,
  bootPending: Map<RendererWindowLoadLabelId, BootPendingEntry>,
): RendererWindowLoadActivity {
  const bootEntries: RendererWindowLoadActivityEntry[] = []
  for (const [labelId, pending] of bootPending) {
    if (pending.count > 0)
      bootEntries.push({ labelId, routePath: pending.routePath })
  }

  if (bootEntries.length > 0) {
    return {
      activeEntries: bootEntries,
      activeLabelIds: bootEntries.map(entry => entry.labelId),
    }
  }

  const frameEntries = frameLoads
    .filter(entry => entry.loadCount > 0)
    .map(entry => ({ labelId: entry.labelId, routePath: entry.routePath }))

  const seen = new Set<string>()
  const activeEntries = frameEntries.filter((entry) => {
    const key = `${entry.labelId}:${entry.routePath}`
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })

  return {
    activeEntries,
    activeLabelIds: activeEntries.map(entry => entry.labelId),
  }
}
