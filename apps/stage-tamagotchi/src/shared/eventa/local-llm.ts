import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

export interface LocalLlmServerStatus {
  state: 'idle' | 'downloading_binary' | 'starting' | 'running' | 'stopped' | 'error'
  binaryExists: boolean
  activeModel: string | null
  port: number
  error?: string
  downloadProgress?: LocalLlmDownloadProgress | null
}

export interface LocalLlmDownloadProgress {
  modelId: string
  status: 'downloading' | 'completed' | 'failed'
  bytesDownloaded: number
  totalBytes: number
  progress: number
  speedMb: number
  error?: string
}

export const electronLocalLlmGetStatus = defineInvokeEventa<LocalLlmServerStatus>('eventa:invoke:electron:local-llm:get-status')
export const electronLocalLlmGetDownloadedModels = defineInvokeEventa<string[]>('eventa:invoke:electron:local-llm:get-downloaded-models')
export const electronLocalLlmDownloadModel = defineInvokeEventa<void, { modelId: string, repo: string, filename: string }>('eventa:invoke:electron:local-llm:download-model')
export const electronLocalLlmDeleteModel = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:delete-model')
export const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
export const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
export const electronLocalLlmCancelDownload = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:cancel-download')
export const electronLocalLlmProgressEvent = defineEventa<LocalLlmDownloadProgress>('eventa:event:electron:local-llm:progress')
