import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseOpenRouterModelPageHtml } from './openrouter-description'

const preview = 'NVIDIA Nemotron 3.5 Super VL is an open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. It takes text, images, documents, GUI screenshots, and video...'

describe('parseOpenRouterModelPageHtml', () => {
  it('reconstructs both prose paragraphs from a saved model page', () => {
    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.tmp-or-page.html')
    let html = ''
    try {
      html = readFileSync(fixturePath, 'utf8')
    }
    catch {
      return
    }

    const parsed = parseOpenRouterModelPageHtml(html, preview)
    expect(parsed).toBeTruthy()
    expect(parsed).toContain('12B active parameters out of 120B total')
    expect(parsed).toContain('It uses a hybrid Mamba-Transformer architecture')
    expect(parsed?.endsWith('...')).toBe(false)
  })
})
