import type { ResizeDirection } from '@proj-airi/electron-eventa'

import { electron } from '@proj-airi/electron-eventa'

import { setElectronWindowResizing } from './electron-window-resize-state'
import { useElectronEventaInvoke } from './use-electron-eventa-context'

/**
 * Custom edge/corner resize for frameless Windows stage windows.
 *
 * Click-through (`setIgnoreMouseEvents`) can swallow button releases while still
 * forwarding moves. The stage fade-on-hover watcher can also turn click-through
 * back on mid-drag. Pointer capture, a buttons===0 guard, and a shared resizing
 * flag keep the drag interactive until release.
 */
export function useElectronWindowResize() {
  const isWindows = useElectronEventaInvoke(electron.app.isWindows)
  const resizeWindow = useElectronEventaInvoke(electron.window.resize)
  const setIgnoreMouseEvents = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)

  let active = false
  let lastX = 0
  let lastY = 0
  let direction: ResizeDirection | null = null
  let capturedElement: HTMLElement | null = null
  let capturedPointerId: number | null = null

  function detachListeners() {
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', stopResize, true)
    window.removeEventListener('pointercancel', stopResize, true)
    window.removeEventListener('blur', stopResize)
    window.removeEventListener('mouseup', stopResize, true)
  }

  function stopResize() {
    if (!active)
      return

    active = false
    direction = null
    detachListeners()
    setElectronWindowResizing(false)

    if (
      capturedElement
      && capturedPointerId != null
      && capturedElement.hasPointerCapture(capturedPointerId)
    ) {
      try {
        capturedElement.releasePointerCapture(capturedPointerId)
      }
      catch {
        // Capture already cleared by the browser.
      }
    }

    capturedElement = null
    capturedPointerId = null
  }

  function onPointerMove(event: PointerEvent) {
    if (!active || !direction)
      return

    // NOTICE:
    // With setIgnoreMouseEvents(true, { forward: true }), button releases can
    // fall through to windows below while move events still reach this window.
    // A move with no buttons ends a stuck resize without needing that mouseup.
    // Removal condition: remove when Electron delivers pointerup through ignore+forward on Windows.
    if (event.buttons === 0) {
      stopResize()
      return
    }

    // Re-assert interactive mode every move so fade-on-hover cannot steal the release.
    void setIgnoreMouseEvents([false, { forward: true }])

    const deltaX = event.screenX - lastX
    const deltaY = event.screenY - lastY
    if (deltaX === 0 && deltaY === 0)
      return

    void resizeWindow({ deltaX, deltaY, direction })
    lastX = event.screenX
    lastY = event.screenY
  }

  const handleResizeStart = async (e: PointerEvent, nextDirection: ResizeDirection) => {
    if (!await isWindows())
      return
    if (e.button !== 0)
      return

    e.preventDefault()
    e.stopPropagation()

    stopResize()

    const element = e.currentTarget
    if (!(element instanceof HTMLElement))
      return

    active = true
    direction = nextDirection
    lastX = e.screenX
    lastY = e.screenY
    capturedElement = element
    capturedPointerId = e.pointerId
    setElectronWindowResizing(true)

    // Keep this window interactive for the drag so the release is not click-through.
    void setIgnoreMouseEvents([false, { forward: true }])

    try {
      element.setPointerCapture(e.pointerId)
    }
    catch {
      // Window listeners still end the drag if capture is unavailable.
    }

    // Capture phase: still see the release if a child stops propagation.
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', stopResize, true)
    window.addEventListener('pointercancel', stopResize, true)
    window.addEventListener('mouseup', stopResize, true)
    window.addEventListener('blur', stopResize)
  }

  return {
    handleResizeStart,
  }
}
