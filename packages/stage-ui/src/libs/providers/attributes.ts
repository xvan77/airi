/** Pricing category used by provider catalogue filters. */
export type ProviderPricing = 'free' | 'limited' | 'paid'

/** Where the provider runs relative to AIRI. */
export type ProviderDeployment = 'in-app' | 'other-app' | 'cloud'

export const PROVIDER_DEPLOYMENT_FILTER_OPTIONS = [
  'in-app',
  'other-app',
  'cloud',
] as const satisfies readonly ProviderDeployment[]

/**
 * Represents catalogue attributes used by provider filtering UI.
 */
export interface ProviderAttributes {
  /** Primary price bucket used for catalog sort order. */
  pricing?: ProviderPricing
  /** Every price bucket this provider can expose. */
  pricingTiers?: readonly ProviderPricing[]
  /** Runtime/deployment bucket shown by the provider source filter. */
  deployment?: ProviderDeployment
  /** Whether the provider should receive the existing recommended tag. */
  beginnerRecommended?: boolean
}

const PRICING_TIER_RANK: Record<ProviderPricing, number> = {
  free: 0,
  limited: 1,
  paid: 2,
}

export function primaryPricingTier(tiers: readonly ProviderPricing[]): ProviderPricing | undefined {
  if (tiers.length === 0)
    return undefined
  return tiers.reduce((best, tier) => PRICING_TIER_RANK[tier] < PRICING_TIER_RANK[best] ? tier : best)
}

export function providerPricingChipLabel(tier: ProviderPricing): string {
  if (tier === 'free')
    return 'FREE'
  if (tier === 'limited')
    return 'LIM'
  return 'PAID'
}

/** Minimal provider identity accepted by the attribute resolver. */
export interface ProviderAttributesInput {
  id?: string
}

const paidCloud = {
  pricing: 'paid',
  pricingTiers: ['paid'],
  deployment: 'cloud',
} satisfies ProviderAttributes

const mixedCloud = {
  pricing: 'free',
  pricingTiers: ['free', 'limited', 'paid'],
  deployment: 'cloud',
} satisfies ProviderAttributes

const freeInApp = {
  pricing: 'free',
  pricingTiers: ['free'],
  deployment: 'in-app',
} satisfies ProviderAttributes

const freeOtherApp = {
  pricing: 'free',
  pricingTiers: ['free'],
  deployment: 'other-app',
} satisfies ProviderAttributes

const recommendedPaidCloud = {
  ...paidCloud,
  beginnerRecommended: true,
} satisfies ProviderAttributes

const providerAttributesById = {
  '302-ai': paidCloud,
  'aihubmix': paidCloud,
  'aivis-speech': freeOtherApp,
  'alibaba-cloud-model-studio': paidCloud,
  'aliyun-nls-transcription': paidCloud,
  'amazon-bedrock': paidCloud,
  'anthropic': paidCloud,
  'app-local-audio-speech': freeInApp,
  'app-local-audio-transcription': freeInApp,
  'apple-vision': freeInApp,
  'atlascloud': paidCloud,
  'azure-ai-foundry': paidCloud,
  'azure-openai': paidCloud,
  'browser-local-audio-speech': freeInApp,
  'browser-local-audio-transcription': freeInApp,
  'browser-web-speech-api': freeInApp,
  'byteplus': paidCloud,
  'byteplus-coding-plan': paidCloud,
  'cerebras-ai': paidCloud,
  'cloudflare-workers-ai': paidCloud,
  'comet-api': paidCloud,
  'comet-api-speech': paidCloud,
  'comet-api-transcription': paidCloud,
  'deepgram-tts': paidCloud,
  'deepseek': paidCloud,
  'elevenlabs': paidCloud,
  'featherless-ai': paidCloud,
  'fireworks-ai': paidCloud,
  'google-generative-ai': mixedCloud,
  'google-gemini-audio-speech': mixedCloud,
  'groq': mixedCloud,
  'index-tts-vllm': freeOtherApp,
  'kokoro-local': freeInApp,
  'local-llm': freeInApp,
  'lm-studio': freeOtherApp,
  'microsoft-speech': paidCloud,
  'mimo': paidCloud,
  'mimo-audio-speech': paidCloud,
  'mimo-audio-transcription': paidCloud,
  'minimax': paidCloud,
  'minimax-global': paidCloud,
  'minimax-speech': paidCloud,
  'mistral-ai': paidCloud,
  'modelscope': paidCloud,
  'moonshot-ai': paidCloud,
  'n1n': paidCloud,
  'novita-ai': paidCloud,
  'nvidia': paidCloud,
  'official-provider': recommendedPaidCloud,
  'official-provider-speech': recommendedPaidCloud,
  'official-provider-speech-streaming': recommendedPaidCloud,
  'ollama': freeOtherApp,
  'openai': paidCloud,
  'openai-audio-speech': paidCloud,
  'openai-audio-transcription': paidCloud,
  'openai-compatible': false,
  'openai-compatible-audio-speech': false,
  'openai-compatible-audio-transcription': false,
  'openpaths': paidCloud,
  'openrouter-ai': mixedCloud,
  'openrouter-audio-speech': paidCloud,
  'perplexity-ai': paidCloud,
  'player2-speech': freeOtherApp,
  'speech-noop': false,
  'together-ai': paidCloud,
  'voicevox': freeOtherApp,
  'virtual-audio-studio': freeInApp,
  'volcengine': paidCloud,
  'volcengine-coding-plan': paidCloud,
  'xai': paidCloud,
  'zai': paidCloud,
} satisfies Record<string, ProviderAttributes | false>

/**
 * Normalizes provider attributes by dropping undefined fields.
 *
 * Before:
 * - `{ pricing: "paid", deployment: undefined }`
 *
 * After:
 * - `{ pricing: "paid" }`
 */
function compactProviderAttributes(metadata: ProviderAttributes): ProviderAttributes {
  const pricingTiers = metadata.pricingTiers?.length
    ? [...metadata.pricingTiers]
    : metadata.pricing
      ? [metadata.pricing]
      : undefined
  const pricing = metadata.pricing ?? (pricingTiers ? primaryPricingTier(pricingTiers) : undefined)

  return {
    ...(pricing ? { pricing } : {}),
    ...(pricingTiers?.length ? { pricingTiers } : {}),
    ...(metadata.deployment ? { deployment: metadata.deployment } : {}),
    ...(metadata.beginnerRecommended !== undefined ? { beginnerRecommended: metadata.beginnerRecommended } : {}),
  }
}

/**
 * Resolves the provider attributes used by settings filters.
 *
 * Use when:
 * - Rendering provider source cards.
 * - Selecting serializable metadata from a provider definition.
 *
 * Expects:
 * - `metadata.id` may identify a provider with catalogue metadata.
 *
 * Returns:
 * - Compact metadata with only meaningful tag fields.
 */
export function resolveProviderAttributes(
  metadata: ProviderAttributesInput = {},
): ProviderAttributes {
  if (!metadata.id)
    return {}

  const attributes = providerAttributesById[metadata.id as keyof typeof providerAttributesById]
  if (attributes === false)
    return {}
  if (attributes)
    return compactProviderAttributes(attributes)

  return {}
}
