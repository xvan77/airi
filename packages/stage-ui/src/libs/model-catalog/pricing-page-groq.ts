import type { ProviderPricing } from '../providers/attributes'
import type { ProviderTierTable } from './pricing-source'

import { registerPricingPageSource } from './pricing-source'
import { tierFromExplicitCatalogLabel } from './resolve-pricing-tier'

/** GroqCloud models and rate limits page. The catalog uses it for Limited vs Paid chips. */
export const GROQ_PRICING_PAGE_URL = 'https://console.groq.com/docs/models'

const GROQ_PRICING_CHECKED_AT = '2026-11-10T00:00:00.000Z'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Short form of the Groq models page.
 * Each line is `model-id | tier`.
 * A trailing `*` on the id marks a prefix rule, for example `canopylabs/orpheus* | paid`.
 * Limited means the Free plan can run the model inside Groq rate limits.
 */
const GROQ_PRICING_PAGE_SNAPSHOT_TEXT = `
# Production chat models on the Free plan (Developer rate limits on the models page).
llama-3.1-8b-instant | limited
llama-3.3-70b-versatile | limited
openai/gpt-oss-120b | limited
openai/gpt-oss-20b | limited

# Preview chat models you can try on the Free plan before you enable pay-as-you-go billing.
openai/gpt-oss-safeguard-20b | limited
qwen/qwen3.8-27b | limited
gemma2* | limited
llama-3.1* | limited
llama-3.3* | limited
openai/gpt-oss* | limited
qwen/qwen* | limited

# Billed audio, voice, and guard models (not general Consciousness chat).
canopylabs/orpheus* | paid
whisper* | paid
meta-llama/llama-prompt-guard* | paid
meta-models/* | paid
minimaxai/* | paid
`

function parseGroqPricingPage(pageText: string, checkedAt: string): ProviderTierTable | null {
  const tiers: Record<string, ProviderPricing> = {}
  const prefixes: { prefix: string, tier: ProviderPricing }[] = []

  for (const line of pageText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue

    const match = trimmed.match(/^([^|]+)\|\s*(free|limited|paid)\s*$/iu)
    if (!match)
      continue

    const rawId = match[1]!.trim()
    const tier = tierFromExplicitCatalogLabel(match[2]!.toLowerCase() as ProviderPricing)
    if (rawId.endsWith('*')) {
      prefixes.push({ prefix: rawId.slice(0, -1), tier })
      continue
    }
    tiers[rawId] = tier
  }

  if (Object.keys(tiers).length === 0 && prefixes.length === 0)
    return null

  return {
    checkedAt,
    ...(Object.keys(tiers).length > 0 ? { tiers } : {}),
    ...(prefixes.length > 0 ? { prefixes } : {}),
  }
}

const groqSnapshot = parseGroqPricingPage(GROQ_PRICING_PAGE_SNAPSHOT_TEXT, GROQ_PRICING_CHECKED_AT)

if (!groqSnapshot)
  throw new Error('Groq pricing snapshot did not parse.')

registerPricingPageSource({
  providerId: 'groq',
  pageUrl: GROQ_PRICING_PAGE_URL,
  maxAgeMs: WEEK_MS,
  snapshot: groqSnapshot,
  parse: parseGroqPricingPage,
})
