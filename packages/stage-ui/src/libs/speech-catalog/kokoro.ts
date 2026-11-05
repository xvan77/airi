import type { KokoroModel } from '../../workers/kokoro/constants'
import type { ModelInfo } from '../providers/types'
import type {
  SpeechCatalogRow,
  SpeechCatalogSortDirection,
  SpeechCatalogSortKey,
  SpeechModelSelectItem,
} from './types'

import { KOKORO_MODELS } from '../../workers/kokoro/constants'
import { formatDiskChip, quantSortRank } from '../model-catalog/parse'

/** Rough download size per Kokoro variant (bytes). Matches inference VRAM estimates. */
export const KOKORO_DOWNLOAD_BYTES_BY_MODEL_ID: Record<string, number> = {
  'fp16-webgpu': 165 * 1024 * 1024,
  'fp32-webgpu': 330 * 1024 * 1024,
  'fp32': 330 * 1024 * 1024,
  'fp16': 165 * 1024 * 1024,
  'q8': 82 * 1024 * 1024,
  'q4': 41 * 1024 * 1024,
  'q4f16': 41 * 1024 * 1024,
}

function kokoroDefinition(modelId: string): KokoroModel | undefined {
  return KOKORO_MODELS.find(entry => entry.id === modelId)
}

function backendRank(platform: KokoroModel['platform']): number {
  return platform === 'wasm' ? 0 : 1
}

function backendChip(platform: KokoroModel['platform']): SpeechCatalogRow['badges'][number] {
  if (platform === 'webgpu')
    return { label: 'GPU', title: 'Uses WebGPU (needs a supported GPU)' }
  return { label: 'CPU', title: 'Uses WASM on the CPU' }
}

export function buildKokoroCatalogRow(model: ModelInfo): SpeechCatalogRow {
  const definition = kokoroDefinition(model.id)
  const diskSizeBytes = KOKORO_DOWNLOAD_BYTES_BY_MODEL_ID[model.id] ?? null
  const quantization = definition?.quantization ?? null
  const quantRank = quantSortRank(quantization)
  const backend = definition?.platform ?? null
  const badges: SpeechCatalogRow['badges'] = []

  if (diskSizeBytes != null) {
    const label = formatDiskChip(diskSizeBytes)
    badges.push({
      label,
      title: `Download size about ${label}`,
    })
  }

  if (quantization) {
    badges.push({
      label: quantization.toUpperCase(),
      title: `Quantization: ${quantization}`,
    })
  }

  if (definition)
    badges.push(backendChip(definition.platform))

  return {
    model,
    diskSizeBytes,
    quantization,
    quantRank,
    backend,
    backendRank: definition ? backendRank(definition.platform) : null,
    badges,
  }
}

function compareNullableNumbers(a: number | null, b: number | null): number {
  if (a == null && b == null)
    return 0
  if (a == null)
    return 1
  if (b == null)
    return -1
  return a - b
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function orient(value: number, direction: SpeechCatalogSortDirection): number {
  return direction === 'desc' ? -value : value
}

export function sortKokoroCatalogRows(
  rows: readonly SpeechCatalogRow[],
  sortKey: SpeechCatalogSortKey,
  direction: SpeechCatalogSortDirection,
): SpeechCatalogRow[] {
  const sorted = [...rows]

  if (sortKey === 'disk') {
    sorted.sort((a, b) => {
      const byDisk = orient(compareNullableNumbers(a.diskSizeBytes, b.diskSizeBytes), direction)
      if (byDisk !== 0)
        return byDisk
      return compareStrings(a.model.name, b.model.name)
    })
    return sorted
  }

  if (sortKey === 'quant') {
    sorted.sort((a, b) => {
      const byQuant = orient(compareNullableNumbers(a.quantRank, b.quantRank), direction)
      if (byQuant !== 0)
        return byQuant
      return compareStrings(a.model.name, b.model.name)
    })
    return sorted
  }

  sorted.sort((a, b) => {
    const byBackend = orient(compareNullableNumbers(a.backendRank, b.backendRank), direction)
    if (byBackend !== 0)
      return byBackend
    return compareStrings(a.model.name, b.model.name)
  })

  return sorted
}

export function kokoroCatalogSelectItems(
  models: readonly ModelInfo[],
  sortKey: SpeechCatalogSortKey,
  sortDirection: SpeechCatalogSortDirection,
): SpeechModelSelectItem[] {
  const rows = sortKokoroCatalogRows(
    models.map(buildKokoroCatalogRow),
    sortKey,
    sortDirection,
  )

  return rows.map(row => ({
    id: row.model.id,
    name: row.model.name,
    description: row.model.description,
    deprecated: row.model.deprecated,
    badges: row.badges,
  }))
}
