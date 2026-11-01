import type { ComputedRef } from 'vue'

import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { computed, unref } from 'vue'
import { useI18n } from 'vue-i18n'

function resolveLabelId(
  labelId?: ComputedRef<RendererWindowLoadLabelId> | RendererWindowLoadLabelId,
): RendererWindowLoadLabelId {
  if (labelId === undefined)
    return 'other'
  return unref(labelId)
}

export function useRendererWindowLoadingCopy(
  labelId?: ComputedRef<RendererWindowLoadLabelId> | RendererWindowLoadLabelId,
  _routePath?: ComputedRef<string | undefined> | string,
) {
  const { t } = useI18n()

  const loadingMessage = computed(() => {
    const id = resolveLabelId(labelId)
    if (id === 'main')
      return t('tamagotchi.stage.window-loading.main-window')
    if (id === 'model')
      return t('tamagotchi.stage.window-loading.starting-model')
    return t('tamagotchi.stage.window-loading.module')
  })

  return { loadingMessage }
}
