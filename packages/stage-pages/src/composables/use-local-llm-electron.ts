import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { onUnmounted, ref } from 'vue'

interface LocalLlmServerStatus {
  state: 'idle' | 'downloading_binary' | 'starting' | 'running' | 'stopped' | 'error'
  binaryExists: boolean
  activeModel: string | null
  port: number
  error?: string
  downloadProgress?: LocalLlmDownloadProgress | null
}

interface LocalLlmDownloadProgress {
  modelId: string
  status: 'downloading' | 'completed' | 'failed'
  bytesDownloaded: number
  totalBytes: number
  progress: number
  speedMb: number
  error?: string
}

const electronLocalLlmGetStatus = defineInvokeEventa<LocalLlmServerStatus>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmGetDownloadedModels = defineInvokeEventa<string[]>('eventa:invoke:electron:local-llm:get-downloaded-models')
const electronLocalLlmDownloadModel = defineInvokeEventa<void, { modelId: string, repo: string, filename: string }>('eventa:invoke:electron:local-llm:download-model')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')

function getInvokers() {
  if (!isStageTamagotchi() || typeof window === 'undefined')
    return null
  const context = getElectronEventaContext()
  if (!context)
    return null
  return {
    getStatus: defineInvoke(context, electronLocalLlmGetStatus),
    getDownloaded: defineInvoke(context, electronLocalLlmGetDownloadedModels),
    download: defineInvoke(context, electronLocalLlmDownloadModel),
    startServer: defineInvoke(context, electronLocalLlmStartServer),
    stopServer: defineInvoke(context, electronLocalLlmStopServer),
  }
}

export function useLocalLlmElectron() {
  const status = ref<LocalLlmServerStatus | null>(null)
  const downloadedModels = ref<string[]>([])
  const isStartingServer = ref(false)
  const isDownloading = ref(false)
  const downloadProgress = ref<LocalLlmDownloadProgress | null>(null)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const api = getInvokers()
    if (!api)
      return
    try {
      status.value = await api.getStatus()
      downloadedModels.value = await api.getDownloaded()
      if (status.value?.downloadProgress)
        downloadProgress.value = status.value.downloadProgress
      else if (downloadProgress.value?.status !== 'downloading')
        downloadProgress.value = null
    }
    catch (error) {
      console.error('[Local LLM] Failed to refresh status:', error)
    }
  }

  function startPolling() {
    if (pollInterval)
      return
    void refresh()
    pollInterval = setInterval(() => void refresh(), 3000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  async function downloadModel(payload: { modelId: string, repo: string, filename: string }) {
    const api = getInvokers()
    if (!api)
      return
    isDownloading.value = true
    try {
      await api.download(payload)
      await refresh()
    }
    finally {
      isDownloading.value = false
    }
  }

  async function startServer(modelFilename: string) {
    const api = getInvokers()
    if (!api || isStartingServer.value)
      return
    isStartingServer.value = true
    if (status.value)
      status.value = { ...status.value, state: 'starting' }
    try {
      await api.startServer({ modelId: modelFilename })
      await refresh()
    }
    finally {
      isStartingServer.value = false
    }
  }

  async function stopServer() {
    const api = getInvokers()
    if (!api)
      return
    await api.stopServer()
    await refresh()
  }

  function resolveModelToRun(preferredModel: string) {
    const downloaded = downloadedModels.value
    if (preferredModel && downloaded.includes(preferredModel))
      return preferredModel
    return downloaded[0] ?? ''
  }

  onUnmounted(() => stopPolling())

  return {
    status,
    downloadedModels,
    isStartingServer,
    isDownloading,
    downloadProgress,
    refresh,
    startPolling,
    stopPolling,
    downloadModel,
    startServer,
    stopServer,
    resolveModelToRun,
  }
}
