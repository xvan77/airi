<script setup lang="ts">
import type { InferenceModelStatus, VoiceType } from '@proj-airi/stage-ui/composables'
import type { KokoroDownloadProgressSnapshot } from '@proj-airi/stage-ui/libs/inference/kokoro-download-progress'
import type { SpeechCatalogSortDirection, SpeechCatalogSortKey } from '@proj-airi/stage-ui/libs/speech-catalog'
import type { VoiceInfo } from '@proj-airi/stage-ui/stores/providers/provider'
import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import { errorMessageFrom } from '@moeru/std'
import {
  Alert,
  ErrorContainer,
  RadioCardManySelect,
  RadioCardSimple,
  SettingsSplitPane,
  SpeechAudioConsole,
  SpeechModelCatalogFilters,
  TestDummyMarker,
  VoiceCardManySelect,
} from '@proj-airi/stage-ui/components'
import { removeInferenceStatus, useAnalytics, useInferenceStatus } from '@proj-airi/stage-ui/composables'
import { applyVoiceProfileEffects } from '@proj-airi/stage-ui/composables/audio/audio-effects'
import { formatChatProviderErrorContent } from '@proj-airi/stage-ui/libs/chat-provider-error-message'
import { clearModelCache, isKokoroSpeechModelDownloaded } from '@proj-airi/stage-ui/libs/inference'
import { getKokoroAdapter } from '@proj-airi/stage-ui/libs/inference/adapters/kokoro'
import { formatDownloadSpeed, resolveProgressPercent, smoothDownloadSpeed } from '@proj-airi/stage-ui/libs/inference/protocol'
import { compareProviderCatalogOrder } from '@proj-airi/stage-ui/libs/model-catalog'
import { OFFICIAL_SPEECH_PROVIDER_ID, OFFICIAL_SPEECH_STREAMING_PROVIDER_ID } from '@proj-airi/stage-ui/libs/providers/providers/official'
import { kokoroCatalogSelectItems } from '@proj-airi/stage-ui/libs/speech-catalog'
import { VIRTUAL_AUDIO_STUDIO_PROVIDER_ID } from '@proj-airi/stage-ui/libs/speech/voice-profile'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores'
import { useAudioContext } from '@proj-airi/stage-ui/stores/audio'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { KOKORO_MODELS, kokoroInferenceStatusIdForSpeechModel } from '@proj-airi/stage-ui/workers/kokoro/constants'
import {
  FieldCheckbox,
  FieldInput,
  SettingsCard,
  Skeleton,
  Textarea,
} from '@proj-airi/ui'
import { generateSpeech } from '@xsai/generate-speech'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import SpeechBrowsingLastVoiceBanner from './speech-browsing-last-voice-banner.vue'
import SpeechPlaygroundTestTarget from './speech-playground-test-target.vue'

const { t } = useI18n()
const route = useRoute()
const providersStore = useProviderStore()
const providerStore = useProviderConfigStore()
const speechStore = useSpeechStore()
const audioContextStore = useAudioContext()
let consolePreviewSource: AudioBufferSourceNode | null = null
let consolePreviewCleanup: (() => void) | undefined
const airiCardStore = useAiriCardStore()
const { configuredProviders } = storeToRefs(providerStore)
const { allAudioSpeechProvidersMetadata, moduleSpeechProvidersMetadata } = storeToRefs(providersStore)
const {
  activeSpeechProvider,
  activeSpeechModel,
  activeSpeechVoice,
  activeSpeechVoiceId,
  isLoadingSpeechProviderVoices,
  modelSearchQuery,
  speechProviderError,
  ssmlEnabled,
  availableVoices,
  kokoroDownloadProgress,
} = storeToRefs(speechStore)

const {
  trackProviderClick,
  trackOfficialTtsExposed,
  trackOfficialTtsPreviewStarted,
  trackOfficialTtsPreviewSucceeded,
  trackVoicePreviewPlayed,
  trackVoiceSelected,
} = useAnalytics()

const voiceSearchQuery = ref('')
const kokoroSortKey = ref<SpeechCatalogSortKey>('disk')
const kokoroSortDirection = ref<SpeechCatalogSortDirection>('asc')
const kokoroQuantDownloaded = ref<Record<string, boolean>>({})
const clearingKokoroDownloads = ref(false)
const isCancellingKokoroDownload = ref(false)
const useSSML = ref(false)
const testText = ref('Hello, my name is AI Assistant')
const ssmlText = ref('')
const isGenerating = ref(false)
const audioUrl = ref('')
const audioPlayer = ref<HTMLAudioElement | null>(null)
const errorMessage = ref('')
let lastOfficialTtsExposureKey = ''
// Playground Test Voice generation.
// begin() starts a test. discard() runs when the user leaves that test.
// A finished OpenAI test must not write this page after Gemini is selected.
let speechPlaygroundTestGeneration = 0

const { models: inferenceModels } = useInferenceStatus()

const KOKORO_LOADING_STATES = new Set<InferenceModelStatus['state']>([
  'downloading',
  'compiling',
  'warming-up',
])

function resolveKokoroInferenceStatus(speechModelId: string): InferenceModelStatus | null {
  const statusId = kokoroInferenceStatusIdForSpeechModel(speechModelId)
  if (statusId) {
    const match = inferenceModels.value.find(entry => entry.modelId === statusId)
    if (match)
      return match
  }

  const legacyId = speechModelId ? `kokoro-${speechModelId}` : null
  if (legacyId) {
    const legacy = inferenceModels.value.find(entry => entry.modelId === legacyId)
    if (legacy)
      return legacy
  }

  return inferenceModels.value.find(entry =>
    entry.modelId.startsWith('kokoro-')
    && KOKORO_LOADING_STATES.has(entry.state),
  ) ?? null
}

function kokoroDownloadingPercentLabel(percent: number): string {
  return t('settings.pages.modules.speech.model_catalog.progress.downloading_percent', {
    progress: Math.round(percent),
  })
}

function kokoroProgressDownloadFile(
  synced: KokoroDownloadProgressSnapshot | null,
  activeSpeechModelId: string,
  status: InferenceModelStatus | null,
): string | undefined {
  if (synced?.speechModelId === activeSpeechModelId && synced.file)
    return synced.file
  if (status?.progress?.file)
    return status.progress.file
  return undefined
}

function kokoroDownloadingStatusLabel(percent: number, hasByteProgress: boolean): string {
  if (hasByteProgress || percent > 0)
    return kokoroDownloadingPercentLabel(percent)

  return t('settings.pages.modules.speech.model_catalog.progress.downloading_model')
}

function kokoroDownloadProgressMessage(
  synced: KokoroDownloadProgressSnapshot | null,
  activeSpeechModelId: string,
): string | null {
  if (!synced || synced.speechModelId !== activeSpeechModelId)
    return null

  if (synced.state === 'downloading') {
    const hasByteProgress = synced.loaded != null && synced.loaded > 0
    return kokoroDownloadingStatusLabel(synced.percent, hasByteProgress)
  }

  if (synced.state === 'compiling')
    return t('settings.pages.modules.speech.model_catalog.progress.compiling')
  if (synced.state === 'warming-up')
    return t('settings.pages.modules.speech.model_catalog.progress.warming_up')

  return null
}

function kokoroProgressMessage(
  synced: KokoroDownloadProgressSnapshot | null,
  activeSpeechModelId: string,
  status: InferenceModelStatus | null,
  voicesLoading: boolean,
  modelOnDisk: boolean,
  cancelling: boolean,
): string {
  if (cancelling)
    return t('settings.pages.modules.speech.model_catalog.progress.cancelling_download')

  if (voicesLoading && modelOnDisk)
    return t('settings.pages.modules.speech.model_catalog.progress.loading_voices')

  if (
    modelOnDisk
    && status?.state === 'downloading'
    && (status.progress?.loaded == null || !(status.progress.loaded > 0))
  ) {
    return t('settings.pages.modules.speech.model_catalog.progress.loading_voices')
  }

  const syncedMessage = kokoroDownloadProgressMessage(synced, activeSpeechModelId)
  if (syncedMessage)
    return syncedMessage

  if (status && KOKORO_LOADING_STATES.has(status.state)) {
    if (status.state === 'downloading') {
      const progress = status.progress
      const percent = progress ? resolveProgressPercent(progress) : -1
      const hasByteProgress = progress?.loaded != null && progress.loaded > 0
      return kokoroDownloadingStatusLabel(percent >= 0 ? percent : 0, hasByteProgress)
    }

    if (status.state === 'compiling')
      return t('settings.pages.modules.speech.model_catalog.progress.compiling')
    if (status.state === 'warming-up')
      return t('settings.pages.modules.speech.model_catalog.progress.warming_up')
  }

  if (voicesLoading && !modelOnDisk)
    return t('settings.pages.modules.speech.model_catalog.progress.downloading_model')

  if (voicesLoading)
    return t('settings.pages.modules.speech.model_catalog.progress.loading_voices')

  return ''
}

function kokoroActiveDownloadHasByteProgress(
  synced: KokoroDownloadProgressSnapshot | null,
  activeSpeechModelId: string,
  status: InferenceModelStatus | null,
): boolean {
  if (synced?.speechModelId === activeSpeechModelId && synced.loaded != null && synced.loaded > 0)
    return true

  const progress = status?.progress
  return progress?.loaded != null && progress.loaded > 0
}

const activeKokoroModelOnDisk = computed(() => {
  if (!activeSpeechModel.value)
    return false
  return kokoroQuantDownloaded.value[activeSpeechModel.value] === true
})

const kokoroProgressIsDownloadPhase = computed(() => {
  if (activeSpeechProvider.value !== 'kokoro-local')
    return false

  if (isLoadingSpeechProviderVoices.value && activeKokoroModelOnDisk.value)
    return false

  const status = resolveKokoroInferenceStatus(activeSpeechModel.value)
  if (status?.state === 'downloading' && activeKokoroModelOnDisk.value) {
    const hasByteProgress = status.progress?.loaded != null && status.progress.loaded > 0
    if (!hasByteProgress)
      return false
  }

  if (status && KOKORO_LOADING_STATES.has(status.state))
    return true

  return isLoadingSpeechProviderVoices.value && !activeKokoroModelOnDisk.value
})

const kokoroProgressText = computed(() => {
  if (activeSpeechProvider.value !== 'kokoro-local')
    return ''

  return kokoroProgressMessage(
    kokoroDownloadProgress.value,
    activeSpeechModel.value,
    resolveKokoroInferenceStatus(activeSpeechModel.value),
    isLoadingSpeechProviderVoices.value,
    activeKokoroModelOnDisk.value,
    isCancellingKokoroDownload.value,
  )
})

const kokoroProgressCanCancel = computed(() => {
  if (activeSpeechProvider.value !== 'kokoro-local' || isCancellingKokoroDownload.value)
    return false

  const status = resolveKokoroInferenceStatus(activeSpeechModel.value)
  if (status?.state === 'downloading')
    return true

  return isLoadingSpeechProviderVoices.value && !activeKokoroModelOnDisk.value
})

const kokoroProgressDownloadFileHint = computed(() => kokoroProgressDownloadFile(
  kokoroDownloadProgress.value,
  activeSpeechModel.value,
  resolveKokoroInferenceStatus(activeSpeechModel.value),
))

const kokoroDownloadSpeedBps = ref(0)
let kokoroDownloadSpeedSample: { loaded: number, recordedAt: number } | null = null

watch(activeSpeechModel, () => {
  kokoroDownloadSpeedBps.value = 0
  kokoroDownloadSpeedSample = null
})

watch(kokoroDownloadProgress, (current) => {
  if (!current?.loaded || current.loaded <= 0 || !current.recordedAt) {
    if (!current) {
      kokoroDownloadSpeedBps.value = 0
      kokoroDownloadSpeedSample = null
    }
    return
  }

  if (current.speechModelId !== activeSpeechModel.value) {
    kokoroDownloadSpeedBps.value = 0
    kokoroDownloadSpeedSample = null
    return
  }

  kokoroDownloadSpeedBps.value = smoothDownloadSpeed(
    kokoroDownloadSpeedSample,
    { loaded: current.loaded, recordedAt: current.recordedAt },
    kokoroDownloadSpeedBps.value,
  )
  kokoroDownloadSpeedSample = { loaded: current.loaded, recordedAt: current.recordedAt }
})

const kokoroProgressDetailHint = computed(() => {
  const parts: string[] = []
  const fileHint = kokoroProgressDownloadFileHint.value
  if (fileHint)
    parts.push(fileHint)

  const synced = kokoroDownloadProgress.value
  if (
    synced?.speechModelId === activeSpeechModel.value
    && synced.loaded != null
    && synced.total != null
    && synced.total > 0
  ) {
    const loadedMb = (synced.loaded / (1024 * 1024)).toFixed(1)
    const totalMb = (synced.total / (1024 * 1024)).toFixed(1)
    parts.push(`${loadedMb} / ${totalMb} MB`)
  }

  return parts.length > 0 ? parts.join('\n') : undefined
})

const kokoroProgressLineText = computed(() => {
  const base = kokoroProgressText.value
  if (!base)
    return ''

  const status = resolveKokoroInferenceStatus(activeSpeechModel.value)
  const hasByteProgress = kokoroActiveDownloadHasByteProgress(
    kokoroDownloadProgress.value,
    activeSpeechModel.value,
    status,
  )
  const speed = formatDownloadSpeed(kokoroDownloadSpeedBps.value)
  if (speed && kokoroProgressIsDownloadPhase.value && hasByteProgress)
    return `${base} · ${speed}`

  return base
})

const STREAMING_MODEL_OPTION_PREFIX = 'streaming:'

const configuredSpeechSources = computed(() => {
  return moduleSpeechProvidersMetadata.value
    .filter(metadata =>
      metadata.id !== 'speech-noop'
      && metadata.id !== OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
      && metadata.id !== VIRTUAL_AUDIO_STUDIO_PROVIDER_ID,
    )
    .map(metadata => ({
      id: metadata.id,
      providerId: metadata.id,
      title: metadata.localizedName || 'Unknown',
      description: metadata.localizedDescription,
    }))
})

const sortedConfiguredSpeechSources = computed(() => {
  const metadataById = new Map(moduleSpeechProvidersMetadata.value.map(metadata => [metadata.id, metadata]))
  return [...configuredSpeechSources.value].sort((left, right) => {
    const leftMetadata = metadataById.get(left.id)
    const rightMetadata = metadataById.get(right.id)
    if (!leftMetadata || !rightMetadata)
      return 0
    return compareProviderCatalogOrder(leftMetadata, rightMetadata)
  })
})

const speechNoopSource = computed(() => {
  return allAudioSpeechProvidersMetadata.value
    .filter(metadata => metadata.id === 'speech-noop')
    .map(metadata => ({
      id: metadata.id,
      providerId: metadata.id,
      title: metadata.localizedName || 'Unknown',
    }))[0] ?? null
})

/**
 * None is an empty-state placeholder: no speech engine yet.
 * After the user has a real engine, it must not sit next to those engines.
 */
const showSpeechNoopCard = computed(() => {
  return speechNoopSource.value != null && configuredSpeechSources.value.length === 0
})

/** Speech provider tabs browse catalogs. Chat uses `activeSpeechProvider` until a model or voice is picked. */
function speechSourceFromProvider(provider: string) {
  if (provider === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
    return OFFICIAL_SPEECH_PROVIDER_ID
  return provider
}

const browsingSpeechSource = ref(speechSourceFromProvider(activeSpeechProvider.value))

watch(activeSpeechProvider, (provider) => {
  if (provider)
    browsingSpeechSource.value = speechSourceFromProvider(provider)
})

const displayedSpeechSource = computed({
  get: () => browsingSpeechSource.value,
  set: (value: string) => {
    browsingSpeechSource.value = value
  },
})

const isBrowsingActiveChatProvider = computed(() =>
  browsingSpeechSource.value === speechSourceFromProvider(activeSpeechProvider.value),
)

function resolvedBrowsingSpeechProviderId(): string {
  const source = browsingSpeechSource.value
  if (
    source === OFFICIAL_SPEECH_PROVIDER_ID
    && isBrowsingActiveChatProvider.value
    && activeSpeechProvider.value === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
  ) {
    return OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
  }
  return source
}

const resolvedBrowsingSpeechProvider = computed(() => resolvedBrowsingSpeechProviderId())

const isOfficialSpeechSourceSelected = computed(() => displayedSpeechSource.value === OFFICIAL_SPEECH_PROVIDER_ID)

/** Browsing model for the active tab. Runtime updates only after a voice commit. */
const browsingSpeechModelId = ref('')
const browsingSpeechVoiceId = ref('')
const browsingManualModelDraft = ref('')

function streamingModelOptionId(modelId: string) {
  return `${STREAMING_MODEL_OPTION_PREFIX}${modelId}`
}

function modelIdFromStreamingOptionId(optionId: string) {
  return optionId.startsWith(STREAMING_MODEL_OPTION_PREFIX)
    ? optionId.slice(STREAMING_MODEL_OPTION_PREFIX.length)
    : null
}

function resolveLastModelForBrowsingTab(): string {
  const providerId = resolvedBrowsingSpeechProviderId()
  const remembered = speechStore.lastModelForSpeechProvider(providerId)?.trim()
  if (remembered)
    return remembered
  if (isOfficialSpeechSourceSelected.value) {
    const streamingRemembered = speechStore.lastModelForSpeechProvider(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)?.trim()
    if (streamingRemembered)
      return streamingRemembered
  }
  if (isBrowsingActiveChatProvider.value)
    return activeSpeechModel.value?.trim() ?? ''
  return ''
}

function resolveBrowsingSpeechVoiceId() {
  if (isBrowsingActiveChatProvider.value)
    return activeSpeechVoiceId.value?.trim() ?? ''
  return ''
}

function syncBrowsingSpeechTab() {
  browsingSpeechModelId.value = resolveLastModelForBrowsingTab()
  // Consciousness keeps the committed model selected on the active tab.
  // Speech keeps the committed voice selected the same way.
  browsingSpeechVoiceId.value = resolveBrowsingSpeechVoiceId()
  browsingManualModelDraft.value = browsingSpeechModelId.value
}

watch([activeSpeechModel, activeSpeechVoiceId], () => {
  if (!isBrowsingActiveChatProvider.value)
    return
  browsingSpeechModelId.value = activeSpeechModel.value?.trim() ?? ''
  browsingSpeechVoiceId.value = activeSpeechVoiceId.value?.trim() ?? ''
  browsingManualModelDraft.value = browsingSpeechModelId.value
})

function rememberProviderForBrowsingModel(modelId: string, streamingModelId: string | null) {
  const rememberKey = streamingModelId == null
    ? resolvedBrowsingSpeechProviderId()
    : OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
  speechStore.rememberModelForSpeechProvider(rememberKey, modelId)
}

function catalogModelOptionId(modelId: string): string {
  if (!modelId)
    return ''
  if (resolvedBrowsingSpeechProviderId() === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
    return streamingModelOptionId(modelId)
  if (isOfficialSpeechSourceSelected.value) {
    const streamingModels = providersStore.getModelsForProvider(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
    if (streamingModels.some(entry => entry.id === modelId))
      return streamingModelOptionId(modelId)
  }
  return modelId
}

const catalogRadioSelection = computed(() => catalogModelOptionId(browsingSpeechModelId.value))

const browsingSupportsModelListing = computed(() =>
  providersStore.supportsModelListing(resolvedBrowsingSpeechProviderId())
  || (isOfficialSpeechSourceSelected.value && providersStore.supportsModelListing(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)),
)

const browsingSpeechProviderSettingsPath = computed(() => {
  const source = browsingSpeechSource.value
  if (!source || source === 'speech-noop')
    return '/settings/providers#speech'
  return `/settings/providers/speech/${source}`
})

/** Last voice saved for the provider tab you browse now. */
const lastVoiceOnBrowsingSpeechProvider = computed(() => {
  const providerId = resolvedBrowsingSpeechProviderId()
  const remembered = speechStore.lastVoiceForSpeechProvider(providerId)?.trim()
  if (remembered)
    return remembered
  if (isBrowsingActiveChatProvider.value)
    return activeSpeechVoiceId.value?.trim() ?? ''
  return ''
})

const showBrowsingLastVoiceBanner = computed(() =>
  Boolean(lastVoiceOnBrowsingSpeechProvider.value?.trim()),
)

const playgroundTestModelId = computed(() => {
  const browsingVoiceId = browsingSpeechVoiceId.value?.trim()
  if (browsingVoiceId) {
    const browsingModel = browsingSpeechModelId.value.trim()
    return modelIdFromStreamingOptionId(browsingModel) ?? browsingModel
  }
  return activeSpeechModel.value?.trim() ?? ''
})

const playgroundTestVoiceName = computed(() => {
  const browsingVoiceId = browsingSpeechVoiceId.value?.trim()
  if (browsingVoiceId) {
    const catalogVoice = (availableVoices.value[resolvedBrowsingSpeechProviderId()] ?? [])
      .find(voice => voice.id === browsingVoiceId)
    const named = catalogVoice?.name?.trim()
    return named || browsingVoiceId
  }
  const named = activeSpeechVoice.value?.name?.trim()
  if (named)
    return named
  return activeSpeechVoiceId.value?.trim() ?? ''
})

const playgroundTestTargetMismatchesBrowse = computed(() => {
  const testingModel = playgroundTestModelId.value
  if (!testingModel)
    return false
  const browsingModel = (
    modelIdFromStreamingOptionId(browsingSpeechModelId.value.trim())
    ?? browsingSpeechModelId.value.trim()
  )
  if (!browsingModel)
    return false
  return browsingModel !== testingModel
})

function beginSpeechPlaygroundTest() {
  speechPlaygroundTestGeneration += 1
  errorMessage.value = ''
  isGenerating.value = true
  return speechPlaygroundTestGeneration
}

function discardSpeechPlaygroundTest() {
  speechPlaygroundTestGeneration += 1
  errorMessage.value = ''
  isGenerating.value = false
}

function isSpeechPlaygroundTestCurrent(generation: number) {
  return generation === speechPlaygroundTestGeneration
}

function fallbackSpeechVoice(voiceId: string, provider: string): VoiceInfo {
  return {
    id: voiceId,
    name: voiceId,
    description: voiceId,
    previewURL: '',
    languages: [{ code: 'en', title: 'English' }],
    provider,
    gender: 'neutral',
  }
}

/** Resolves the provider, model, and voice on the current Speech tab. */
function resolveBrowsingSpeechCommitTarget(voiceId: string | undefined) {
  const trimmedVoiceId = voiceId?.trim()
  if (!trimmedVoiceId)
    return null

  const browseProvider = resolvedBrowsingSpeechProviderId()
  const model = (
    browsingSpeechModelId.value
    || speechStore.lastModelForSpeechProvider(browseProvider)
    || ''
  ).trim()

  const catalogVoice = (availableVoices.value[browseProvider] ?? []).find(voice => voice.id === trimmedVoiceId)
  let provider = catalogVoice?.provider && catalogVoice.provider !== 'speech-noop'
    ? catalogVoice.provider
    : browseProvider
  if (model) {
    const streamingModels = providersStore.getModelsForProvider(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
    if (streamingModels.some(entry => entry.id === model))
      provider = OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
    else if (provider === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
      provider = OFFICIAL_SPEECH_PROVIDER_ID
  }

  return {
    provider,
    model,
    voice: catalogVoice ?? fallbackSpeechVoice(trimmedVoiceId, provider),
  }
}

async function selectLastVoiceOnBrowsingSpeechProvider() {
  const voiceId = lastVoiceOnBrowsingSpeechProvider.value?.trim()
  if (!voiceId)
    return
  await selectSpeechVoice(voiceId)
}

async function applyBrowsingSpeechModel(modelOptionId: string) {
  const streamingModelId = modelIdFromStreamingOptionId(modelOptionId.trim())
  const resolvedModel = (streamingModelId ?? modelOptionId).trim()
  if (!resolvedModel)
    return

  discardSpeechPlaygroundTest()
  browsingSpeechModelId.value = resolvedModel
  browsingManualModelDraft.value = resolvedModel
  browsingSpeechVoiceId.value = ''
  rememberProviderForBrowsingModel(resolvedModel, streamingModelId)

  const voiceProviderId = streamingModelId == null
    ? resolvedBrowsingSpeechProviderId()
    : OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
  await speechStore.loadVoicesForProvider(voiceProviderId, resolvedModel)
}

async function commitBrowsingManualModel() {
  await applyBrowsingSpeechModel(browsingManualModelDraft.value)
}

const browsingProviderModels = computed(() =>
  providersStore.getModelsForProvider(resolvedBrowsingSpeechProviderId()),
)

const displayedProviderModels = computed(() => {
  if (!isOfficialSpeechSourceSelected.value)
    return browsingProviderModels.value

  const regularModels = providersStore.getModelsForProvider(OFFICIAL_SPEECH_PROVIDER_ID)
  const streamingModels = providersStore.getModelsForProvider(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
  return [
    ...regularModels,
    ...streamingModels.map(model => ({
      ...model,
      id: streamingModelOptionId(model.id),
      name: model.name,
      description: model.description || 'Low-latency streaming TTS',
    })),
  ]
})

const isKokoroSpeechProvider = computed(() => resolvedBrowsingSpeechProviderId() === 'kokoro-local')

function localizeModelDescription(description: string | undefined) {
  if (!description)
    return description
  if (description.startsWith('settings.'))
    return t(description)
  return description
}

const speechModelSelectItems = computed(() => {
  const models = displayedProviderModels.value
  if (isKokoroSpeechProvider.value) {
    const downloadedLabel = t('settings.pages.modules.speech.model_catalog.downloaded_chip')
    return kokoroCatalogSelectItems(models, kokoroSortKey.value, kokoroSortDirection.value).map((item) => {
      const downloaded = kokoroQuantDownloaded.value[item.id] === true
      return {
        ...item,
        description: localizeModelDescription(item.description),
        ...(downloaded
          ? { statusChip: { label: downloadedLabel, active: true } }
          : {}),
      }
    })
  }

  return models.map(model => ({
    id: model.id,
    name: model.name,
    description: model.description,
    deprecated: model.deprecated,
  }))
})

async function refreshKokoroDownloadState() {
  if (!isKokoroSpeechProvider.value) {
    kokoroQuantDownloaded.value = {}
    return
  }

  const entries = await Promise.all(
    KOKORO_MODELS.map(async (model) => {
      const downloaded = await isKokoroSpeechModelDownloaded(model.id)
      return [model.id, downloaded] as const
    }),
  )
  kokoroQuantDownloaded.value = Object.fromEntries(entries)
}

async function clearKokoroDownloads() {
  if (clearingKokoroDownloads.value)
    return

  clearingKokoroDownloads.value = true
  try {
    await clearModelCache()
    for (const entry of inferenceModels.value) {
      if (entry.modelId.startsWith('kokoro-'))
        removeInferenceStatus(entry.modelId)
    }
    try {
      const adapter = await getKokoroAdapter()
      adapter.terminate()
    }
    catch {
      // Adapter may not exist yet.
    }
    await refreshKokoroDownloadState()
    if (activeSpeechProvider.value === 'kokoro-local') {
      await speechStore.loadVoicesForProvider(
        activeSpeechProvider.value,
        activeSpeechModel.value || undefined,
      )
    }
  }
  finally {
    clearingKokoroDownloads.value = false
  }
}

async function cancelKokoroDownload() {
  if (!kokoroProgressCanCancel.value || isCancellingKokoroDownload.value)
    return

  isCancellingKokoroDownload.value = true
  try {
    await speechStore.cancelKokoroDownload()
  }
  finally {
    isCancellingKokoroDownload.value = false
  }
}

watch(
  () => [kokoroProgressText.value, activeSpeechModel.value] as const,
  ([progressText]) => {
    if (activeSpeechProvider.value !== 'kokoro-local')
      return
    if (!progressText)
      void refreshKokoroDownloadState()
  },
)

watch(isLoadingSpeechProviderVoices, (loading, wasLoading) => {
  if (wasLoading && !loading && activeSpeechProvider.value === 'kokoro-local')
    void refreshKokoroDownloadState()
})

const displayedModelsLoading = computed(() => {
  if (!isOfficialSpeechSourceSelected.value)
    return providersStore.isLoadingModels[resolvedBrowsingSpeechProviderId()] || false
  return providersStore.isLoadingModels[OFFICIAL_SPEECH_PROVIDER_ID]
    || providersStore.isLoadingModels[OFFICIAL_SPEECH_STREAMING_PROVIDER_ID]
    || false
})

const displayedModelError = computed(() => {
  if (!isOfficialSpeechSourceSelected.value)
    return providersStore.modelLoadError[resolvedBrowsingSpeechProviderId()] || null
  return providersStore.modelLoadError[OFFICIAL_SPEECH_PROVIDER_ID]
    || providersStore.modelLoadError[OFFICIAL_SPEECH_STREAMING_PROVIDER_ID]
    || null
})

const isSpeechModelCatalogEmpty = computed(() =>
  !displayedModelsLoading.value
  && !displayedModelError.value
  && displayedProviderModels.value.length === 0,
)

const speechModelCatalogHasCommittedSelection = computed(() =>
  Boolean(browsingSpeechModelId.value?.trim()),
)

const isLoadingBrowsingSpeechVoices = computed(() =>
  speechStore.voiceCatalogStatus[resolvedBrowsingSpeechProviderId()]?.loading ?? false,
)

const displayedVoiceOptions = computed(() => {
  const providerId = resolvedBrowsingSpeechProviderId()
  const model = browsingSpeechModelId.value
  return (availableVoices.value[providerId] ?? [])
    .filter((voice) => {
      if (!model)
        return true
      return !voice.compatibleModels || voice.compatibleModels.includes(model)
    })
    .map(voice => ({
      id: voice.id,
      name: voice.name,
      description: voice.description,
      previewURL: voice.previewURL,
      customizable: false,
    }))
})

const displayedSpeechVoiceId = computed({
  get: () => browsingSpeechVoiceId.value,
  set: (value: string) => {
    void selectSpeechVoice(value).catch((error) => {
      errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
    })
  },
})

/**
 * Resolves the current TTS model id for low-cardinality analytics payloads.
 */
function currentTtsModelId() {
  return activeSpeechModel.value || 'unknown'
}

/**
 * Checks whether the selected provider is one of AIRI's official TTS providers.
 */
function isOfficialTtsProvider(providerId: string) {
  return providerId === OFFICIAL_SPEECH_PROVIDER_ID || providerId === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
}

/**
 * Classifies the selected voice without sending free-form provider config as a dimension.
 */
function currentVoiceType(voiceId: string, providerId = activeSpeechProvider.value): VoiceType {
  const catalogVoice = availableVoices.value[providerId]?.some(voice => voice.id === voiceId)
  if (catalogVoice)
    return providerId === OFFICIAL_SPEECH_PROVIDER_ID || providerId === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID ? 'official_selected' : 'custom_configured'

  return 'custom_configured'
}

/**
 * Builds bounded voice analytics fields for catalog, voice pack, and manual voices.
 */
function voiceAnalyticsPayload(
  voiceId: string,
  providerId = activeSpeechProvider.value,
): {
  voice_id: string
  voice_type: VoiceType
} {
  const voiceType = currentVoiceType(voiceId, providerId)
  const isCatalogVoice = availableVoices.value[providerId]?.some(voice => voice.id === voiceId) ?? false
  const shouldBucketVoiceId = voiceType === 'custom_configured' && !isCatalogVoice

  return {
    voice_id: shouldBucketVoiceId ? 'custom' : voiceId,
    voice_type: voiceType,
  }
}

/**
 * Adds server-side TTS analytics metadata to official preview requests.
 */
function withManualPreviewAnalytics<TProviderConfig extends Record<string, unknown> | undefined>(
  providerConfig: TProviderConfig,
  providerId: string,
  voiceType: VoiceType,
): TProviderConfig | Record<string, unknown> {
  if (providerId !== OFFICIAL_SPEECH_PROVIDER_ID && providerId !== OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)
    return providerConfig

  const baseConfig: Record<string, unknown> = providerConfig ?? {}
  return {
    ...baseConfig,
    extraBody: {
      ...(baseConfig.extraBody as Record<string, unknown> | undefined),
      airi_analytics: {
        trigger: 'manual',
        source: 'manual_preview',
        voice_type: voiceType,
      },
    },
  }
}

/**
 * Tracks explicit voice selection from catalog or custom input controls.
 */
async function selectSpeechVoice(voiceId: string | undefined) {
  discardSpeechPlaygroundTest()
  if (!voiceId) {
    await persistSelection()
    return
  }

  const target = resolveBrowsingSpeechCommitTarget(voiceId)
  if (!target) {
    await persistSelection()
    return
  }

  browsingSpeechVoiceId.value = voiceId

  await speechStore.commitSpeechSelection(target.provider, target.model, voiceId)
  await persistSelection()

  trackVoiceSelected({
    tts_provider_id: target.provider || 'unknown',
    tts_model_id: target.model || currentTtsModelId(),
    ...voiceAnalyticsPayload(voiceId, target.provider),
    source: 'settings',
  })
}

/** Updates the browse tab model. Runtime TTS commits when a voice is picked. */
async function selectSpeechModel(modelOptionId: string) {
  await applyBrowsingSpeechModel(modelOptionId)
}

/**
 * Tracks that the settings page has shown an official TTS route to the user.
 */
function trackOfficialTtsExposure(providerId = activeSpeechProvider.value, modelId = currentTtsModelId()) {
  if (!providerId || !isOfficialTtsProvider(providerId))
    return

  const exposureKey = `${providerId}:${modelId}`
  if (lastOfficialTtsExposureKey === exposureKey)
    return

  lastOfficialTtsExposureKey = exposureKey
  trackOfficialTtsExposed({
    tts_provider_id: providerId,
    tts_model_id: modelId,
    source: 'settings',
  })
}

/** Applies provider defaults in the leader without a follower state proposal. */
async function syncOpenAICompatibleSettings() {
  if (activeSpeechProvider.value !== 'openai-compatible-audio-speech')
    return

  const providerConfig = providerStore.getProviderConfig(activeSpeechProvider.value)
  // Empty provider fields select the same OpenAI defaults as the provider form.
  await speechStore.selectProviderModel(
    activeSpeechProvider.value,
    providerConfig?.model as string || 'tts-1',
    providerConfig?.voice as string || 'alloy',
  )
}

onMounted(async () => {
  try {
    if (activeSpeechProvider.value === VIRTUAL_AUDIO_STUDIO_PROVIDER_ID)
      await speechStore.selectProviderModel('speech-noop', '')
    await providersStore.loadModelsForConfiguredProviders()
    speechStore.ensureActiveSpeechModel()

    const browse = route.query.browse
    if (typeof browse === 'string' && browse.length > 0) {
      const browseSource = browse === OFFICIAL_SPEECH_STREAMING_PROVIDER_ID
        ? OFFICIAL_SPEECH_PROVIDER_ID
        : browse
      if (providersStore.findProviderDefinition(browseSource))
        browsingSpeechSource.value = browseSource
    }

    syncBrowsingSpeechTab()
    await speechStore.loadVoicesForProvider(activeSpeechProvider.value, activeSpeechModel.value || undefined)
    await syncOpenAICompatibleSettings()
    trackOfficialTtsExposure()
    await refreshKokoroDownloadState()
  }
  catch (error) {
    // Closing a renderer rejects pending RPCs even after its page unmounts.
    errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
  }
})

watch(browsingSpeechSource, async (sourceId) => {
  if (!sourceId || sourceId === 'speech-noop')
    return

  discardSpeechPlaygroundTest()
  syncBrowsingSpeechTab()

  const providerId = resolvedBrowsingSpeechProviderId()
  try {
    if (providersStore.supportsModelListing(providerId))
      await providersStore.fetchModelsForProvider(providerId)
    if (sourceId === OFFICIAL_SPEECH_PROVIDER_ID && providersStore.supportsModelListing(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID))
      await providersStore.fetchModelsForProvider(OFFICIAL_SPEECH_STREAMING_PROVIDER_ID)

    await speechStore.loadVoicesForProvider(providerId, browsingSpeechModelId.value || undefined)
  }
  catch (error) {
    if (browsingSpeechSource.value === sourceId)
      errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
  }
}, { immediate: true })

watch(activeSpeechProvider, async (newProvider) => {
  if (newProvider === 'kokoro-local')
    await refreshKokoroDownloadState()
  else
    kokoroQuantDownloaded.value = {}
  try {
    await providersStore.loadModelsForConfiguredProviders()
    if (newProvider !== activeSpeechProvider.value)
      return

    speechStore.ensureActiveSpeechModel()
    // Model discovery can finish after the selection commit. The leader loader
    // resolves defaults from that catalog before it requests matching voices.
    await speechStore.loadVoicesForProvider(newProvider, activeSpeechModel.value || undefined)
    if (newProvider !== activeSpeechProvider.value)
      return
    trackOfficialTtsExposure(newProvider, currentTtsModelId())

    await syncOpenAICompatibleSettings()
  }
  catch (error) {
    // An obsolete provider request must not replace the current form error.
    if (newProvider === activeSpeechProvider.value)
      errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
  }
})

watch(activeSpeechModel, () => {
  if (!activeSpeechProvider.value)
    return

  trackOfficialTtsExposure(activeSpeechProvider.value, currentTtsModelId())
})

watch(displayedProviderModels, async (models, previous) => {
  if (!activeSpeechProvider.value || models.length === 0)
    return
  if (previous?.length)
    return

  try {
    speechStore.ensureActiveSpeechModel()
    await speechStore.loadVoicesForProvider(activeSpeechProvider.value, activeSpeechModel.value || undefined)
  }
  catch (error) {
    errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
  }
})

async function persistSelection() {
  await airiCardStore.updateActiveCardSpeech({
    provider: activeSpeechProvider.value,
    model: activeSpeechModel.value,
    voice_id: activeSpeechVoiceId.value,
  })
}

// Function to generate speech
async function generateTestSpeech() {
  if (!testText.value.trim() && !useSSML.value)
    return

  if (useSSML.value && !ssmlText.value.trim())
    return

  const target = resolveBrowsingSpeechCommitTarget(browsingSpeechVoiceId.value)
  const providerConfig = target
    ? providerStore.getProviderConfig(target.provider)
    : undefined

  let model = target?.model ?? ''
  let voice = target?.voice
  const previewProvider = target?.provider || ''

  if (previewProvider === 'openai-compatible-audio-speech') {
    if (!model && providerConfig?.model)
      model = providerConfig.model as string
    if (!voice && providerConfig?.voice)
      voice = fallbackSpeechVoice(providerConfig.voice as string, previewProvider)
  }

  if (!model && providerConfig?.model)
    model = providerConfig.model as string

  if (!browsingSpeechVoiceId.value?.trim() || !previewProvider || !model || !voice) {
    errorMessage.value = t('settings.pages.modules.speech.sections.section.playground.select-voice.required')
    return
  }

  const previewVoice = voice
  const previewModel = model
  const previewAnalytics = voiceAnalyticsPayload(previewVoice.id, previewProvider)
  const previewStartedAt = performance.now()
  const generation = beginSpeechPlaygroundTest()

  try {
    const provider = await providersStore.getProviderInstance(previewProvider) as SpeechProviderWithExtraOptions<string, any>
    if (!isSpeechPlaygroundTestCurrent(generation))
      return
    if (!provider) {
      console.error('Failed to initialize speech provider')
      return
    }

    // Stop any currently playing audio
    if (audioUrl.value) {
      stopTestAudio()
    }

    speechStore.beginPlaybackAudioConsole()

    const speechRequest = useSSML.value
      ? {
          input: ssmlText.value,
          providerConfig,
        }
      : speechStore.resolveSpeechInput({
          text: speechStore.transformTextForSpeech(testText.value),
          voice,
          providerConfig,
          forceSSML: ssmlEnabled.value,
          supportsSSML: speechStore.supportsSSML,
        })

    if (isOfficialTtsProvider(previewProvider)) {
      trackOfficialTtsPreviewStarted({
        tts_provider_id: previewProvider,
        tts_model_id: previewModel,
        ...previewAnalytics,
        source: 'manual_preview',
      })
    }

    await speechStore.commitSpeechSelection(previewProvider, previewModel, previewVoice.id)
    if (!isSpeechPlaygroundTestCurrent(generation))
      return
    await persistSelection()
    if (!isSpeechPlaygroundTestCurrent(generation))
      return

    const response = await generateSpeech({
      ...provider.speech(
        previewModel,
        withManualPreviewAnalytics(speechRequest.providerConfig, previewProvider, previewAnalytics.voice_type),
      ),
      input: speechRequest.input,
      voice: previewVoice.id,
    })

    if (!isSpeechPlaygroundTestCurrent(generation))
      return

    audioUrl.value = URL.createObjectURL(new Blob([response]))
    const context = audioContextStore.audioContext
    if (context.state === 'suspended')
      await context.resume()
    if (!isSpeechPlaygroundTestCurrent(generation))
      return
    const decoded = await context.decodeAudioData(response.slice(0))
    if (!isSpeechPlaygroundTestCurrent(generation))
      return
    const source = context.createBufferSource()
    source.buffer = decoded
    consolePreviewSource = source
    const effectsResult = applyVoiceProfileEffects(context, source, speechStore.audioConsole.effects)
    consolePreviewCleanup = effectsResult.cleanup
    effectsResult.lastNode.connect(context.destination)
    source.onended = () => stopTestAudio(false)
    source.start(0)
    if (isOfficialTtsProvider(previewProvider)) {
      trackOfficialTtsPreviewSucceeded({
        tts_provider_id: previewProvider,
        tts_model_id: previewModel,
        ...previewAnalytics,
        source: 'manual_preview',
        duration_ms: Math.round(performance.now() - previewStartedAt),
      })
    }

    trackVoicePreviewPlayed({
      tts_provider_id: previewProvider,
      tts_model_id: previewModel,
      ...previewAnalytics,
      source: 'manual_preview',
    })
  }
  catch (error) {
    if (!isSpeechPlaygroundTestCurrent(generation))
      return
    console.error('Error generating speech:', error)
    errorMessage.value = formatChatProviderErrorContent(
      error,
      t,
      errorMessageFrom(error) || 'An unknown error occurred',
      {
        providerId: previewProvider,
        modelId: previewModel,
      },
    )
  }
  finally {
    if (isSpeechPlaygroundTestCurrent(generation))
      isGenerating.value = false
  }
}

// Function to stop audio playback
function stopTestAudio(clearUrl = true) {
  if (consolePreviewSource) {
    try {
      consolePreviewSource.stop()
    }
    catch {}
    consolePreviewSource = null
  }
  if (consolePreviewCleanup) {
    consolePreviewCleanup()
    consolePreviewCleanup = undefined
  }
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
  }
  if (clearUrl && audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

// Clean up when component is unmounted
onUnmounted(() => {
  discardSpeechPlaygroundTest()
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})

function updateCustomVoiceName(value: string | undefined) {
  activeSpeechVoiceId.value = value || ''
  if (!value) {
    activeSpeechVoice.value = undefined
    return
  }

  activeSpeechVoice.value = {
    id: value,
    name: value,
    description: value,
    previewURL: value,
    languages: [{ code: 'en', title: 'English' }],
    provider: activeSpeechProvider.value,
    gender: 'male',
  }
}

/**
 * Tracks a manual voice after the input value is committed by the user.
 */
function commitCustomVoiceSelection() {
  void selectSpeechVoice(browsingSpeechVoiceId.value || undefined)
}

/** Routes manual model edits through the same leader commit as listed models. */
async function updateCustomModelName(value: string | undefined) {
  errorMessage.value = ''
  try {
    await applyBrowsingSpeechModel(value || '')
  }
  catch (error) {
    errorMessage.value = errorMessageFrom(error) ?? 'An unknown error occurred'
  }
}

async function handleDeleteProvider(providerId: string) {
  if (providerId === 'speech-noop') {
    return
  }

  await airiCardStore.clearProviderSelections(providerId)
  await providersStore.deleteProvider(providerId)
}
</script>

<template>
  <ErrorContainer v-if="errorMessage" :error="errorMessage" />
  <SettingsSplitPane storage-key="settings/speech/split-left-percent">
    <template #left>
      <SettingsCard :class="['w-full']">
        <div flex="~ col gap-4">
          <div>
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
                {{ t('settings.pages.providers.title') }}
              </h2>
              <RouterLink
                :to="browsingSpeechProviderSettingsPath"
                :class="[
                  'inline-flex shrink-0 items-center gap-2',
                  'rounded-lg px-4 py-2.5',
                  'text-sm font-semibold text-white',
                  'bg-amber-500 transition hover:bg-amber-600',
                ]"
              >
                <div class="i-solar:settings-line-duotone text-lg" />
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.open_provider_settings') }}
              </RouterLink>
            </div>
            <div text="neutral-400 dark:neutral-400">
              <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.description') }}</span>
            </div>
          </div>
          <div max-w-full>
            <fieldset
              v-if="configuredSpeechSources.length > 0 || showSpeechNoopCard"
              flex="~ row gap-2"
              class="pb-2"
              min-w-0 overflow-x-auto scroll-smooth role="radiogroup"
            >
              <RadioCardSimple
                v-for="source in sortedConfiguredSpeechSources"
                :id="source.id"
                :key="source.id"
                v-model="displayedSpeechSource"
                dense
                name="speech-provider"
                :value="source.id"
                :title="source.title"
                :description="source.description"
                :more-info-label="t('settings.pages.modules.speech.model_catalog.description_show')"
                @click="trackProviderClick(source.providerId || source.id, 'speech')"
              >
                <template #topRight>
                  <button
                    v-if="source.providerId && source.providerId !== 'speech-noop' && !source.providerId.startsWith('official-provider')"
                    type="button"
                    class="rounded bg-neutral-100 p-1 text-neutral-600 transition-colors dark:bg-neutral-800/60 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700/60"
                    @click.stop.prevent="handleDeleteProvider(source.providerId)"
                  >
                    <div i-solar:trash-bin-trash-bold-duotone class="text-base" />
                  </button>
                </template>
                <template v-if="configuredProviders[source.providerId] === false" #bottomRight>
                  <div class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-300">
                    {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.health_check_failed') }}
                  </div>
                </template>
              </RadioCardSimple>
              <RouterLink
                to="/settings/providers#speech"
                border="2px solid"
                :class="[
                  'h-12 w-max max-w-[17rem] min-w-44 shrink-0 p-1.5',
                  'border-neutral-100 bg-white dark:border-neutral-900',
                  'hover:border-primary-500/30 dark:bg-neutral-900/20 dark:hover:border-primary-400/30',
                  'relative flex flex-col items-center justify-center rounded-xl',
                  'transition-all duration-200 ease-in-out',
                ]"
              >
                <div i-solar:add-circle-line-duotone class="text-2xl text-neutral-500 dark:text-neutral-500" />
                <div
                  class="bg-dotted-neutral-200/80 dark:bg-dotted-neutral-700/50"
                  absolute inset-0 z--1
                  style="background-size: 10px 10px; mask-image: linear-gradient(165deg, white 30%, transparent 50%);"
                />
              </RouterLink>
              <RadioCardSimple
                v-if="showSpeechNoopCard && speechNoopSource"
                :id="speechNoopSource.id"
                :key="speechNoopSource.id"
                v-model="displayedSpeechSource"
                dense
                name="speech-provider"
                :value="speechNoopSource.id"
                :title="speechNoopSource.title"
                @click="trackProviderClick(speechNoopSource.providerId || speechNoopSource.id, 'speech')"
              />
            </fieldset>
            <div v-else>
              <RouterLink
                class="flex items-center gap-3 rounded-lg p-4" border="2 dashed neutral-200 dark:neutral-800"
                bg="neutral-50 dark:neutral-800" transition="colors duration-200 ease-in-out" to="/settings/providers"
              >
                <div i-solar:warning-circle-line-duotone class="text-2xl text-amber-500 dark:text-amber-400" />
                <div class="flex flex-col">
                  <span class="font-medium">{{ t('settings.pages.modules.speech.sections.section.provider-tabs.no_providers_configured_title') }}</span>
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{ t('settings.pages.modules.speech.sections.section.provider-tabs.no_providers_configured_description') }}</span>
                </div>
                <div i-solar:arrow-right-line-duotone class="ml-auto text-xl text-neutral-400 dark:text-neutral-500" />
              </RouterLink>
            </div>
          </div>
        </div>

        <!-- Model selection section -->
        <div
          v-if="browsingSpeechSource && browsingSpeechSource !== 'speech-noop'"
          :class="['flex flex-col gap-2']"
        >
          <h2 class="text-lg md:text-2xl">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
          </h2>

          <!-- Manual input for OpenAI Compatible -->
          <div v-if="resolvedBrowsingSpeechProvider === 'openai-compatible-audio-speech'">
            <label class="mb-1 block text-sm font-medium">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
            </label>
            <p class="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
              Enter the TTS model to use for speech generation
            </p>
            <input
              v-model="browsingManualModelDraft"
              type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="tts-1"
              @change="commitBrowsingManualModel"
            >
          </div>

          <!-- Model listing for other providers -->
          <div v-else-if="browsingSupportsModelListing" :class="['flex flex-col gap-2']">
            <!-- Loading state -->
            <div v-if="displayedModelsLoading" class="flex items-center justify-center py-4">
              <div class="mr-2 animate-spin">
                <div i-solar:spinner-line-duotone text-xl />
              </div>
              <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.loading') }}</span>
            </div>

            <!-- Error state -->
            <template v-else-if="displayedModelError">
              <ErrorContainer
                :title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.error')"
                :error="displayedModelError"
              />

              <label class="mb-1 block text-sm font-medium">
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
              </label>
              <input
                v-model="browsingManualModelDraft"
                type="text"
                class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
                @change="commitBrowsingManualModel"
              >
            </template>

            <template v-else>
              <div
                v-if="isSpeechModelCatalogEmpty && !speechModelCatalogHasCommittedSelection"
                class="flex items-center justify-between gap-4 rounded-xl bg-amber-50/50 p-2 dark:bg-amber-900/20"
              >
                <div class="min-w-0 flex flex-1 items-start gap-2">
                  <div
                    class="i-solar:danger-circle-bold-duotone shrink-0 text-2xl text-amber-400 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div class="min-w-0">
                    <div class="text-amber-600 font-medium dark:text-amber-400">
                      {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models') }}
                    </div>
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                      {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_description') }}
                    </p>
                  </div>
                </div>
                <RouterLink
                  :to="browsingSpeechProviderSettingsPath"
                  class="flex shrink-0 items-center gap-1.5 text-sm text-amber-700 font-medium transition-colors dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
                >
                  <div i-solar:settings-bold-duotone class="text-lg" aria-hidden="true" />
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_provider_shortcut') }}
                  <div i-solar:arrow-right-linear class="text-base opacity-70" aria-hidden="true" />
                </RouterLink>
              </div>
              <template v-if="isKokoroSpeechProvider">
                <i18n-t
                  keypath="settings.pages.modules.speech.model_catalog.kokoro_help"
                  tag="p"
                  :class="['text-sm text-neutral-500 dark:text-neutral-400']"
                >
                  <template #note>
                    <span :class="['font-semibold text-neutral-700 dark:text-neutral-200']">NOTE:</span>
                  </template>
                  <template #quantization>
                    <span :class="['font-semibold tracking-wide text-primary-600 uppercase dark:text-primary-400']">Quantization</span>
                  </template>
                  <template #wasm>
                    <span :class="['font-semibold tracking-wide text-primary-600 uppercase dark:text-primary-400']">WASM</span>
                  </template>
                  <template #webgpu>
                    <span :class="['font-semibold tracking-wide text-primary-600 uppercase dark:text-primary-400']">WebGPU</span>
                  </template>
                </i18n-t>
                <div
                  :class="[
                    'flex items-start gap-2 rounded-lg border border-amber-500/15 px-3 py-2',
                    'bg-amber-50/30 dark:bg-amber-900/10',
                  ]"
                >
                  <div
                    :class="[
                      'i-solar:danger-circle-bold-duotone shrink-0 text-lg leading-snug',
                      'text-amber-400 dark:text-amber-400',
                    ]"
                  />
                  <i18n-t
                    keypath="settings.pages.modules.speech.model_catalog.kokoro_disclaimer"
                    tag="p"
                    :class="[
                      'min-w-0 flex-1 text-sm text-neutral-600 dark:text-neutral-400',
                    ]"
                  >
                    <template #label>
                      <span :class="['font-semibold tracking-wide text-neutral-900 uppercase dark:text-neutral-50']">
                        DISCLAIMER
                      </span>
                    </template>
                  </i18n-t>
                </div>
              </template>
              <div
                :class="[
                  'flex flex-col gap-3',
                  'lg:flex-row lg:items-start lg:justify-between',
                ]"
              >
                <SpeechModelCatalogFilters
                  v-if="isKokoroSpeechProvider"
                  v-model:sort-key="kokoroSortKey"
                  v-model:sort-direction="kokoroSortDirection"
                  class="min-w-0 flex-1"
                  :disable-clear-downloads="clearingKokoroDownloads"
                  @clear-downloads="clearKokoroDownloads"
                />
              </div>
              <RadioCardManySelect
                v-model:search-query="modelSearchQuery"
                :model-value="catalogRadioSelection"
                :items="isSpeechModelCatalogEmpty ? [] : speechModelSelectItems"
                :searchable="false"
                :allow-custom="true"
                :provider-id="displayedSpeechSource"
                :description-collapsed-by-default="true"
                :description-toggle-label="t('settings.pages.modules.speech.model_catalog.description_show')"
                :description-collapse-label="t('settings.pages.modules.speech.model_catalog.description_hide')"
                :search-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_placeholder')"
                :search-no-results-title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results')"
                :search-no-results-description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results_description', { query: modelSearchQuery })"
                :search-results-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_results', { count: '{count}', total: '{total}' })"
                :custom-input-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.custom_model_placeholder')"
                :expand-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.expand')"
                :collapse-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.collapse')"
                expanded-class="mb-12"
                @update:model-value="selectSpeechModel"
                @update:custom-value="updateCustomModelName"
              />
            </template>
          </div>

          <!-- Manual model for providers without listing -->
          <div v-else class="flex flex-col gap-4">
            <div
              class="flex items-center gap-3 border border-primary-200 rounded-lg bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20"
            >
              <div i-solar:info-circle-line-duotone class="text-2xl text-primary-500 dark:text-primary-400" />
              <div class="flex flex-col">
                <span class="font-medium">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported') }}</span>
                <span class="text-sm text-primary-600 dark:text-primary-400">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported_description') }}
                </span>
              </div>
            </div>
            <div class="mt-2">
              <label class="mb-1 block text-sm font-medium">
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
              </label>
              <input
                v-model="browsingManualModelDraft"
                type="text"
                class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
                @change="commitBrowsingManualModel"
              >
            </div>
          </div>
        </div>

        <!-- Voice Configuration Section -->
        <div v-if="browsingSpeechSource && browsingSpeechSource !== 'speech-noop'">
          <div flex="~ col gap-4">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
                Voice Configuration
              </h2>
              <SpeechBrowsingLastVoiceBanner
                v-if="showBrowsingLastVoiceBanner"
                :voice-id="lastVoiceOnBrowsingSpeechProvider"
                class="shrink-0"
                @select="selectLastVoiceOnBrowsingSpeechProvider"
              />
            </div>
            <div
              v-if="kokoroProgressText"
              class="max-w-full flex items-center gap-2"
            >
              <div
                :class="[
                  'flex w-max max-w-full shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium whitespace-nowrap',
                  kokoroProgressIsDownloadPhase
                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-primary-500/10 bg-primary-500/5 text-primary-500',
                ]"
                :title="kokoroProgressDetailHint"
              >
                <div class="i-solar:refresh-line-duotone shrink-0 animate-spin text-sm" />
                <span>{{ kokoroProgressLineText }}</span>
              </div>
              <button
                v-if="kokoroProgressCanCancel"
                type="button"
                class="shrink-0 border border-red-500/25 rounded-full bg-red-500/10 px-2.5 py-1 text-sm text-red-600 font-medium transition-colors hover:bg-red-500/15 dark:text-red-300"
                @click="cancelKokoroDownload"
              >
                {{ t('settings.pages.modules.speech.model_catalog.progress.cancel_download') }}
              </button>
            </div>

            <!-- Loading state -->
            <div v-if="isLoadingBrowsingSpeechVoices">
              <div class="flex flex-col gap-4">
                <Skeleton class="w-full rounded-lg p-2.5 text-sm">
                  <div class="h-1lh" />
                </Skeleton>
                <div flex="~ row gap-4">
                  <Skeleton class="w-full rounded-lg p-4 text-sm">
                    <div class="h-1lh" />
                  </Skeleton>
                  <Skeleton class="w-full rounded-lg p-4 text-sm">
                    <div class="h-1lh" />
                  </Skeleton>
                  <Skeleton class="w-full rounded-lg p-4 text-sm">
                    <div class="h-1lh" />
                  </Skeleton>
                </div>
                <Skeleton class="w-full rounded-lg p-3 text-sm">
                  <div class="h-1lh" />
                </Skeleton>
              </div>
            </div>

            <!-- Error state -->
            <!-- Voice selection with RadioCardManySelect (skip for OpenAI Compatible) -->
            <div
              v-else-if="resolvedBrowsingSpeechProvider !== 'openai-compatible-audio-speech' && displayedVoiceOptions.length > 0"
              class="space-y-6"
            >
              <VoiceCardManySelect
                v-model:search-query="voiceSearchQuery"
                v-model:voice-id="displayedSpeechVoiceId"
                :voices="displayedVoiceOptions"
                :searchable="true"
                :search-placeholder="t('settings.pages.modules.speech.sections.section.provider-voice-selection.search_voices_placeholder')"
                :search-no-results-title="t('settings.pages.modules.speech.sections.section.provider-voice-selection.no_voices')"
                :search-no-results-description="t('settings.pages.modules.speech.sections.section.provider-voice-selection.no_voices_description')"
                :search-results-text="t('settings.pages.modules.speech.sections.section.provider-voice-selection.search_voices_results', { count: '{count}', total: '{total}' })"
                :unsupported-voice-warning-title="t('settings.pages.modules.speech.sections.section.provider-voice-selection.unsupported_voice_warning_title')"
                :unsupported-voice-warning-content="t('settings.pages.modules.speech.sections.section.provider-voice-selection.unsupported_voice_warning_content')"
                :custom-input-placeholder="t('settings.pages.modules.speech.sections.section.provider-voice-selection.custom_voice_placeholder')"
                :expand-button-text="t('settings.pages.modules.speech.sections.section.provider-voice-selection.show_more')"
                :collapse-button-text="t('settings.pages.modules.speech.sections.section.provider-voice-selection.show_less')"
                :play-button-text="t('settings.pages.modules.speech.sections.section.provider-voice-selection.play_sample')"
                :pause-button-text="t('settings.pages.modules.speech.sections.section.provider-voice-selection.pause')"
                @update:custom-value="updateCustomVoiceName"
              />
            </div>

            <ErrorContainer
              v-else-if="speechProviderError"
              class="mb-2"
              title="Error loading voices"
              :error="speechProviderError"
            />

            <!-- No voices available -->
            <Alert
              v-else
              type="warning"
              icon="i-solar:info-circle-line-duotone"
              class="mb-2"
            >
              <template #title>
                {{ t('settings.pages.modules.speech.sections.section.provider-voice-selection.no_voices') }}
              </template>
              <template #content>
                {{ t('settings.pages.modules.speech.sections.section.provider-voice-selection.no_voices_description') }}.
                {{ t('settings.pages.modules.speech.sections.section.provider-voice-selection.no_voices_hint') }}
              </template>
            </Alert>

            <!-- Voice parameters -->
            <div flex="~ col gap-4">
              <!-- SSML Support -->
              <FieldCheckbox
                v-model="ssmlEnabled"
                label="Enable SSML"
                description="Enable Speech Synthesis Markup Language for more control over speech output"
              />
            </div>

            <!-- Manual voice input when no voices are available or for OpenAI Compatible -->
            <div
              v-if="resolvedBrowsingSpeechProvider === 'openai-compatible-audio-speech' || !availableVoices[resolvedBrowsingSpeechProvider] || availableVoices[resolvedBrowsingSpeechProvider].length === 0"
              class="mt-2 space-y-6"
            >
              <FieldInput
                type="text"
                :model-value="browsingSpeechVoiceId || ''"
                label="Voice Name"
                description="Enter the voice name for your custom voice"
                placeholder="Enter voice name (e.g., 'alloy', 'echo')"
                @change="commitCustomVoiceSelection"
                @update:model-value="updateCustomVoiceName"
              />

              <!-- Model selection for ElevenLabs -->
              <div v-if="resolvedBrowsingSpeechProvider === 'elevenlabs'">
                <label class="mb-1 block text-sm font-medium">
                  Model
                </label>
                <select
                  :value="browsingSpeechModelId"
                  :class="[
                    'w-full px-3 py-2',
                    'border border-neutral-300 rounded dark:border-neutral-700',
                    'bg-white dark:bg-neutral-900',
                  ]"
                  @change="selectSpeechModel(($event.target as HTMLSelectElement).value)"
                >
                  <option value="eleven_monolingual_v1">
                    Monolingual v1
                  </option>
                  <option value="eleven_multilingual_v1">
                    Multilingual v1
                  </option>
                  <option value="eleven_multilingual_v2">
                    Multilingual v2
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>
    </template>
    <template #right>
      <div :class="['flex w-full flex-col gap-6']">
        <div :class="['w-full rounded-xl']">
          <h2
            :class="[
              'mb-4 text-lg text-neutral-500 md:text-2xl dark:text-neutral-400',
            ]"
          >
            <div :class="['inline-flex items-center gap-4']">
              <TestDummyMarker />
              <div>
                {{ t('settings.pages.providers.provider.elevenlabs.playground.title') }}
              </div>
            </div>
          </h2>
          <div :class="['flex flex-col gap-4']">
            <FieldCheckbox
              v-model="useSSML"
              label="Use Custom SSML"
              description="Enable to input raw SSML instead of plain text"
            />

            <template v-if="!useSSML">
              <Textarea
                v-model="testText" h-24
                w-full
                :placeholder="t('settings.pages.providers.provider.elevenlabs.playground.fields.field.input.placeholder')"
              />
            </template>
            <template v-else>
              <textarea
                v-model="ssmlText"
                placeholder="Enter SSML text..."
                border="neutral-100 dark:neutral-800 solid 2 focus:neutral-200 dark:focus:neutral-700"
                transition="all duration-250 ease-in-out"
                bg="neutral-100 dark:neutral-800 focus:neutral-50 dark:focus:neutral-900"
                h-48 w-full rounded-lg px-3 py-2 text-sm font-mono outline-none
              />
            </template>

            <div :class="['flex flex-wrap items-center gap-3']">
              <button
                type="button"
                :disabled="isGenerating || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !browsingSpeechVoiceId"
                :class="[
                  'rounded-lg border-2 border-solid border-neutral-800 px-4 py-2 text-sm',
                  'bg-neutral-700 text-neutral-100',
                  'transition-[border] duration-250 ease-in-out',
                  'dark:border-neutral-200 dark:bg-neutral-300 dark:text-neutral-900',
                  (isGenerating || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !browsingSpeechVoiceId)
                    ? 'cursor-not-allowed opacity-50'
                    : '',
                ]"
                @click="generateTestSpeech"
              >
                <div :class="['flex items-center gap-2']">
                  <div class="i-solar:play-circle-bold-duotone" />
                  <span>{{ isGenerating ? t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.generating') : t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.label') }}</span>
                </div>
              </button>
              <SpeechPlaygroundTestTarget
                :model-id="playgroundTestModelId"
                :voice-name="playgroundTestVoiceName"
                :mismatches-browse="playgroundTestTargetMismatchesBrowse"
                :needs-voice-selection="!browsingSpeechVoiceId"
                :class="['min-w-0 max-w-full']"
              />
              <button
                v-if="audioUrl"
                type="button"
                :class="[
                  'rounded-lg border-2 border-solid border-primary-300 px-4 py-2 text-sm',
                  'transition-[border] duration-250 ease-in-out',
                  'dark:border-primary-800',
                ]"
                @click="() => stopTestAudio()"
              >
                <div :class="['flex items-center gap-2']">
                  <div class="i-solar:stop-circle-bold-duotone" />
                  <span>{{ t('settings.pages.modules.speech.sections.section.playground.buttons.stop.label') }}</span>
                </div>
              </button>
            </div>
            <audio v-if="audioUrl" ref="audioPlayer" :src="audioUrl" controls class="mt-2 w-full" />

            <SpeechAudioConsole v-if="activeSpeechProvider && activeSpeechProvider !== 'speech-noop'" />
          </div>
        </div>
      </div>
    </template>
  </SettingsSplitPane>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:user-speak-rounded-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.speech.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
