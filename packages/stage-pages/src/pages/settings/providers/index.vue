<script setup lang="ts">
import type { ProviderDeployment, ProviderPricing } from '@proj-airi/stage-ui/libs/providers/attributes'
import type { Ref } from 'vue'

import { isCustomProvidersDisabled } from '@proj-airi/stage-shared'
import { IconStatusItem, ProviderCatalogFilterGlossary, RippleGrid } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { compareProviderCatalogOrder } from '@proj-airi/stage-ui/libs/model-catalog'
import { PROVIDER_DEPLOYMENT_FILTER_OPTIONS } from '@proj-airi/stage-ui/libs/providers/attributes'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

interface ProviderSourceCard {
  id: string
  category: string
  to?: string
  icon?: string
  iconColor?: string
  iconImage?: string
  name?: string
  description?: string
  localizedName?: string
  localizedDescription?: string
  configured?: boolean
  pricing?: ProviderPricing
  pricingTiers?: readonly ProviderPricing[]
  deployment?: ProviderDeployment
  beginnerRecommended?: boolean
}

interface ProviderBlockConfig {
  id: string
  icon: string
  title: string
  description: string
  providersRef: Readonly<Ref<ProviderSourceCard[]>>
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const providersStore = useProviderStore()
const providerConfigStore = useProviderConfigStore()
const artistryStore = useArtistryStore()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()
const { trackProviderClick } = useAnalytics()

const {
  allChatProvidersMetadata,
  allAudioSpeechProvidersMetadata,
  allAudioTranscriptionProvidersMetadata,
  allVisionProvidersMetadata,
} = storeToRefs(providersStore)
const { replicaSyncState } = storeToRefs(providerConfigStore)

const allArtistryProvidersMetadata = computed<ProviderSourceCard[]>((): ProviderSourceCard[] => {
  return [
    {
      id: 'comfyui',
      category: 'artistry',
      icon: 'i-solar:gallery-bold-duotone',
      iconColor: 'text-indigo-500',
      name: 'ComfyUI',
      localizedName: 'ComfyUI',
      description: t('settings.pages.providers.categories.artistry.items.comfyui.description'),
      localizedDescription: t('settings.pages.providers.categories.artistry.items.comfyui.description'),
      configured: !!artistryStore.comfyuiServerUrl,
      to: '/settings/providers/artistry/comfyui',
      pricing: 'free',
      deployment: 'other-app',
      beginnerRecommended: true,
      iconImage: undefined,
    },
    ...(isCustomProvidersDisabled()
      ? []
      : ([
          {
            id: 'replicate',
            category: 'artistry',
            icon: 'i-lobe-icons:replicate',
            iconColor: 'i-lobe-icons:replicate-color',
            name: 'Replicate',
            localizedName: 'Replicate',
            description: t('settings.pages.providers.categories.artistry.items.replicate.description'),
            localizedDescription: t('settings.pages.providers.categories.artistry.items.replicate.description'),
            configured: !!artistryStore.replicateApiKey,
            to: '/settings/providers/artistry/replicate',
            pricing: 'paid',
            deployment: 'cloud',
            iconImage: undefined,
          },
          {
            id: 'nanobanana',
            category: 'artistry',
            icon: 'i-solar:gallery-round-bold-duotone',
            iconColor: 'text-amber-500',
            name: 'Nano Banana',
            localizedName: 'Nano Banana',
            description: t('settings.pages.providers.categories.artistry.items.nanobanana.description'),
            localizedDescription: t('settings.pages.providers.categories.artistry.items.nanobanana.description'),
            configured: !!artistryStore.nanobananaApiKey,
            to: '/settings/providers/artistry/nanobanana',
            pricing: 'free',
            deployment: 'cloud',
            iconImage: undefined,
          },
        ] satisfies ProviderSourceCard[])),
  ]
})

const providerBlocksConfig: ProviderBlockConfig[] = [
  {
    id: 'chat',
    icon: 'i-solar:chat-square-like-bold-duotone',
    title: t('settings.pages.providers.categories.chat.title'),
    description: t('settings.pages.providers.categories.chat.description'),
    providersRef: allChatProvidersMetadata,
  },
  {
    id: 'vision',
    icon: 'i-solar:eye-bold-duotone',
    title: t('settings.pages.providers.categories.vision.title'),
    description: t('settings.pages.providers.categories.vision.description'),
    providersRef: allVisionProvidersMetadata,
  },
  {
    id: 'speech',
    icon: 'i-solar:user-speak-rounded-bold-duotone',
    title: t('settings.pages.providers.categories.speech.title'),
    description: t('settings.pages.providers.categories.speech.description'),
    providersRef: allAudioSpeechProvidersMetadata,
  },
  {
    id: 'transcription',
    icon: 'i-solar:microphone-3-bold-duotone',
    title: t('settings.pages.providers.categories.transcription.title'),
    description: t('settings.pages.providers.categories.transcription.description'),
    providersRef: allAudioTranscriptionProvidersMetadata,
  },
  {
    id: 'artistry',
    icon: 'i-solar:palette-bold-duotone',
    title: t('settings.pages.providers.categories.artistry.title'),
    description: t('settings.pages.providers.categories.artistry.description'),
    providersRef: allArtistryProvidersMetadata,
  },
]

const activeTabId = ref(providerBlocksConfig[0].id)
const filterPricing = ref<'all' | ProviderPricing>('all')
const filterDeployment = ref<'all' | ProviderDeployment>('all')
const providersIntroDismissed = useLocalStorage('settings/providers/intro-dismissed', false)

onMounted(() => {
  if (route.hash) {
    const hashId = route.hash.replace('#', '')
    if (providerBlocksConfig.some(b => b.id === hashId)) {
      activeTabId.value = hashId
    }
  }
})

function setActiveTab(id: string) {
  activeTabId.value = id
  filterPricing.value = 'all'
  filterDeployment.value = 'all'
  router.replace({ hash: `#${id}` }).catch(() => {})
}

const providerBlocks = computed(() => {
  let globalIndex = 0
  return providerBlocksConfig
    .filter(block => block.id === activeTabId.value)
    .map((block) => {
      const filteredProviders = block.providersRef.value
        .filter((p) => {
          if (p.id === 'speech-noop')
            return false
          if (filterPricing.value !== 'all') {
            const tiers = p.pricingTiers?.length
              ? p.pricingTiers
              : p.pricing
                ? [p.pricing]
                : []
            if (!tiers.includes(filterPricing.value))
              return false
          }
          if (filterDeployment.value !== 'all' && p.deployment !== filterDeployment.value)
            return false
          return true
        })
        .sort(compareProviderCatalogOrder)
        .map(provider => ({
          ...provider,
          renderIndex: globalIndex++,
        }))

      return {
        id: block.id,
        icon: block.icon,
        title: block.title,
        description: block.description,
        providers: filteredProviders,
      }
    })
})
</script>

<template>
  <div :class="['mb-4', 'flex', 'flex-col', 'gap-3', 'pb-8']">
    <div
      v-if="!providersIntroDismissed"
      class="relative rounded-lg bg-primary-500/10 p-3 pr-9 dark:bg-primary-800/25"
    >
      <button
        type="button"
        :class="[
          'absolute right-2 top-2 z-10',
          'flex h-7 w-7 items-center justify-center rounded-md',
          'border border-neutral-400/35 bg-white/80 text-neutral-700',
          'transition-colors hover:bg-white hover:text-neutral-900',
          'dark:border-neutral-500/50 dark:bg-neutral-900/70 dark:text-neutral-100',
          'dark:hover:bg-neutral-800 dark:hover:text-white',
        ]"
        :aria-label="$t('settings.pages.providers.helpinfo.dismiss')"
        :title="$t('settings.pages.providers.helpinfo.dismiss')"
        @click="providersIntroDismissed = true"
      >
        <div class="i-solar:close-circle-bold text-lg" aria-hidden="true" />
      </button>
      <div class="mb-1 text-base text-primary-800 font-normal dark:text-primary-100">
        {{ $t('settings.pages.providers.helpinfo.title') }}
      </div>
      <div class="text-sm text-primary-700 leading-snug dark:text-primary-300">
        <i18n-t keypath="settings.pages.providers.helpinfo.description">
          <template #chat>
            <span class="inline-flex items-center gap-1 rounded-md bg-primary-500/10 px-1.5 py-0.5 dark:bg-primary-800/25">
              <span class="i-solar:chat-square-like-bold-duotone" aria-hidden="true" />
              <strong class="font-normal">Chat</strong>
            </span>
          </template>
        </i18n-t>
      </div>
    </div>

    <div class="flex flex-row flex-wrap gap-1.5">
      <button
        v-for="block in providerBlocksConfig"
        :key="block.id"
        class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors duration-200"
        :class="activeTabId === block.id ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold' : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400'"
        @click="setActiveTab(block.id)"
      >
        <div :class="block.icon" class="text-xl" />
        {{ block.title }}
      </button>
    </div>

    <RippleGrid
      :sections="providerBlocks"
      :get-items="block => block.providers"
      :columns="{ default: 1, sm: 2, xl: 3 }"
      :origin-index="lastClickedIndex"
      @item-click="({ globalIndex }) => setLastClickedIndex(globalIndex)"
    >
      <template #header="{ section: block }">
        <div class="w-full flex flex-col gap-2">
          <div class="flex flex-row items-center gap-2">
            <div :id="block.id" :class="[block.icon, 'text-2xl text-neutral-500 dark:text-neutral-400']" />
            <div>
              <div>
                <span class="text-xs text-neutral-400 sm:text-sm dark:text-neutral-500">{{ block.description }}</span>
              </div>
              <div class="flex text-nowrap text-xl font-normal sm:text-2xl">
                <div>
                  {{ block.title }}
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 text-xs">
            <div class="flex flex-row flex-wrap items-center gap-3">
              <div class="flex flex-row flex-wrap items-center gap-2">
                <span class="text-neutral-400 font-medium dark:text-neutral-500">{{ $t('settings.pages.providers.filters.pricing') }}:</span>
                <div class="flex flex-row items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
                  <button
                    v-for="opt in ['all', 'free', 'limited', 'paid'] as const"
                    :key="opt"
                    type="button"
                    class="rounded-md px-2 py-0.5 transition-all"
                    :class="filterPricing === opt ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-neutral-700 dark:text-primary-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
                    @click="filterPricing = opt"
                  >
                    {{ $t(`settings.pages.providers.filters.${opt}`) }}
                  </button>
                </div>
              </div>
              <div class="flex flex-row flex-wrap items-center gap-2">
                <span class="text-neutral-400 font-medium dark:text-neutral-500">{{ $t('settings.pages.providers.filters.deployment') }}:</span>
                <div class="flex flex-row items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
                  <button
                    v-for="opt in (['all', ...PROVIDER_DEPLOYMENT_FILTER_OPTIONS] as const)"
                    :key="opt"
                    type="button"
                    class="rounded-md px-2 py-0.5 transition-all"
                    :class="filterDeployment === opt ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-neutral-700 dark:text-primary-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
                    @click="filterDeployment = opt"
                  >
                    {{ $t(`settings.pages.providers.filters.${opt}`) }}
                  </button>
                </div>
              </div>
            </div>
            <ProviderCatalogFilterGlossary line-divider />
          </div>
        </div>
      </template>

      <template #item="{ item: provider }">
        <IconStatusItem
          :title="provider.localizedName || 'Unknown'"
          :description="provider.localizedDescription"
          :icon="provider.icon"
          :icon-color="provider.iconColor"
          :icon-image="provider.iconImage"
          :to="provider.to ?? `/settings/providers/${provider.category}/${provider.id}`"
          :configured="provider.configured"
          :sync-state="replicaSyncState[provider.id]"
          :pricing="provider.pricing"
          :pricing-tiers="provider.pricingTiers"
          :deployment="provider.deployment"
          :beginner-recommended="provider.beginnerRecommended"
          @click="trackProviderClick(provider.id, provider.category)"
        />
      </template>
    </RippleGrid>
  </div>
  <div
    v-motion
    text="neutral-500/5 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, y: 20 }"
    :enter="{ scale: 1, opacity: 1, y: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:box-minimalistic-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.description
  icon: i-solar:box-minimalistic-bold-duotone
  settingsEntry: true
  order: 6
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
