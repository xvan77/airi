import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  canEnrichOpenRouterCatalogDescription,
  parseOpenRouterModelPageHtml,
} from './openrouter-description'

const preview = 'NVIDIA Nemotron 3.5 Super VL is an open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. It takes text, images, documents, GUI screenshots, and video...'
const lyriaPreview = 'Full-length songs are priced at $0.08 per song. Lyria 3 is Google\'s family of music generation models, available through the Gemini API. With Lyria 3, you can generate high-quality, 48kHz...'
const lyriaFull = 'Full-length songs are priced at $0.08 per song. Lyria 3 is Google\'s family of music generation models, available through the Gemini API. With Lyria 3, you can generate high-quality, 48kHz stereo audio from text prompts or from images. These models deliver structural coherence, including vocals, timed lyrics, and full instrumental arrangements. Lyria 3 Pro can generate full-length songs with verses, choruses, bridges.'

describe('canEnrichOpenRouterCatalogDescription', () => {
  it('accepts truncated OpenRouter speech and chat previews', () => {
    expect(canEnrichOpenRouterCatalogDescription('openrouter-audio-speech', lyriaPreview)).toBe(true)
    expect(canEnrichOpenRouterCatalogDescription('openrouter-ai', preview)).toBe(true)
  })

  it('ignores complete copy and other providers', () => {
    expect(canEnrichOpenRouterCatalogDescription('openrouter-audio-speech', lyriaFull)).toBe(false)
    expect(canEnrichOpenRouterCatalogDescription('openai-audio-speech', lyriaPreview)).toBe(false)
  })
})

const lyriaClipFull = '30 second duration clips are priced at $0.04 per clip. Lyria 3 is Google\'s family of music generation models, available through the Gemini API. With Lyria 3, you can generate high-quality, 48kHz stereo audio from text prompts or from images. These models deliver structural coherence, including vocals, timed lyrics, and full instrumental arrangements. Lyria 3 Clip can generate short clips, loops, previews.'
const lyriaClipPreview = '30 second duration clips are priced at $0.04 per clip. Lyria 3 is Google\'s family of music generation models, available through the Gemini API. With Lyria 3, you can generate high-quality, 48kHz...'

describe('parseOpenRouterModelPageHtml', () => {
  it('restores a Lyria-style OpenRouter page paragraph from the truncated list preview', () => {
    const html = `<html><body><p>${lyriaFull}</p></body></html>`
    expect(parseOpenRouterModelPageHtml(html, lyriaPreview)).toBe(lyriaFull)
  })

  it('keeps only the JSON-LD description when the preview sits inside schema.org JSON', () => {
    // ROOT CAUSE:
    //
    // If the preview stem is found inside OpenRouter JSON-LD, a cut to the next
    // `</p>` copies datePublished, featureList, and page chrome into More info.
    // Consciousness already dropped that HTML slice and kept structured copy.
    //
    // We now read JSON-LD `description` and reject schema.org leftovers.
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'Google: Lyria 3 Clip Preview',
      'description': lyriaClipFull,
      'datePublished': '2026-03-30',
      'author': { '@type': 'Organization', 'name': 'Google' },
      'featureList': ['1,048,576 token context', 'Song Generation: $0.04/song'],
    })}</script></head><body><p>Providers Pricing Performance Uptime</p></body></html>`

    const parsed = parseOpenRouterModelPageHtml(html, lyriaClipPreview)
    expect(parsed).toBe(lyriaClipFull)
    expect(parsed).not.toContain('datePublished')
    expect(parsed).not.toContain('featureList')
    expect(parsed).not.toContain('Providers Pricing')
  })

  it('appends the architecture paragraph after JSON-LD description', () => {
    const first = 'NVIDIA Nemotron 3.5 Super VL is an open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. It takes text, images, documents, GUI screenshots, and video.'
    const second = 'It uses a hybrid Mamba-Transformer architecture.'
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'SoftwareApplication',
      'description': first,
    })}</script></head><body><p class="mb-3 whitespace-pre-wrap break-words leading-6 last:mb-0">${second}</p></body></html>`
    expect(parseOpenRouterModelPageHtml(html, preview)).toBe(`${first}\n\n${second}`)
  })

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
