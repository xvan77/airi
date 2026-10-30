import type { BrowserWindow } from 'electron'

import { setupBeatSync } from './index'

export interface LazyBeatSyncWindowHandle {
  ensure: () => Promise<BrowserWindow>
  getIfReady: () => BrowserWindow | undefined
}

export function createLazyBeatSyncWindowHandle(): LazyBeatSyncWindowHandle {
  let window: BrowserWindow | undefined
  let pending: Promise<BrowserWindow> | undefined

  return {
    ensure() {
      if (window)
        return Promise.resolve(window)
      pending ??= setupBeatSync().then((created) => {
        window = created
        return created
      })
      return pending
    },
    getIfReady() {
      return window
    },
  }
}
