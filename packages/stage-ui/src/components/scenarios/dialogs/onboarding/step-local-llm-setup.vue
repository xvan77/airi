<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

import { defineEventa, defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useConsciousnessStore } from '../../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../../stores/providers'

const props = defineProps<{
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}>()

const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const providerId = 'local-llm'

// Inlined Eventa contracts from eventa.ts
const electronLocalLlmGetStatus = defineInvokeEventa<any>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmGetDownloadedModels = defineInvokeEventa<string[]>('eventa:invoke:electron:local-llm:get-downloaded-models')
const electronLocalLlmDownloadModel = defineInvokeEventa<void, { modelId: string, repo: string, filename: string }>('eventa:invoke:electron:local-llm:download-model')
const electronLocalLlmDeleteModel = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:delete-model')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
const electronLocalLlmCancelDownload = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:cancel-download')
const electronLocalLlmProgressEvent = defineEventa<any>('eventa:event:electron:local-llm:progress')

const catalog = [
  {
    id: 'gemma-3-270m',
    name: 'Gemma 3 270M IT',
    description: 'Extremely lightweight and fast Google Gemma 3 model. Perfect for quick testing.',
    repo: 'unsloth/gemma-3-270m-it-GGUF',
    filename: 'gemma-3-270m-it-Q5_K_M.gguf',
    size: '0.24 GB',
  },
  {
    id: 'qwen-1.5b',
    name: 'Qwen 2.5 1.5B (Recommended)',
    description: 'Fast, compact, and runs perfectly on CPU or any machine.',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: '0.96 GB',
  },
  {
    id: 'llama-3b',
    name: 'Llama 3.2 3B',
    description: 'Highly capable conversational model. Best on modern machines with 8GB+ RAM.',
    repo: 'Bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '2.02 GB',
  },
]

// State variables
const runnerStatus = ref<any>({
  state: 'idle',
  binaryExists: false,
  activeModel: null,
  port: 39000,
  error: '',
})
const downloadedModels = ref<string[]>([])
const downloadProgress = ref<any>(null)
const isCancelling = ref(false)
const isStartingServer = ref(false)
let statusPollInterval: any = null

function getInvokers() {
  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    if (context) {
      return {
        getStatus: defineInvoke(context, electronLocalLlmGetStatus),
        getDownloaded: defineInvoke(context, electronLocalLlmGetDownloadedModels),
        download: defineInvoke(context, electronLocalLlmDownloadModel),
        deleteModel: defineInvoke(context, electronLocalLlmDeleteModel),
        startServer: defineInvoke(context, electronLocalLlmStartServer),
        stopServer: defineInvoke(context, electronLocalLlmStopServer),
        cancelDownload: defineInvoke(context, electronLocalLlmCancelDownload),
      }
    }
  }
  return null
}

async function refreshState() {
  const api = getInvokers()
  if (!api)
    return
  try {
    const status = await api.getStatus()
    if (status) {
      runnerStatus.value = status
      if (status.state === 'running') {
        providersStore.forceProviderConfigured(providerId)
      }
      if (status.downloadProgress !== undefined) {
        downloadProgress.value = status.downloadProgress
      }
    }

    const downloaded = await api.getDownloaded()
    if (downloaded)
      downloadedModels.value = downloaded
  }
  catch (err) {
    console.error('[StepLocalLlmSetup] Failed to refresh state:', err)
  }
}

async function handleDownload(model: any) {
  const api = getInvokers()
  if (!api)
    return
  try {
    downloadProgress.value = {
      modelId: model.id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      speedMb: 0,
    }
    await api.download({
      modelId: model.id,
      repo: model.repo,
      filename: model.filename,
    })
  }
  catch (err: any) {
    console.error('[StepLocalLlmSetup] Download error:', err)
  }
}

async function handleCancelDownload() {
  const api = getInvokers()
  if (!api)
    return
  try {
    isCancelling.value = true
    await api.cancelDownload()
    downloadProgress.value = null
    await refreshState()
  }
  catch (err) {
    console.error('[StepLocalLlmSetup] Cancel download error:', err)
  }
  finally {
    isCancelling.value = false
  }
}

async function handleStartServer(filename: string) {
  const api = getInvokers()
  if (!api || isStartingServer.value)
    return
  try {
    isStartingServer.value = true
    await api.startServer({ modelId: filename })
    providersStore.forceProviderConfigured(providerId)
    await refreshState()
  }
  catch (err) {
    console.error('[StepLocalLlmSetup] Start server error:', err)
  }
  finally {
    isStartingServer.value = false
  }
}

async function handleStopServer() {
  const api = getInvokers()
  if (!api)
    return
  try {
    const runtimeState = providersStore.providerRuntimeState[providerId]
    if (runtimeState) {
      runtimeState.models = []
      runtimeState.isConfigured = false
    }
    await api.stopServer()
    await refreshState()
  }
  catch (err) {
    console.error('[StepLocalLlmSetup] Stop server error:', err)
  }
}

function onProgress(event: any) {
  const progress = event?.body
  if (!progress)
    return
  downloadProgress.value = progress
  if (progress.status === 'completed' || progress.status === 'failed') {
    const delay = isCancelling.value ? 0 : 3000
    setTimeout(() => {
      downloadProgress.value = null
      refreshState()
    }, delay)
  }
}

watch(() => runnerStatus.value?.state, async (newState, oldState) => {
  if (newState === 'running' && oldState !== 'running') {
    await providersStore.fetchModelsForProvider(providerId)
    await providersStore.validateProvider(providerId, { force: true })

    // Automatically set the active provider and model in consciousness store
    if (runnerStatus.value?.activeModel) {
      consciousnessStore.activeProvider = providerId
      consciousnessStore.activeModel = runnerStatus.value.activeModel
    }
  }
})

onMounted(() => {
  providersStore.initializeProvider(providerId)
  providersStore.forceProviderConfigured(providerId)
  refreshState()

  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    if (context) {
      context.on(electronLocalLlmProgressEvent, onProgress)
    }
  }

  statusPollInterval = setInterval(refreshState, 3000)
})

onUnmounted(() => {
  if (statusPollInterval)
    clearInterval(statusPollInterval)
  if (typeof window !== 'undefined') {
    const context = getElectronEventaContext()
    if (context) {
      context.off(electronLocalLlmProgressEvent, onProgress)
    }
  }
})

function handleNext() {
  props.onNext()
}

const canGoNext = computed(() => {
  return runnerStatus.value.state === 'running'
})
</script>

<template>
  <div h-full flex flex-col gap-6>
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      flex items-center gap-2
    >
      <button outline-none @click="props.onPrevious">
        <div class="i-solar:alt-arrow-left-line-duotone h-5 w-5 transition-colors hover:text-primary-500" />
      </button>
      <h2 class="flex-1 text-center text-xl text-neutral-800 font-semibold md:text-left md:text-2xl dark:text-neutral-100">
        Local LLM Setup
      </h2>
      <div class="h-5 w-5" />
    </div>

    <p
      v-motion
      :initial="{ opacity: 0 }"
      :enter="{ opacity: 1 }"
      :duration="500"
      :delay="100"
      class="text-sm text-neutral-500 dark:text-neutral-400"
    >
      Download a lightweight model to run offline. The server will run entirely on your device with 100% privacy.
    </p>

    <!-- Model Catalog / Setup -->
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
      <!-- Server Error Alert -->
      <div v-if="runnerStatus.error" :class="['rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500 font-medium']">
        Error: {{ runnerStatus.error }}
      </div>

      <!-- Models Catalog -->
      <div class="flex flex-col gap-4">
        <div
          v-for="model in catalog"
          :key="model.id"
          :class="['flex flex-col gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50']"
        >
          <div :class="['flex justify-between items-start']">
            <div class="mr-4 flex-1">
              <h4 :class="['font-bold text-sm text-neutral-800 dark:text-neutral-100']">
                {{ model.name }}
              </h4>
              <p :class="['text-xs text-neutral-400 mt-1']">
                {{ model.description }}
              </p>
              <div :class="['flex gap-2 mt-2']">
                <span :class="['px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-500']">GGUF</span>
                <span :class="['px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-400']">{{ model.size }}</span>
                <span v-if="runnerStatus.activeModel === model.filename && runnerStatus.state === 'running'" :class="['px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-green-500/10 text-green-500 border border-green-500/20']">Port: {{ runnerStatus.port }}</span>
              </div>
            </div>

            <!-- Action buttons -->
            <div :class="['flex items-center gap-2 shrink-0']">
              <button
                v-if="!downloadedModels.includes(model.filename) && (!downloadProgress || downloadProgress.modelId !== model.id)"
                :class="['px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-semibold transition']"
                :disabled="!!downloadProgress"
                @click="handleDownload(model)"
              >
                Download
              </button>
              <div v-else-if="downloadProgress && downloadProgress.modelId === model.id" :class="['flex gap-2']">
                <button
                  disabled
                  :class="['px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold cursor-not-allowed flex items-center gap-1.5']"
                >
                  <div class="i-solar:refresh-line-duotone animate-spin text-xs" />
                  {{ isCancelling ? 'Cancelling...' : `Downloading (${downloadProgress.progress}%)` }}
                </button>
                <button
                  v-if="!isCancelling"
                  :class="['px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-semibold transition']"
                  @click="handleCancelDownload"
                >
                  Cancel
                </button>
              </div>
              <div v-else :class="['flex gap-2']">
                <button
                  v-if="runnerStatus.activeModel !== model.filename"
                  :class="['px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition', (isStartingServer || runnerStatus.state === 'starting') && 'opacity-50 cursor-not-allowed']"
                  :disabled="isStartingServer || runnerStatus.state === 'starting'"
                  @click="handleStartServer(model.filename)"
                >
                  Run
                </button>
                <span
                  v-else-if="runnerStatus.state === 'starting'"
                  :class="['px-3 py-1.5 bg-amber-500/10 text-amber-500 font-semibold rounded-lg text-xs border border-amber-500/20 flex items-center gap-1.5 animate-pulse']"
                >
                  <div class="i-solar:refresh-line-duotone animate-spin text-xs" />
                  Starting...
                </span>
                <div v-else :class="['flex items-center gap-2']">
                  <span
                    :class="['px-3 py-1.5 bg-green-500/10 text-green-500 font-semibold rounded-lg text-xs border border-green-500/20']"
                  >
                    Active
                  </span>
                  <button
                    :class="['px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-semibold transition border border-red-500/20']"
                    @click="handleStopServer"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Action -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
    >
      <Button
        block
        :disabled="!canGoNext"
        :label="canGoNext ? 'Continue' : 'Please Run a Model to Continue'"
        @click="handleNext"
      />
    </div>
  </div>
</template>
