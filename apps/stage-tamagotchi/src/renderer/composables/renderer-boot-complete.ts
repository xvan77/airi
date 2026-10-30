import { computed, ref } from 'vue'

/** False until the renderer finishes the first Vue Router ready pass. */
export const rendererBootComplete = ref(false)

export function useRendererBootComplete() {
  return rendererBootComplete
}

/** Hide the auxiliary popup while the centered boot card is still up. */
export function useMainStageBootCardVisible() {
  return computed(() => !rendererBootComplete.value)
}
