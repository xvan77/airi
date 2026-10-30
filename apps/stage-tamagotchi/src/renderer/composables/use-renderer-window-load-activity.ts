import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { computed, onScopeDispose, ref } from 'vue'

import {
  electronGetRendererWindowLoadActivity,
  electronRendererWindowLoadActivityChanged,
} from '../../shared/eventa'

function normalizeLabelIds(ids: string[]): RendererWindowLoadLabelId[] {
  return ids as RendererWindowLoadLabelId[]
}

export function useRendererWindowLoadActivity() {
  const activeLabelIds = ref<RendererWindowLoadLabelId[]>([])
  const context = useElectronEventaContext()
  const getActivity = useElectronEventaInvoke(electronGetRendererWindowLoadActivity)

  const stopListener = context.value.on(electronRendererWindowLoadActivityChanged, (event) => {
    if (!event?.body)
      return
    activeLabelIds.value = normalizeLabelIds(event.body.activeLabelIds)
  })

  onScopeDispose(() => {
    stopListener()
  })

  void getActivity()
    .then((activity) => {
      activeLabelIds.value = normalizeLabelIds(activity.activeLabelIds)
    })
    .catch(() => {
      // The main process may not have registered the service yet during tests.
    })

  const auxiliaryLabelIds = computed(() => activeLabelIds.value.filter(id => id !== 'main'))

  return {
    activeLabelIds,
    auxiliaryLabelIds,
  }
}
