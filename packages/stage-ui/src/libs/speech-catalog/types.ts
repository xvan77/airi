import type { ModelInfo } from '../providers/types'

export type SpeechCatalogSortKey = 'disk' | 'quant' | 'backend'

export type SpeechCatalogSortDirection = 'asc' | 'desc'

export interface SpeechCatalogBadge {
  label: string
  title: string
}

export interface SpeechCatalogRow {
  model: ModelInfo
  diskSizeBytes: number | null
  quantization: string | null
  quantRank: number | null
  /** `webgpu` or `wasm` for Kokoro. */
  backend: 'webgpu' | 'wasm' | null
  backendRank: number | null
  badges: SpeechCatalogBadge[]
}

export interface SpeechModelSelectItem {
  id: string
  name: string
  description?: string
  deprecated?: boolean
  badges?: SpeechCatalogBadge[]
  statusChip?: {
    label: string
    active: boolean
  }
}
