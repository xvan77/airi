import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { isElectronWindow, isStageTamagotchi } from '@proj-airi/stage-shared'

export function openTamagotchiEventaSession() {
  if (typeof window === 'undefined' || !isStageTamagotchi() || !isElectronWindow(window))
    return null

  return createContext(window.electron.ipcRenderer)
}
