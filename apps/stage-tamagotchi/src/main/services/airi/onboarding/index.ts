import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import type { OnboardingWindowManager } from '../../../windows/onboarding'

import { defineInvokeHandler } from '@moeru/eventa'
import { screen } from 'electron'

import { electronOpenOnboarding } from '../../../../shared/eventa'
import { Animator } from '../../../windows/shared/animator'
import { computeAdjacentPosition, computeCenteredWindowBounds } from '../../../windows/shared/display'
import { setWindowAlwaysOnTop, toggleWindowShow } from '../../../windows/shared/window'

const ANIMATION_DURATION = 350

export function createOnboardingService(params: {
  context: ReturnType<typeof createContext>['context']
  onboardingWindowManager: OnboardingWindowManager
  mainWindow: BrowserWindow
}) {
  const mainWindowAnimator = new Animator(params.mainWindow)
  let cleanupOnClosed: (() => void) | undefined

  defineInvokeHandler(params.context, electronOpenOnboarding, async () => {
    const savedBounds = params.mainWindow.getBounds()
    // The stage stays always-on-top. While Welcome is open beside it, unpin the stage
    // so Windows can give Welcome focus. Welcome stays a normal window (not over Hiyori).
    const restoreMainAlwaysOnTop = params.mainWindow.isAlwaysOnTop()
    if (restoreMainAlwaysOnTop)
      setWindowAlwaysOnTop(params.mainWindow, false)

    // Create Welcome hidden, slide Hiyori aside, then show Welcome.
    const onboardingWindow = await params.onboardingWindowManager.getWindow()
    const display = screen.getDisplayMatching(params.mainWindow.getBounds())
    const onboardingBounds = computeCenteredWindowBounds({
      displayWorkArea: display.workArea,
      windowBounds: onboardingWindow.getBounds(),
    })
    if (!onboardingWindow.isDestroyed())
      onboardingWindow.setBounds(onboardingBounds)

    const adjacent = computeAdjacentPosition(
      onboardingBounds,
      { width: savedBounds.width, height: savedBounds.height },
      display.workArea,
    )

    mainWindowAnimator.windowBoundsAnimateTo({
      x: adjacent.x,
      y: adjacent.y,
      width: adjacent.width,
      height: adjacent.height,
    }, { duration: ANIMATION_DURATION })

    let userMovedManually = false
    let ignoreNextMoves = true

    const moveListener = () => {
      if (ignoreNextMoves)
        return
      userMovedManually = true
    }

    params.mainWindow.on('move', moveListener)
    params.mainWindow.on('resize', moveListener)
    setTimeout(() => {
      ignoreNextMoves = false
      // After Hiyori finishes sliding aside, reveal Welcome and claim focus.
      if (!onboardingWindow.isDestroyed())
        toggleWindowShow(onboardingWindow)
    }, ANIMATION_DURATION + 50)

    cleanupOnClosed?.()

    cleanupOnClosed = params.onboardingWindowManager.onClosed(() => {
      params.mainWindow.removeListener('move', moveListener)
      params.mainWindow.removeListener('resize', moveListener)

      if (!params.mainWindow.isDestroyed()) {
        if (restoreMainAlwaysOnTop)
          setWindowAlwaysOnTop(params.mainWindow, true)
        if (!userMovedManually)
          mainWindowAnimator.windowBoundsAnimateTo(savedBounds, { duration: ANIMATION_DURATION })
      }

      cleanupOnClosed = undefined
    })
  })
}
