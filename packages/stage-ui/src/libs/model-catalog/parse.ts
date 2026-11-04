const PARAMETER_BILLIONS_PATTERN = /\b(\d+(?:\.\d+)?)\s*([bm])\b/i
const QUANTIZATION_PATTERN = /\b(q\d+(?:[-_][a-z0-9]+)*|fp8|fp16|fp32|bf16|int8|int4|mxfp4)\b/i
const DISK_GB_PATTERN = /(\d+(?:\.\d+)?)\s*gb/i

/**
 * Parses a parameter count from common model names and GGUF filenames.
 *
 * @example
 * parseParameterBillions('Llama-3.2-3B-Instruct') // 3
 * parseParameterBillions('gemma-3-270m-it') // 0.27
 */
export function parseParameterBillions(source: string): number | null {
  const match = source.match(PARAMETER_BILLIONS_PATTERN)
  if (!match)
    return null

  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value))
    return null

  const unit = match[2].toLowerCase()
  return unit === 'b' ? value : value / 1000
}

/**
 * Parses parameter size from id, name, then OpenRouter-style description prose.
 * Prefers active params for MoE when present, otherwise the largest B count in text.
 */
export function parseParameterBillionsFromModel(model: {
  id: string
  name: string
  description?: string
}): number | null {
  const fromIdName = parseParameterBillions(`${model.id} ${model.name}`)
  if (fromIdName != null)
    return fromIdName

  const description = model.description?.trim()
  if (!description)
    return null

  const activeMatch = description.match(/\b(\d+(?:\.\d+)?)\s*b\s+active\b/i)
  if (activeMatch) {
    const value = Number.parseFloat(activeMatch[1])
    if (Number.isFinite(value))
      return value
  }

  let maxBillions: number | null = null
  for (const match of description.matchAll(/\b(\d+(?:\.\d+)?)\s*([bm])\b/gi)) {
    const value = Number.parseFloat(match[1])
    if (!Number.isFinite(value))
      continue
    const billions = match[2].toLowerCase() === 'b' ? value : value / 1000
    if (maxBillions == null || billions > maxBillions)
      maxBillions = billions
  }
  return maxBillions
}

/**
 * Parses a quantization token from a model id or filename.
 *
 * @example
 * parseQuantizationLabel('qwen2.5-1.5b-instruct-q4_k_m.gguf') // 'Q4'
 */
export function parseQuantizationLabel(source: string): string | null {
  const match = source.match(QUANTIZATION_PATTERN)
  if (!match)
    return null

  const token = match[1]
  const qMatch = token.match(/^q(\d+)/i)
  if (qMatch)
    return `Q${qMatch[1]}`

  return token.toUpperCase()
}

/** Lower numbers sort earlier for ascending quant order. */
export function quantSortRank(label: string | null): number | null {
  if (!label)
    return null

  const qMatch = label.match(/^Q(\d+)/i)
  if (qMatch)
    return Number.parseInt(qMatch[1], 10)

  const fixed: Record<string, number> = {
    INT4: 4,
    INT8: 8,
    FP8: 8,
    FP16: 16,
    BF16: 16,
    FP32: 32,
    MXFP4: 4,
  }
  return fixed[label.toUpperCase()] ?? null
}

/** Parses a human size string such as `0.18 GB` into bytes. */
export function parseDiskSizeBytes(source: string | undefined): number | null {
  if (!source?.trim())
    return null

  const match = source.match(DISK_GB_PATTERN)
  if (!match)
    return null

  const gigabytes = Number.parseFloat(match[1])
  if (!Number.isFinite(gigabytes))
    return null

  return Math.round(gigabytes * 1024 ** 3)
}

/** Formats a token context length for compact chips. */
export function formatContextChip(contextTokens: number): string {
  if (contextTokens >= 1_000_000)
    return `${Math.round(contextTokens / 100_000) / 10}M`
  if (contextTokens >= 1000)
    return `${Math.round(contextTokens / 100) / 10}K`
  return String(contextTokens)
}

/** Formats parameter billions for compact chips. */
export function formatParameterChip(parameterBillions: number): string {
  if (parameterBillions >= 1)
    return `${Number.isInteger(parameterBillions) ? parameterBillions : parameterBillions.toFixed(1).replace(/\.0$/, '')}B`
  const millions = Math.round(parameterBillions * 1000)
  return `${millions}M`
}

/** Formats disk bytes for compact chips. */
export function formatDiskChip(diskSizeBytes: number): string {
  const gigabytes = diskSizeBytes / 1024 ** 3
  if (gigabytes >= 1)
    return `${gigabytes.toFixed(gigabytes >= 10 ? 0 : 1).replace(/\.0$/, '')}G`
  const megabytes = diskSizeBytes / 1024 ** 2
  return `${Math.round(megabytes)}M`
}

/** Prompt price in USD per 1M tokens from model-bank pricing units. */
export function resolvePromptPricePerMillion(model: { metadata?: { pricing?: { units?: Array<{ name?: string, rate?: number, unit?: string }> } } }): number | null {
  const units = model.metadata?.pricing?.units
  if (!units?.length)
    return null

  const input = units.find(unit =>
    unit.name === 'textInput'
    || unit.name === 'prompt'
    || unit.name === 'input',
  ) ?? units.find(unit => unit.unit === 'millionTokens')

  if (!input || typeof input.rate !== 'number' || !Number.isFinite(input.rate))
    return null

  return input.rate
}

export function formatPromptPriceChip(dollarsPerMillion: number): string {
  if (dollarsPerMillion === 0)
    return 'Free'
  if (dollarsPerMillion >= 1)
    return `$${dollarsPerMillion.toFixed(2)}/M`
  if (dollarsPerMillion >= 0.01)
    return `$${dollarsPerMillion.toFixed(2)}/M`
  return `$${dollarsPerMillion.toFixed(3)}/M`
}
