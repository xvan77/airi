import {
  isTruncatedCatalogDescription,
  pickBestCatalogDescription as pickLongerDescription,
} from '@proj-airi/stage-shared/catalog-description'
import { fetchUrlTextForCatalog } from '@proj-airi/stage-shared/catalog-url-fetch'

export { isTruncatedCatalogDescription, pickLongerDescription }

const cache = new Map<string, string>()

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

/** Parses the model detail prose from an OpenRouter model page HTML document. */
export function parseOpenRouterModelPageHtml(html: string, previewDescription: string): string | null {
  const stem = previewDescription.replace(/\.\.\.$/, '').replace(/…$/, '').trim()
  if (!stem)
    return null

  const stemIndex = html.indexOf(stem)
  let firstParagraph: string | null = null
  if (stemIndex >= 0) {
    const tail = html.slice(stemIndex)
    const closeTag = tail.indexOf('</p>')
    if (closeTag > 0) {
      firstParagraph = decodeHtmlEntities(stripHtmlTags(tail.slice(0, closeTag))).trim()
    }
    else {
      const jsonEnd = tail.search(/"\s*[,}]/)
      firstParagraph = decodeHtmlEntities(tail.slice(0, jsonEnd > 0 ? jsonEnd : 1200).trim())
    }
  }

  const prosePattern = /<p class="mb-3 whitespace-pre-wrap break-words[^"]*leading-prose[^"]*">([\s\S]*?)<\/p>/g
  const proseParagraphs = [...html.matchAll(prosePattern)]
    .map(match => decodeHtmlEntities(stripHtmlTags(match[1])).trim())
    .filter(Boolean)

  const secondParagraph = proseParagraphs.find(paragraph => paragraph.startsWith('It uses'))

  if (firstParagraph && secondParagraph)
    return `${firstParagraph}\n\n${secondParagraph}`

  if (firstParagraph && firstParagraph.length > previewDescription.length)
    return firstParagraph

  if (proseParagraphs.length >= 2 && proseParagraphs[0].includes(stem.slice(0, 40)))
    return proseParagraphs.slice(0, 2).join('\n\n')

  return secondParagraph ?? firstParagraph
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
  if (cached)
    return cached

  const html = await fetchUrlTextForCatalog(`https://openrouter.ai/${modelId}`)
  if (!html)
    return null

  const preview = previewDescription ?? cache.get(`${modelId}:preview`) ?? ''
  const parsed = parseOpenRouterModelPageHtml(html, preview)
  if (!parsed)
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
