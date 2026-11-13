import {
  isTruncatedCatalogDescription,
  pickBestCatalogDescription as pickLongerDescription,
} from '@proj-airi/stage-shared/catalog-description'
import { fetchUrlTextForCatalog } from '@proj-airi/stage-shared/catalog-url-fetch'

export { isTruncatedCatalogDescription, pickLongerDescription }

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

/** True when More info can replace an OpenRouter `/v1/models` preview with the public model page. */
export function canEnrichOpenRouterCatalogDescription(
  providerId: string | undefined,
  description: string | undefined,
): boolean {
  if (providerId !== 'openrouter-ai' && providerId !== 'openrouter-audio-speech')
    return false
  return isTruncatedCatalogDescription(description)
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x27;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

function isCatalogProse(text: string | null | undefined): text is string {
  if (!text?.trim())
    return false
  if (text.includes('"datePublished"') || text.includes('"@type"') || text.includes('featureList'))
    return false
  if (/"\s*,\s*"/.test(text))
    return false
  return true
}

function collectJsonLdDescriptions(value: unknown, into: string[]): void {
  if (!value || typeof value !== 'object')
    return
  if (Array.isArray(value)) {
    for (const item of value)
      collectJsonLdDescriptions(item, into)
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.description === 'string')
    into.push(record.description)
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object')
      collectJsonLdDescriptions(nested, into)
  }
}

function descriptionsFromJsonLd(html: string): string[] {
  const descriptions: string[] = []
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      collectJsonLdDescriptions(JSON.parse(match[1]) as unknown, descriptions)
    }
    catch {
      continue
    }
  }
  return descriptions
}

function pickProseContainingStem(candidates: readonly string[], stem: string): string | undefined {
  const matches = candidates.filter(text => isCatalogProse(text) && text.includes(stem))
  if (!matches.length)
    return undefined
  return matches.reduce((best, text) => pickLongerDescription(best, text) ?? text)
}

function nearbyParagraphContainingStem(html: string, stem: string): string | null {
  const stemIndex = html.indexOf(stem)
  if (stemIndex < 0)
    return null

  const open = html.lastIndexOf('<p', stemIndex)
  const close = html.indexOf('</p>', stemIndex)
  if (open < 0 || close < 0 || close - open > 2500)
    return null

  const text = decodeHtmlEntities(stripHtmlTags(html.slice(open, close))).trim()
  return isCatalogProse(text) && text.includes(stem) ? text : null
}

/**
 * Reads the model prose from an OpenRouter page.
 * Prefers JSON-LD `description`. A preview stem cut at the next `</p>` copies schema.org fields.
 */
export function parseOpenRouterModelPageHtml(html: string, previewDescription: string): string | null {
  const stem = previewDescription.replace(/\.\.\.$/, '').replace(/…$/, '').trim()
  if (!stem)
    return null

  const primary = pickLongerDescription(
    pickProseContainingStem(descriptionsFromJsonLd(html), stem),
    nearbyParagraphContainingStem(html, stem) ?? undefined,
  )

  const prosePattern = /<p class="mb-3 whitespace-pre-wrap break-words[^"]*">([\s\S]*?)<\/p>/g
  const proseParagraphs = [...html.matchAll(prosePattern)]
    .map(match => decodeHtmlEntities(stripHtmlTags(match[1])).trim())
    .filter(isCatalogProse)
  const secondParagraph = proseParagraphs.find(paragraph => paragraph.startsWith('It uses'))

  if (primary && secondParagraph && !primary.includes(secondParagraph))
    return `${primary}\n\n${secondParagraph}`
  if (primary)
    return primary
  if (proseParagraphs.length >= 2 && proseParagraphs[0].includes(stem.slice(0, 40)))
    return proseParagraphs.slice(0, 2).join('\n\n')
  return secondParagraph ?? null
}

/**
 * OpenRouter `/v1/models` returns a short preview ending in `...`.
 * The public model page includes the full prose paragraphs.
 */
export async function fetchOpenRouterFullDescription(
  modelId: string,
  previewDescription?: string,
): Promise<string | null> {
  const cached = cache.get(modelId)
  if (cached) {
    if (isCatalogProse(cached))
      return cached
    cache.delete(modelId)
  }

  const pending = inflight.get(modelId)
  if (pending)
    return pending

  const request = loadOpenRouterFullDescription(modelId, previewDescription)
  inflight.set(modelId, request)
  try {
    return await request
  }
  finally {
    inflight.delete(modelId)
  }
}

async function loadOpenRouterFullDescription(
  modelId: string,
  previewDescription?: string,
): Promise<string | null> {
  const html = await fetchUrlTextForCatalog(`https://openrouter.ai/${modelId}`)
  if (!html)
    return null

  const preview = previewDescription ?? cache.get(`${modelId}:preview`) ?? ''
  const parsed = parseOpenRouterModelPageHtml(html, preview)
  if (!parsed || !isCatalogProse(parsed))
    return null

  cache.set(modelId, parsed)
  return parsed
}

export function rememberOpenRouterPreviewDescription(modelId: string, preview: string | undefined) {
  if (preview?.trim())
    cache.set(`${modelId}:preview`, preview.trim())
}

export async function enrichTruncatedOpenRouterDescriptions(
  models: readonly { id: string, description?: string }[],
  options?: { concurrency?: number, onModelEnriched?: (modelId: string, description: string) => void },
): Promise<Map<string, string>> {
  const enriched = new Map<string, string>()
  const targets = models.filter(model => isTruncatedCatalogDescription(model.description))
  const concurrency = options?.concurrency ?? 4

  for (let index = 0; index < targets.length; index += concurrency) {
    const batch = targets.slice(index, index + concurrency)
    await Promise.all(batch.map(async (model) => {
      rememberOpenRouterPreviewDescription(model.id, model.description)
      const full = await fetchOpenRouterFullDescription(model.id, model.description)
      if (full) {
        enriched.set(model.id, full)
        options?.onModelEnriched?.(model.id, full)
      }
    }))
  }

  return enriched
}
