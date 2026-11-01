import type { RendererWindowLoadActivityEntry } from '../../shared/renderer-window-load-activity'
import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { computed, onScopeDispose, ref } from 'vue'

import {
  electronGetRendererWindowLoadActivity,
  electronRendererWindowLoadActivityChanged,
} from '../../shared/eventa'

function normalizeEntries(
  entries: Array<{ labelId: string, routePath: string }> | undefined,
): RendererWindowLoadActivityEntry[] {
  if (!entries?.length)
    return []
  return entries.map(entry => ({
    labelId: entry.labelId as RendererWindowLoadLabelId,
    routePath: entry.routePath,
  }))
}

export function useRendererWindowLoadActivity() {
  const activeEntries = ref<RendererWindowLoadActivityEntry[]>([])
  const context = useElectronEventaContext()
  const getActivity = useElectronEventaInvoke(electronGetRendererWindowLoadActivity)

  function applyActivity(body: { activeLabelIds?: string[], activeEntries?: Array<{ labelId: string, routePath: string }> }) {
    if (body.activeEntries?.length) {
      activeEntries.value = normalizeEntries(body.activeEntries)
      return
    }
    activeEntries.value = (body.activeLabelIds ?? []).map(labelId => ({
      labelId: labelId as RendererWindowLoadLabelId,
      routePath: '/',
    }))
  }

  const stopListener = context.value.on(electronRendererWindowLoadActivityChanged, (event) => {
    if (!event?.body)
      return
    applyActivity(event.body)
  })

  onScopeDispose(() => {
    stopListener()
  })

  void getActivity()
    .then((activity) => {
      applyActivity(activity)
    })
    .catch(() => {
      // The main process may not have registered the service yet during tests.
    })

  const activeLabelIds = computed(() => activeEntries.value.map(entry => entry.labelId))

  const auxiliaryEntries = computed(() => activeEntries.value.filter(entry => entry.labelId !== 'main'))

  return {
    activeEntries,
    activeLabelIds,
    auxiliaryEntries,
    auxiliaryLabelIds: computed(() => auxiliaryEntries.value.map(entry => entry.labelId)),
  }
}
