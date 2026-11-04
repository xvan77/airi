import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'

import { isElectronWindow } from './window'

export const catalogFetchUrlText = defineInvokeEventa<string | null, { url: string }>(
  'eventa:invoke:electron:catalog:fetch-url-text',
)

/** Fetches URL text from the main process in Tamagotchi, otherwise uses `fetch`. */
export async function fetchUrlTextForCatalog(url: string): Promise<string | null> {
  if (typeof window !== 'undefined' && isElectronWindow(window)) {
    const { createContext } = await import('@moeru/eventa/adapters/electron/renderer')
    const context = createContext(window.electron.ipcRenderer).context
    const fetchText = defineInvoke(context, catalogFetchUrlText)
    return await fetchText({ url })
  }

  try {
    const response = await fetch(url)
    if (!response.ok)
      return null
    return await response.text()
  }
  catch {
    return null
  }
}
