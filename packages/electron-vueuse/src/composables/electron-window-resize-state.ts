import { readonly, shallowRef } from 'vue'

const resizing = shallowRef(false)

/** True while a frameless Windows edge/corner resize drag is active. */
export const isElectronWindowResizing = readonly(resizing)

export function setElectronWindowResizing(active: boolean) {
  resizing.value = active
}
