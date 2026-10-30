import type { BrowserWindow } from 'electron'

import type { RendererWindowLoadActivity } from '../../../shared/renderer-window-load-activity'
import type { RendererWindowLoadLabelId } from '../../../shared/renderer-window-load-label'
import type { EventaContext } from './global-shortcut'

import { defineInvokeHandler } from '@moeru/eventa'

import {
  electronGetRendererWindowLoadActivity,
  electronRendererWindowLoadActivityChanged,
  electronSetRendererWindowBootLoading,
} from '../../../shared/eventa'
import { mergeRendererWindowLoadActivity } from '../../../shared/renderer-window-load-activity'
import { extractRendererRouteFromLoadTarget, resolveRendererWindowLoadLabelId } from '../../../shared/renderer-window-load-label'

export type { RendererWindowLoadActivity } from '../../../shared/renderer-window-load-activity'

interface TrackedWindow {
  labelId: RendererWindowLoadLabelId
  loadCount: number
}

let serviceInstance: RendererWindowLoadIndicatorService | undefined

export function setupRendererWindowLoadIndicatorService(): RendererWindowLoadIndicatorService {
  serviceInstance = createRendererWindowLoadIndicatorService()
  return serviceInstance
}

export function getRendererWindowLoadIndicatorService(): RendererWindowLoadIndicatorService | undefined {
  return serviceInstance
}

export interface RendererWindowLoadIndicatorService {
  registerContext: (context: EventaContext) => void
  unregisterContext: (context: EventaContext) => void
  trackWindow: (
    window: BrowserWindow,
    target: string | { url: string } | { file: string, options?: { hash?: string } },
  ) => void
  syncWindowRoute: (window: BrowserWindow, routePath: string) => void
  getActivity: () => RendererWindowLoadActivity
}

function createRendererWindowLoadIndicatorService(): RendererWindowLoadIndicatorService {
  const contexts = new Set<EventaContext>()
  const tracked = new Map<number, TrackedWindow>()
  const bootPending = new Map<RendererWindowLoadLabelId, number>()
  const attached = new WeakSet<BrowserWindow>()
  const invokeRegistered = new WeakSet<EventaContext>()

  function setBootPending(labelId: RendererWindowLoadLabelId, active: boolean) {
    if (active) {
      bootPending.set(labelId, (bootPending.get(labelId) ?? 0) + 1)
    }
    else {
      const next = Math.max(0, (bootPending.get(labelId) ?? 0) - 1)
      if (next === 0)
        bootPending.delete(labelId)
      else
        bootPending.set(labelId, next)
    }
    broadcast()
  }

  function getActivity(): RendererWindowLoadActivity {
    return mergeRendererWindowLoadActivity([...tracked.values()], bootPending)
  }

  function broadcast() {
    const payload = getActivity()
    for (const context of contexts) {
      try {
        void context.emit(electronRendererWindowLoadActivityChanged, payload)
      }
      catch {
        // A renderer may close while a load event is in flight.
      }
    }
  }

  function registerContext(context: EventaContext) {
    contexts.add(context)
    if (invokeRegistered.has(context))
      return
    invokeRegistered.add(context)
    defineInvokeHandler(context, electronGetRendererWindowLoadActivity, () => getActivity())
    defineInvokeHandler(context, electronSetRendererWindowBootLoading, (payload) => {
      if (!payload?.labelId)
        return
      setBootPending(payload.labelId as RendererWindowLoadLabelId, payload.active)
    })
  }

  function unregisterContext(context: EventaContext) {
    contexts.delete(context)
  }

  function syncWindowRoute(window: BrowserWindow, routePath: string) {
    const entry = tracked.get(window.id)
    if (!entry)
      return
    entry.labelId = resolveRendererWindowLoadLabelId(routePath)
    broadcast()
  }

  function syncWindowRouteFromUrl(window: BrowserWindow) {
    try {
      const hash = new URL(window.webContents.getURL()).hash.slice(1)
      const path = hash.split('?')[0] || '/'
      syncWindowRoute(window, path)
    }
    catch {
      // The window may not have a navigable URL yet.
    }
  }

  function trackWindow(
    window: BrowserWindow,
    target: string | { url: string } | { file: string, options?: { hash?: string } },
  ) {
    if (attached.has(window))
      return

    attached.add(window)
    const route = extractRendererRouteFromLoadTarget(target)
    const labelId = resolveRendererWindowLoadLabelId(route)
    const windowId = window.id

    tracked.set(windowId, { labelId, loadCount: 0 })

    const onStart = () => {
      const entry = tracked.get(windowId)
      if (!entry)
        return
      entry.loadCount += 1
      broadcast()
    }

    const onStop = () => {
      const entry = tracked.get(windowId)
      if (!entry)
        return
      entry.loadCount = Math.max(0, entry.loadCount - 1)
      broadcast()
    }

    window.webContents.on('did-finish-load', () => {
      syncWindowRouteFromUrl(window)
      onStop()
    })
    window.webContents.on('did-fail-load', onStop)
    window.webContents.on('did-start-loading', onStart)
    window.webContents.on('did-stop-loading', onStop)
    window.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
      if (!isMainFrame)
        return
      syncWindowRouteFromUrl(window)
    })
    window.webContents.on('did-start-navigation', (details) => {
      if (!details.isMainFrame || details.isSameDocument)
        return
      onStart()
      try {
        const hash = new URL(details.url).hash.slice(1)
        const path = hash.split('?')[0] || '/'
        syncWindowRoute(window, path)
      }
      catch {
        // Navigation may not include a hash yet.
      }
    })
    if (window.webContents.isLoading()) {
      onStart()
    }
    window.once('closed', () => {
      tracked.delete(windowId)
      broadcast()
    })
  }

  return {
    registerContext,
    unregisterContext,
    trackWindow,
    syncWindowRoute,
    getActivity,
  }
}
