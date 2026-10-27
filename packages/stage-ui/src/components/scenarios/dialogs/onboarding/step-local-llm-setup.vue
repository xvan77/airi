<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

import { defineEventa, defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { openTamagotchiEventaSession } from '../../../../composables/chat/tamagotchi-eventa-session'
import { LOCAL_LLM_BASE_CATALOG } from '../../../../libs/local-llm-catalog'
import { useConsciousnessStore } from '../../../../stores/modules/consciousness'
import { useProviderStore } from '../../../../stores/providers/provider'

interface LocalLlmDownloadProgress {
  modelId: string
  status: 'downloading' | 'completed' | 'failed'
  bytesDownloaded: number
  totalBytes: number
  progress: number
  speedMb: number
  error?: string
}

interface LocalLlmServerStatus {
  state: 'idle' | 'downloading_binary' | 'starting' | 'running' | 'stopped' | 'error'
  binaryExists: boolean
  activeModel: string | null
  port: number
  error?: string
  downloadProgress?: LocalLlmDownloadProgress | null
}

const props = defineProps<{
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}>()

const { t } = useI18n()
const providersStore = useProviderStore()
const consciousnessStore = useConsciousnessStore()
const providerId = 'local-llm'

const electronLocalLlmGetStatus = defineInvokeEventa<LocalLlmServerStatus>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmGetDownloadedModels = defineInvokeEventa<string[]>('eventa:invoke:electron:local-llm:get-downloaded-models')
const electronLocalLlmDownloadModel = defineInvokeEventa<void, { modelId: string, repo: string, filename: string }>('eventa:invoke:electron:local-llm:download-model')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
const electronLocalLlmCancelDownload = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:cancel-download')
const electronLocalLlmProgressEvent = defineEventa<LocalLlmDownloadProgress>('eventa:event:electron:local-llm:progress')

const catalog = LOCAL_LLM_BASE_CATALOG

const runnerStatus = ref<LocalLlmServerStatus>({
  state: 'idle',
  binaryExists: false,
  activeModel: null,
  port: 39000,
})
const downloadedModels = ref<string[]>([])
const downloadProgress = ref<LocalLlmDownloadProgress | null>(null)
/** Catalog model id for the row that owns the download UI until the transfer ends or the user cancels. */
const activeDownloadModelId = ref<string | null>(null)
const isCancelling = ref(false)
const cancellingModelId = ref<string | null>(null)
const isStartingServer = ref(false)

function isUserCancelledMessage(message?: string): boolean {
  if (!message)
    return false
  const lower = message.toLowerCase()
  return lower.includes('cancel') || lower.includes('abort')
}

function clearCancelledRunnerError() {
  if (isUserCancelledMessage(runnerStatus.value.error)) {
    runnerStatus.value = {
      ...runnerStatus.value,
      error: undefined,
      state: runnerStatus.value.state === 'error' ? 'idle' : runnerStatus.value.state,
    }
  }
}

const visibleRunnerError = computed(() => {
  const error = runnerStatus.value.error
  if (!error)
    return ''
  return isUserCancelledMessage(error) ? '' : error
})

function showDownloadProgressForModel(modelId: string) {
  return activeDownloadModelId.value === modelId
}

function downloadStatusLabel(modelId: string) {
  if (isCancelling.value && cancellingModelId.value === modelId)
    return t('settings.dialogs.onboarding.localLlmSetup.cancelling')

  const progress = downloadProgress.value
  if (!progress || progress.modelId !== modelId)
    return t('settings.dialogs.onboarding.localLlmSetup.downloadingStarting')

  if (progress.status === 'downloading' && progress.progress <= 0)
    return t('settings.dialogs.onboarding.localLlmSetup.downloadingStarting')

  return t('settings.dialogs.onboarding.localLlmSetup.downloading', { progress: progress.progress })
}
let statusPollInterval: ReturnType<typeof setInterval> | null = null
let progressEventaSession: ReturnType<typeof openTamagotchiEventaSession> | null = null

async function withLocalLlmSession<T>(handler: (invokers: {
  getStatus: () => Promise<LocalLlmServerStatus>
  getDownloaded: () => Promise<string[]>
  download: (req: { modelId: string, repo: string, filename: string }) => Promise<void>
  startServer: (req: { modelId: string }) => Promise<void>
  stopServer: () => Promise<void>
  cancelDownload: () => Promise<void>
}) => Promise<T>): Promise<T | undefined> {
  const session = openTamagotchiEventaSession()
  if (!session)
    return undefined

  try {
    const context = session.context
    return await handler({
      getStatus: defineInvoke(context, electronLocalLlmGetStatus),
      getDownloaded: defineInvoke(context, electronLocalLlmGetDownloadedModels),
      download: defineInvoke(context, electronLocalLlmDownloadModel),
      startServer: defineInvoke(context, electronLocalLlmStartServer),
      stopServer: defineInvoke(context, electronLocalLlmStopServer),
      cancelDownload: defineInvoke(context, electronLocalLlmCancelDownload),
    })
  }
  finally {
    session.dispose()
  }
}

function syncConsciousnessFromRunner() {
  if (runnerStatus.value?.state !== 'running' || !runnerStatus.value.activeModel)
    return

  consciousnessStore.activeProvider = providerId
  consciousnessStore.activeModel = runnerStatus.value.activeModel
}

async function refreshState() {
  if (isCancelling.value)
    return

  await withLocalLlmSession(async (api) => {
    try {
      const status = await api.getStatus()
      if (status) {
        runnerStatus.value = status
        clearCancelledRunnerError()
        if (status.state === 'running') {
          await providersStore.forceProviderConfigured(providerId)
          syncConsciousnessFromRunner()
        }
        if (
          status.downloadProgress !== undefined
          && !isCancelling.value
          && activeDownloadModelId.value
          && !isUserCancelledMessage(status.downloadProgress?.error)
        ) {
          downloadProgress.value = status.downloadProgress
        }
      }

      const downloaded = await api.getDownloaded()
      if (downloaded)
        downloadedModels.value = downloaded
    }
    catch (error) {
      console.error('[StepLocalLlmSetup] Failed to refresh state:', error)
    }
  })
}

async function handleDownload(model: typeof catalog[number]) {
  activeDownloadModelId.value = model.id
  await withLocalLlmSession(async (api) => {
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
    catch (error) {
      console.error('[StepLocalLlmSetup] Download error:', error)
      if (activeDownloadModelId.value === model.id)
        activeDownloadModelId.value = null
    }
  })
}

async function handleCancelDownload() {
  if (isCancelling.value || !downloadProgress.value)
    return

  cancellingModelId.value = activeDownloadModelId.value ?? downloadProgress.value.modelId
  isCancelling.value = true
  try {
    await withLocalLlmSession(async (api) => {
      await api.cancelDownload()
    })
    clearCancelledRunnerError()
  }
  catch (error) {
    console.error('[StepLocalLlmSetup] Cancel download error:', error)
  }
  finally {
    isCancelling.value = false
    cancellingModelId.value = null
    activeDownloadModelId.value = null
    downloadProgress.value = null
  }

  clearCancelledRunnerError()
  await refreshState()
}

async function handleStartServer(filename: string) {
  if (isStartingServer.value)
    return

  try {
    isStartingServer.value = true
    await withLocalLlmSession(async (api) => {
      await api.startServer({ modelId: filename })
    })
    await providersStore.forceProviderConfigured(providerId)
    await refreshState()
  }
  catch (error) {
    console.error('[StepLocalLlmSetup] Start server error:', error)
  }
  finally {
    isStartingServer.value = false
  }
}

async function handleStopServer() {
  await withLocalLlmSession(async (api) => {
    try {
      await api.stopServer()
      await refreshState()
    }
    catch (error) {
      console.error('[StepLocalLlmSetup] Stop server error:', error)
    }
  })
}

function onProgress(event: { body?: LocalLlmDownloadProgress }) {
  if (isCancelling.value)
    return

  const progress = event?.body
  if (!progress)
    return

  if (progress.status === 'failed' && isUserCancelledMessage(progress.error))
    return

  downloadProgress.value = progress
  if (progress.status === 'completed') {
    activeDownloadModelId.value = null
    downloadProgress.value = null
    void refreshState()
    return
  }

  if (progress.status === 'failed') {
    const delay = 3000
    setTimeout(() => {
      if (!isCancelling.value) {
        activeDownloadModelId.value = null
        downloadProgress.value = null
      }
      void refreshState()
    }, delay)
  }
}

watch(() => runnerStatus.value?.state, async (newState, oldState) => {
  if (newState === 'running' && oldState !== 'running') {
    await providersStore.fetchModelsForProvider(providerId)
    await providersStore.validateProvider(providerId, { force: true })
    syncConsciousnessFromRunner()
  }
})

onMounted(() => {
  void providersStore.initializeProvider(providerId)
  void providersStore.forceProviderConfigured(providerId)
  void refreshState()

  progressEventaSession = openTamagotchiEventaSession()
  if (progressEventaSession)
    progressEventaSession.context.on(electronLocalLlmProgressEvent, onProgress)

  statusPollInterval = setInterval(() => void refreshState(), 3000)
})

onUnmounted(() => {
  if (statusPollInterval)
    clearInterval(statusPollInterval)

  if (progressEventaSession) {
    progressEventaSession.context.off(electronLocalLlmProgressEvent, onProgress)
    progressEventaSession.dispose()
    progressEventaSession = null
  }
})

const canGoNext = computed(() => runnerStatus.value.state === 'running')
</script>

<template>
  <div class="h-full min-h-0 flex flex-col justify-between gap-4 overflow-y-auto">
    <div class="flex flex-col gap-4">
      <div
        v-motion
        :initial="{ opacity: 0, y: -10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        class="flex items-center gap-2"
      >
        <button outline-none @click="props.onPrevious">
          <div class="i-solar:alt-arrow-left-line-duotone h-4 w-4 transition-colors hover:text-primary-500" />
        </button>
        <h2 class="flex-1 text-center text-lg text-neutral-800 font-semibold md:text-left dark:text-neutral-100">
          {{ t('settings.dialogs.onboarding.localLlmSetup.title') }}
        </h2>
        <div class="h-4 w-4" />
      </div>

      <div
        v-motion
        :initial="{ opacity: 0 }"
        :enter="{ opacity: 1 }"
        :duration="500"
        :delay="80"
        class="flex flex-col gap-3 text-xs text-neutral-600 leading-relaxed dark:text-neutral-400"
      >
        <p>{{ t('settings.dialogs.onboarding.localLlmSetup.description') }}</p>
        <p>{{ t('settings.dialogs.onboarding.localLlmSetup.downloadDisclaimer') }}</p>
      </div>
    </div>

    <div class="flex flex-col gap-4 px-0.5">
      <div v-if="visibleRunnerError" class="border border-red-500/20 rounded-lg bg-red-500/10 p-4 text-sm text-red-500 font-medium">
        {{ t('settings.dialogs.onboarding.localLlmSetup.error', { error: visibleRunnerError }) }}
      </div>

      <div class="flex flex-col gap-4">
        <div
          v-for="model in catalog"
          :key="model.id"
          class="flex items-start justify-between gap-2 border border-neutral-200 rounded-lg bg-neutral-50/50 p-2.5 dark:border-neutral-800 dark:bg-neutral-800/50"
        >
          <div class="min-w-0 flex-1">
            <h4 class="text-sm text-neutral-800 font-bold leading-tight dark:text-neutral-100">
              {{ model.name }}
            </h4>
            <p class="mt-0.5 text-[11px] text-neutral-400 leading-snug">
              {{ model.description }}
            </p>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <span class="rounded bg-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500 font-bold dark:bg-neutral-800">GGUF</span>
              <span class="rounded bg-neutral-200 px-2 py-0.5 text-[10px] text-neutral-400 font-bold dark:bg-neutral-800">{{ model.size }}</span>
              <span
                v-if="runnerStatus.activeModel === model.filename && runnerStatus.state === 'running'"
                class="border border-green-500/20 rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500 font-bold font-mono"
              >
                {{ t('settings.dialogs.onboarding.localLlmSetup.port', { port: runnerStatus.port }) }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center self-center gap-1.5">
            <button
              v-if="!downloadedModels.includes(model.filename) && !showDownloadProgressForModel(model.id)"
              class="rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white font-semibold transition hover:bg-primary-600"
              :disabled="!!activeDownloadModelId || isCancelling"
              @click="handleDownload(model)"
            >
              {{ t('settings.dialogs.onboarding.localLlmSetup.download') }}
            </button>
            <div v-else-if="showDownloadProgressForModel(model.id)" class="flex gap-2">
              <button
                disabled
                class="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-1.5 text-xs text-neutral-400 font-semibold dark:bg-neutral-800"
              >
                <div class="i-solar:refresh-line-duotone animate-spin text-xs" />
                {{ downloadStatusLabel(model.id) }}
              </button>
              <button
                v-if="!isCancelling"
                class="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-500 font-semibold transition hover:bg-red-500/20"
                @click="handleCancelDownload"
              >
                {{ t('settings.dialogs.onboarding.localLlmSetup.cancel') }}
              </button>
            </div>
            <div v-else class="flex gap-2">
              <button
                v-if="runnerStatus.activeModel !== model.filename"
                class="rounded-lg bg-green-500 px-3 py-1.5 text-xs text-white font-semibold transition hover:bg-green-600"
                :class="(isStartingServer || runnerStatus.state === 'starting') && 'cursor-not-allowed opacity-50'"
                :disabled="isStartingServer || runnerStatus.state === 'starting'"
                @click="handleStartServer(model.filename)"
              >
                {{ t('settings.dialogs.onboarding.localLlmSetup.run') }}
              </button>
              <span
                v-else-if="runnerStatus.state === 'starting'"
                class="flex animate-pulse items-center gap-1.5 border border-amber-500/20 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500 font-semibold"
              >
                <div class="i-solar:refresh-line-duotone animate-spin text-xs" />
                {{ t('settings.dialogs.onboarding.localLlmSetup.starting') }}
              </span>
              <div v-else class="flex items-center gap-2">
                <span class="border border-green-500/20 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs text-green-500 font-semibold">
                  {{ t('settings.dialogs.onboarding.localLlmSetup.active') }}
                </span>
                <button
                  class="border border-red-500/20 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-500 font-semibold transition hover:bg-red-500/20"
                  @click="handleStopServer"
                >
                  {{ t('settings.dialogs.onboarding.localLlmSetup.stop') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <p
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="300"
        class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400"
      >
        {{ t('settings.dialogs.onboarding.localLlmSetup.serverRunReminder') }}
      </p>

      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="350"
      >
        <Button
          block
          color="primary"
          variant="primary"
          :disabled="!canGoNext"
          :label="canGoNext
            ? t('settings.dialogs.onboarding.localLlmSetup.continue')
            : t('settings.dialogs.onboarding.localLlmSetup.continueBlocked')"
          @click="props.onNext"
        />
      </div>
    </div>
  </div>
</template>
