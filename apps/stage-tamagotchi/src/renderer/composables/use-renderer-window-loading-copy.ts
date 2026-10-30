import type { ComputedRef } from 'vue'

import type { RendererWindowLoadLabelId } from '../../shared/renderer-window-load-label'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useRendererWindowLoadingCopy(labelId: ComputedRef<RendererWindowLoadLabelId> | RendererWindowLoadLabelId) {
  const { t, te } = useI18n()

  const loadingMessage = computed(() => {
    const id = typeof labelId === 'object' && 'value' in labelId ? labelId.value : labelId
    const nameKey = `tamagotchi.stage.window-loading.names.${id}`
    const name = te(nameKey)
      ? t(nameKey)
      : t('tamagotchi.stage.window-loading.names.other')
    return t('tamagotchi.stage.window-loading.label', { name })
  })

  return { loadingMessage }
}
