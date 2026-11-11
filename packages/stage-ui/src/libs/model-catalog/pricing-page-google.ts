import type { ProviderPricing } from '../providers/attributes'
import type { ProviderTierTable } from './pricing-source'

import { registerPricingPageSource } from './pricing-source'
import { tierFromGeminiPriceCells } from './resolve-pricing-tier'

/** Gemini Developer API pricing page. The catalog reads this page for Google tiers. */
export const GOOGLE_PRICING_PAGE_URL = 'https://ai.google.dev/gemini-api/docs/pricing'

const GOOGLE_PRICING_CHECKED_AT = '2026-11-07T00:00:00.000Z'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Short form of the 2026-11-07 pricing page.
 * Each block is a model id, then the Free Tier cell and the Paid Tier cell.
 * The running app reads the live page. This text is the result shipped with AIRI.
 */
const GOOGLE_PRICING_PAGE_SNAPSHOT_TEXT = `
Gemini 4 Argon
\`gemini-4-argon\`
Input price | Not available | $2.00

Gemini 3.8 Flash
\`gemini-3.8-flash\`
Input price | Free of charge | $0.75

Gemini 3.6 Flash
\`gemini-3.6-flash\`
Input price | Free of charge | $0.75

Gemini 3.5 Transcribe Live
\`gemini-3.5-transcribe-live\`
Input price | Free of charge | $3.50

Gemini 3.5 Transcribe
\`gemini-3.5-transcribe\`
Input price | Free of charge | $2.00

Gemini 3.5 Flash-Lite
\`gemini-3.5-flash-lite\`
Input price | Free of charge | $0.30

Gemini Omni 1.2 Flash
\`gemini-omni-1.2-flash\`
Input price | Not available | $1.50

Gemini Omni 1.1 Flash
\`gemini-omni-1.1-flash\`
Input price | Not available | $1.50

Gemini 3.8 Live
\`gemini-3.8-live\`
\`gemini-3.8-live-extended-thinking\`
\`gemini-3.1-flash-live-preview\`
Input price | Free of charge | $0.75

Gemini 3.5 Live Translate
\`gemini-3.5-live-translate-preview\`
Input price | Free of charge | $3.50

Gemini 3.1 Flash-Lite
\`gemini-3.1-flash-lite\`
Input price | Free of charge | $0.25

Gemini 3.1 Pro Preview
\`gemini-3.1-pro-preview\`
\`gemini-3.1-pro-preview-customtools\`
Input price | Not available | $2.00

Gemini Nano Banana 2.1
\`gemini-nano-banana-2.1\`
Input price | Not available | $1.50

Gemini 3.1 Flash Image
\`gemini-3.1-flash-image\`
Input price | Not available | $0.50

Gemini 3.1 Flash Lite Image
\`gemini-3.1-flash-lite-image\`
Input price | Not available | $0.25

Gemini 3.8 Flash TTS
\`gemini-3.8-flash-tts\`
Input price | Free of charge | $0.50

Gemini 3.8 Flash-Lite TTS
\`gemini-3.8-flash-lite-tts\`
Input price | Free of charge | $0.50

Gemini 3.1 Flash TTS Preview
\`gemini-3.1-flash-tts-preview\`
Input price | Free of charge | $1.00

Gemini 3 Flash Preview
\`gemini-3-flash-preview\`
Input price | Free of charge | $0.50

Gemini 3 Pro Image
\`gemini-3-pro-image\`
Input price | Not available | $2.00

Gemini 2.5 Pro
\`gemini-2.5-pro\`
Input price | Free of charge | $1.25

Gemini 2.5 Flash
\`gemini-2.5-flash\`
Input price | Free of charge | $0.30

Gemini 2.5 Flash-Lite
\`gemini-2.5-flash-lite\`
Input price | Free of charge | $0.10

Gemini 2.5 Flash Native Audio
\`gemini-2.5-flash-native-audio-preview-12-2025\`
Input price | Free of charge | $0.50

Gemini 2.5 Flash Image
\`gemini-2.5-flash-image\`
Input price | Not available | $0.30

Gemini 2.5 Flash Preview TTS
\`gemini-2.5-flash-preview-tts\`
Input price | Free of charge | $0.50

Gemini 2.5 Pro Preview TTS
\`gemini-2.5-pro-preview-tts\`
Input price | Not available | $1.00

Gemini Embedding 2
\`gemini-embedding-2\`
Text input price | Free of charge | $0.20

Gemini Embedding
\`gemini-embedding-001\`
Input price | Free of charge | $0.15

Gemini Robotics ER 2 Preview
\`gemini-robotics-er-2-preview\`
Input price | Free of charge | $1.00

Gemini Robotics ER 2 Streaming Preview
\`gemini-robotics-er-2-streaming-preview\`
Input price | Free of charge | $1.00

Gemma 4
Input price | Free of charge | Not available
`

function toPlainPricingText(pageText: string): string {
  return pageText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h\d|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function priceCells(line: string): { freeCell: string, paidCell: string } | null {
  if (!/input price/i.test(line))
    return null
  const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)
  const labelIndex = cells.findIndex(cell => /input price/i.test(cell))
  if (labelIndex < 0)
    return null
  return {
    freeCell: cells[labelIndex + 1] ?? '',
    paidCell: cells[labelIndex + 2] ?? '',
  }
}

function modelIdsInLine(line: string): string[] {
  const ids: string[] = []
  for (const match of line.matchAll(/`([a-z0-9][\w.:-]*)`/gi)) {
    const id = match[1]?.trim()
    if (id)
      ids.push(id)
  }
  for (const match of line.matchAll(/\{%\s*id="([a-z0-9][\w.:-]*)"\s*%\}/gi)) {
    const id = match[1]?.trim()
    if (id && (/^gemma\b/i.test(id) || /\d/.test(id)))
      ids.push(id)
  }
  return ids
}

function markdownHeading(line: string): string | null {
  if (!line.startsWith('#'))
    return null
  let index = 0
  while (index < line.length && line[index] === '#')
    index += 1
  if (index === 0 || index > 3 || line[index] !== ' ')
    return null
  const text = line.slice(index + 1)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\{%[^%]+%\}/g, '')
    .trim()
  return text.length > 0 ? text : null
}

function isSectionHeading(line: string): boolean {
  return line.length > 0
    && line.length <= 80
    && !line.includes('|')
    && !line.includes('`')
    && !line.endsWith('.')
    && !/price/i.test(line)
}

/**
 * Reads Free, Limited, and Paid from a Gemini pricing page.
 * Free of charge with no paid price is Free. Free of charge with a paid price is Limited.
 * A free cell of "Not available" is Paid.
 */
export function parseGooglePricingPage(pageText: string, checkedAt: string): ProviderTierTable | null {
  const tiers: Record<string, ProviderPricing> = {}
  const prefixes: { prefix: string, tier: ProviderPricing }[] = []
  let pendingIds: string[] = []
  let pendingHeading = ''
  let awaitingPriceCells = 0
  let freeCell = ''

  function assignTier(tier: ProviderPricing | null) {
    if (tier && pendingIds.length > 0) {
      for (const id of pendingIds)
        tiers[id] = tier
    }
    if (tier === 'free' && /^gemma\b/i.test(pendingHeading)) {
      if (!prefixes.some(entry => entry.prefix === 'gemma-'))
        prefixes.push({ prefix: 'gemma-', tier: 'free' })
    }
    pendingIds = []
    pendingHeading = ''
    awaitingPriceCells = 0
    freeCell = ''
  }

  for (const rawLine of toPlainPricingText(pageText).split('\n')) {
    const line = rawLine.trim()
    if (!line)
      continue

    if (awaitingPriceCells > 0) {
      if (!line.startsWith('* '))
        continue
      const cell = line.slice(2).trim()
      if (awaitingPriceCells === 2) {
        freeCell = cell
        awaitingPriceCells = 1
        continue
      }
      assignTier(tierFromGeminiPriceCells(freeCell, cell))
      continue
    }

    const heading = markdownHeading(line)
    if (heading) {
      pendingIds = modelIdsInLine(line)
      pendingHeading = heading
      continue
    }

    const ids = modelIdsInLine(line)
    if (ids.length > 0) {
      pendingIds = [...pendingIds, ...ids]
      continue
    }

    if (line.startsWith('* ') && line.toLowerCase().includes('input price')) {
      awaitingPriceCells = 2
      continue
    }

    const cells = priceCells(line)
    if (!cells) {
      if (pendingIds.length === 0 && isSectionHeading(line))
        pendingHeading = line
      continue
    }

    assignTier(tierFromGeminiPriceCells(cells.freeCell, cells.paidCell))
  }

  if (Object.keys(tiers).length === 0 && prefixes.length === 0)
    return null

  return {
    checkedAt,
    ...(Object.keys(tiers).length > 0 ? { tiers } : {}),
    ...(prefixes.length > 0 ? { prefixes } : {}),
  }
}

const googleSnapshot = parseGooglePricingPage(GOOGLE_PRICING_PAGE_SNAPSHOT_TEXT, GOOGLE_PRICING_CHECKED_AT)

if (!googleSnapshot)
  throw new Error('Google pricing snapshot did not parse.')

registerPricingPageSource({
  providerId: 'google-generative-ai',
  pageUrl: GOOGLE_PRICING_PAGE_URL,
  maxAgeMs: WEEK_MS,
  snapshot: googleSnapshot,
  parse: parseGooglePricingPage,
})
