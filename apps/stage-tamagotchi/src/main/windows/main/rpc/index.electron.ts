import type { I18n } from '../../../libs/i18n'
import type { ServerChannel } from '../../../services/airi/channel-server'
import type { McpStdioManager } from '../../../services/airi/mcp-servers'
import type { AutoUpdater } from '../../../services/electron/auto-updater'
import type { NoticeWindowManager } from '../../notice'
import type { OnboardingWindowManager } from '../../onboarding'
import type { SettingsWindowManager } from '../../settings'
import type { WidgetsWindowManager } from '../../widgets'

import clickDragPlugin from 'electron-click-drag-plugin'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { isLinux } from 'std-env'

import {
  electronGetMainWindowConfig,
  electronOpenChat,
  electronOpenMainDevtools,
  electronOpenSettings,
  electronStartDraggingWindow,
  noticeWindowEventa,
} from '../../../../shared/eventa'
import { createMcpServersService } from '../../../services/airi/mcp-servers'
import { createOnboardingService } from '../../../services/airi/onboarding'
import { createWidgetsService } from '../../../services/airi/widgets'
import { createAutoUpdaterService } from '../../../services/electron'
import { createDockModeService } from '../../../services/electron/dock-mode'
import { toggleWindowShow } from '../../shared'
import { setupBaseWindowElectronInvokes } from '../../shared/window'

export async function setupMainWindowElectronInvokes(params: {
  window: BrowserWindow
  settingsWindow: SettingsWindowManager
  chatWindow: () => Promise<BrowserWindow>
  widgetsManager: WidgetsWindowManager
  noticeWindow: NoticeWindowManager
  autoUpdater: AutoUpdater
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  onboardingWindowManager: OnboardingWindowManager
}) {
  // TODO: once we refactored eventa to support window-namespaced contexts,
  // we can remove the setMaxListeners call below since eventa will be able to dispatch and
  // manage events within eventa's context system.
  ipcMain.setMaxListeners(0)

  const { context } = createContext(ipcMain, params.window)

  await setupBaseWindowElectronInvokes({ context, window: params.window, serverChannel: params.serverChannel, i18n: params.i18n })
  createWidgetsService({ context, widgetsManager: params.widgetsManager, window: params.window })
  createAutoUpdaterService({ context, window: params.window, service: params.autoUpdater })
  createMcpServersService({ context, manager: params.mcpStdioManager })
  createOnboardingService({ context, onboardingWindowManager: params.onboardingWindowManager })
  createDockModeService({ context, window: params.window })

  defineInvokeHandler(context, electronOpenMainDevtools, () => params.window.webContents.openDevTools({ mode: 'detach' }))
  defineInvokeHandler(context, electronOpenSettings, async payload => params.settingsWindow.openWindow(payload?.route))
  defineInvokeHandler(context, electronOpenChat, async (enabled?: boolean) => {
    const win = await params.chatWindow()
    console.log(`[Main Process] [Chat Window] openChat handler called. enabled: ${enabled}, window exists: ${!!win}`)
    if (win && !win.isDestroyed()) {
      if (enabled === undefined) {
        toggleWindowShow(win)
      }
      else if (enabled) {
        console.log('[Main Process] [Chat Window] Showing chat window')
        win.show()
        win.focus()
      }
      else {
        console.log('[Main Process] [Chat Window] Hiding chat window')
        win.hide()
      }
    }
  })
  defineInvokeHandler(context, noticeWindowEventa.openWindow, payload => params.noticeWindow.open(payload))

  defineInvokeHandler(context, electronGetMainWindowConfig, () => {
    return (params.window as any).__airi_config
  })

  if (!isLinux) {
    defineInvokeHandler(context, electronStartDraggingWindow, (_payload, handlerOptions: any) => {
      try {
        const sender = handlerOptions?.raw?.ipcMainEvent?.sender
        const win = sender ? (BrowserWindow.fromWebContents(sender) ?? params.window) : params.window
        const windowId = win.getNativeWindowHandle()
        clickDragPlugin.startDrag(windowId)

        // After drag finishes, check bounds and snap to edges
        if (win && !win.isDestroyed()) {
          const bounds = win.getBounds()
          const display = screen.getDisplayMatching(bounds)
          const workArea = display.workArea
          const displayBounds = display.bounds

          const snapTargetsX = [
            workArea.x,
            workArea.x + workArea.width,
            displayBounds.x,
            displayBounds.x + displayBounds.width,
          ]
          const snapTargetsY = [
            workArea.y,
            workArea.y + workArea.height,
            displayBounds.y,
            displayBounds.y + displayBounds.height,
          ]

          const SNAP_THRESHOLD = 20
          let newX = bounds.x
          let newY = bounds.y
          let snapped = false

          const isVertical = bounds.height > bounds.width
          const isHorizontal = bounds.width > bounds.height

          if (isVertical) {
            // Check left edge snap
            let minDiffLeft = Infinity
            let targetLeft = bounds.x
            for (const tx of snapTargetsX) {
              const diff = Math.abs(bounds.x - tx)
              if (diff < minDiffLeft) {
                minDiffLeft = diff
                targetLeft = tx
              }
            }

            // Check right edge snap
            let minDiffRight = Infinity
            let targetRight = bounds.x
            for (const tx of snapTargetsX) {
              const diff = Math.abs((bounds.x + bounds.width) - tx)
              if (diff < minDiffRight) {
                minDiffRight = diff
                targetRight = tx - bounds.width
              }
            }

            if (minDiffLeft <= SNAP_THRESHOLD && minDiffLeft <= minDiffRight) {
              newX = targetLeft
              snapped = true
            }
            else if (minDiffRight <= SNAP_THRESHOLD) {
              newX = targetRight
              snapped = true
            }
          }
          else if (isHorizontal) {
            // Check top edge snap
            let minDiffTop = Infinity
            let targetTop = bounds.y
            for (const ty of snapTargetsY) {
              const diff = Math.abs(bounds.y - ty)
              if (diff < minDiffTop) {
                minDiffTop = diff
                targetTop = ty
              }
            }

            // Check bottom edge snap
            let minDiffBottom = Infinity
            let targetBottom = bounds.y
            for (const ty of snapTargetsY) {
              const diff = Math.abs((bounds.y + bounds.height) - ty)
              if (diff < minDiffBottom) {
                minDiffBottom = diff
                targetBottom = ty - bounds.height
              }
            }

            if (minDiffTop <= SNAP_THRESHOLD && minDiffTop <= minDiffBottom) {
              newY = targetTop
              snapped = true
            }
            else if (minDiffBottom <= SNAP_THRESHOLD) {
              newY = targetBottom
              snapped = true
            }
          }

          if (snapped) {
            win.setBounds({
              x: Math.round(newX),
              y: Math.round(newY),
              width: bounds.width,
              height: bounds.height,
            })
          }
        }
      }
      catch (error) {
        console.error(error)
      }
    })
  }

  ipcMain.on('main-window-config-updated', (_event, config) => {
    params.window.webContents.send('eventa:event:electron:windows:main:config-changed', config)
  })
}
