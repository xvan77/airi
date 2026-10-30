import { describe, expect, it } from 'vitest'

import { resolveRendererWindowLoadLabelId } from './renderer-window-load-label'

describe('resolveRendererWindowLoadLabelId', () => {
  it('maps the main stage route to main', () => {
    expect(resolveRendererWindowLoadLabelId('/')).toBe('main')
  })

  it('maps consciousness and speech module routes', () => {
    expect(resolveRendererWindowLoadLabelId('/settings/modules/consciousness')).toBe('consciousness')
    expect(resolveRendererWindowLoadLabelId('/settings/modules/speech')).toBe('speech')
  })

  it('maps nested settings routes to settings', () => {
    expect(resolveRendererWindowLoadLabelId('/settings/providers')).toBe('settings')
  })

  it('maps chat routes to chat', () => {
    expect(resolveRendererWindowLoadLabelId('/chat-floating')).toBe('chat')
  })
})
