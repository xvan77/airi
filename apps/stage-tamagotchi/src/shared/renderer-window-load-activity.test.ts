import { describe, expect, it } from 'vitest'

import { mergeRendererWindowLoadActivity } from './renderer-window-load-activity'

describe('mergeRendererWindowLoadActivity', () => {
  it('prefers boot pending entries over stale frame load labels', () => {
    const activity = mergeRendererWindowLoadActivity(
      [{ labelId: 'settings', loadCount: 1, routePath: '/settings' }],
      new Map([['consciousness', { count: 1, routePath: '/settings/modules/consciousness' }]]),
    )

    expect(activity.activeLabelIds).toEqual(['consciousness'])
    expect(activity.activeEntries[0]?.routePath).toBe('/settings/modules/consciousness')
  })

  it('uses frame load entries when boot pending is empty', () => {
    const activity = mergeRendererWindowLoadActivity(
      [{ labelId: 'speech', loadCount: 1, routePath: '/settings/modules/speech' }],
      new Map(),
    )

    expect(activity.activeLabelIds).toEqual(['speech'])
    expect(activity.activeEntries[0]?.routePath).toBe('/settings/modules/speech')
  })
})
