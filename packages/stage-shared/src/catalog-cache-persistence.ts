import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'

import { isElectronWindow } from './window'

export const catalogCacheReadText = defineInvokeEventa<string | null, { fileName: string }>(
  'eventa:invoke:electron:catalog:cache-read-text',
)

export const catalogCacheWriteText = defineInvokeEventa<boolean, { fileName: string, contents: string }>(
  'eventa:invoke:electron:catalog:cache-write-text',
)

/** Reads a catalog cache file from Tamagotchi userData, otherwise returns null. */
export async function readCatalogCacheText(fileName: string): Promise<string | null> {
  if (typeof window !== 'undefined' && isElectronWindow(window)) {
    const { createContext } = await import('@moeru/eventa/adapters/electron/renderer')
    const context = createContext(window.electron.ipcRenderer).context
    const readText = defineInvoke(context, catalogCacheReadText)
    return await readText({ fileName })
  }

  return null
}

/** Writes a catalog cache file from Tamagotchi userData. Returns false when unsupported. */
export async function writeCatalogCacheText(fileName: string, contents: string): Promise<boolean> {
  if (typeof window !== 'undefined' && isElectronWindow(window)) {
    const { createContext } = await import('@moeru/eventa/adapters/electron/renderer')
    const context = createContext(window.electron.ipcRenderer).context
    const writeText = defineInvoke(context, catalogCacheWriteText)
    return await writeText({ fileName, contents })
  }

  return false
}
