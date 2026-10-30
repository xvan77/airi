import { describe, expect, it } from 'vitest'

import { mergeRendererWindowLoadActivity } from './renderer-window-load-activity'

describe('mergeRendererWindowLoadActivity', () => {
  it('prefers boot pending labels over stale frame load labels', () => {
    const activity = mergeRendererWindowLoadActivity(
      [{ labelId: 'settings', loadCount: 1 }],
      new Map([['consciousness', 1]]),
    )

    expect(activity.activeLabelIds).toEqual(['consciousness'])
  })

  it('uses frame load labels when boot pending is empty', () => {
    const activity = mergeRendererWindowLoadActivity(
      [{ labelId: 'speech', loadCount: 1 }],
      new Map(),
    )

    expect(activity.activeLabelIds).toEqual(['speech'])
  })
})
