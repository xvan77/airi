<script setup lang="ts">
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Callout, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import VRMExpressions from './vrm-expressions.vue'

import { useAiriCardStore } from '../../../../stores/modules'
import { useVHackStore } from '../../../../stores/vhack'
import { PropertyColor, PropertyNumber } from '../../../data-pane'
import { Section } from '../../../layouts'
import { ColorPalette } from '../../../widgets'

defineProps<{
  palette: string[]
}>()

defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()

const { t } = useI18n()

const modelStore = useModelStore()
const vhackStore = useVHackStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { updateCard } = airiCardStore

const {
  modelSize,
  modelOffset,
  cameraFOV,
  modelRotationY,
  cameraDistance,
  trackingMode,

  directionalLightRotation,
  directionalLightIntensity,
  directionalLightColor,

  ambientLightIntensity,
  ambientLightColor,

  hemisphereLightIntensity,
  hemisphereSkyColor,
  hemisphereGroundColor,

  envSelect,
  skyBoxIntensity,
  vrmIdleAnimation,
} = storeToRefs(modelStore)
const { animationOptions } = storeToRefs(customVrmAnimationsStore)

// NOTICE: sceneMutationLocked was removed upstream; hardcoded to false.
const sceneMutationLocked = computed(() => false)
const trackingOptions = computed<{
  value: 'camera' | 'mouse' | 'none'
  label: string
  class: string
}[]>(() => [
  { value: 'camera', label: t('settings.vrm.scale-and-position.options.option.camera'), class: 'col-start-3' },
  { value: 'mouse', label: t('settings.vrm.scale-and-position.options.option.mouse'), class: 'col-start-4' },
  { value: 'none', label: t('settings.vrm.scale-and-position.options.option.disabled'), class: 'col-start-5' },
])

const activeTab = ref<'placement' | 'lighting'>('placement')

const vrmTabs = computed(() => [
  { label: 'Placement', value: 'placement', icon: 'i-solar:square-academic-cap-bold-duotone' },
  { label: 'Lighting', value: 'lighting', icon: 'i-solar:lightbulb-bold-duotone' },
])

const activeCharacterTab = ref<'expressions' | 'animations'>('expressions')
const characterTabs = computed(() => [
  { label: t('settings.live2d.customization.tabs.expressions'), value: 'expressions', icon: 'i-solar:smile-circle-bold-duotone' },
  { label: t('settings.live2d.customization.tabs.animations'), value: 'animations', icon: 'i-solar:play-bold-duotone' },
])

// switch between hemisphere light and sky box
const settingsLockClass = computed(() => {
  return sceneMutationLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})

const envOptions = computed(() => [
  {
    value: 'hemisphere',
    label: 'Hemisphere',
    icon: envSelect.value === 'hemisphere'
      ? 'i-solar:forbidden-circle-bold rotate-45'
      : 'i-solar:forbidden-circle-linear rotate-45',
  },
  {
    value: 'skyBox',
    label: 'SkyBox',
    icon: envSelect.value === 'skyBox'
      ? 'i-solar:gallery-circle-bold'
      : 'i-solar:gallery-circle-linear',
  },
])

const animationMappings = ref<Record<string, string>>({})
const hiddenAnimations = ref<string[]>([])
const showHiddenAnimations = ref(false)
const filterRenamedOnly = ref(false)
const editingAnimationKey = ref<string | null>(null)
const editingAnimationValue = ref('')

const filteredAnimations = computed(() => {
  return animationOptions.value.filter((animation) => {
    // Filter hidden
    if (!showHiddenAnimations.value && hiddenAnimations.value.includes(animation.value)) {
      return false
    }
    // Filter renamed
    if (filterRenamedOnly.value && !animationMappings.value[animation.value]) {
      return false
    }
    return true
  })
})

function isAnimationSelected(key: string) {
  return activeCard.value?.extensions?.airi?.acting?.idleAnimations?.includes(key) ?? false
}

function toggleAnimation(key: string) {
  if (!activeCardId.value || !activeCard.value)
    return

  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(key)
    ? current.filter(k => k !== key)
    : [...current, key]

  updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions.airi,
        acting: {
          ...activeCard.value.extensions.airi.acting,
          idleAnimations: next,
        },
      },
    },
  })
}

function toggleVisibility(name: string) {
  if (hiddenAnimations.value.includes(name)) {
    hiddenAnimations.value = hiddenAnimations.value.filter(p => p !== name)
  }
  else {
    hiddenAnimations.value = [...hiddenAnimations.value, name]
  }
}

function startEditing(animation: any) {
  editingAnimationKey.value = animation.value
  editingAnimationValue.value = animationMappings.value[animation.value] || ''
}

function saveAnimationName(name: string) {
  if (editingAnimationValue.value.trim() === '') {
    const updated = { ...animationMappings.value }
    delete updated[name]
    animationMappings.value = updated
  }
  else {
    animationMappings.value = { ...animationMappings.value, [name]: editingAnimationValue.value.trim() }
  }
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

function cancelEditing() {
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

function handleAnimationSelect(animationName: string | number | undefined) {
  if (animationName === '') {
    vrmIdleAnimation.value = ''
    if (activeCardId.value && activeCard.value) {
      // Filter out prefix-less (VRM) animations from card idleAnimations cycle list
      const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
      const next = current.filter(key => key.includes(':'))
      updateCard(activeCardId.value, {
        extensions: {
          ...activeCard.value.extensions,
          airi: {
            ...activeCard.value.extensions.airi,
            acting: {
              ...activeCard.value.extensions.airi.acting,
              idleAnimations: next,
            },
          },
        },
      })
    }
    return
  }
  if (typeof animationName !== 'string')
    return
  vrmIdleAnimation.value = animationName
}
</script>

<template>
  <div flex="~ col gap-4 w-full">
    <!-- === Character Customizations === -->
    <Section
      title="Character Customizations"
      icon="i-solar:user-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
      size="sm"
      :expand="true"
    >
      <div class="mb-4 px-2 pt-2">
        <SelectTab v-model="activeCharacterTab" :options="characterTabs" size="sm" compact class="mb-4" />
      </div>

      <div :class="settingsLockClass">
        <!-- === Expressions Tab === -->
        <div v-if="activeCharacterTab === 'expressions'" flex="~ col gap-4" p-2>
          <VRMExpressions />
        </div>

        <!-- === Motions Tab === -->
        <div v-else-if="activeCharacterTab === 'animations'" :class="['w-full', 'min-w-0']">
          <!-- Base Idle Animation -->
          <div class="mb-2 px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Base Idle Animation
          </div>
          <!-- Controls Bar -->
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex gap-1">
              <Button
                size="sm"
                :variant="showHiddenAnimations ? 'primary' : 'secondary'"
                @click="showHiddenAnimations = !showHiddenAnimations"
              >
                <template #icon>
                  <div :class="showHiddenAnimations ? 'i-solar:eye-bold-duotone' : 'i-solar:eye-closed-bold-duotone'" />
                </template>
                {{ showHiddenAnimations ? 'Showing Hidden' : 'Hide Hidden' }}
              </Button>
              <Button
                size="sm"
                :variant="filterRenamedOnly ? 'primary' : 'secondary'"
                @click="filterRenamedOnly = !filterRenamedOnly"
              >
                <template #icon>
                  <div class="i-solar:pen-bold-duotone" />
                </template>
                {{ filterRenamedOnly ? 'Renamed Only' : 'All' }}
              </Button>
            </div>
            <div class="text-xs text-neutral-500">
              {{ filteredAnimations.length }} animations
            </div>
          </div>
          <!-- Fixed Height Scrollable List -->
          <div class="mb-4 max-h-[300px] overflow-y-auto border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <!-- None Option -->
            <div
              :class="[
                'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 transition-colors cursor-pointer',
                !vrmIdleAnimation ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
              @click="handleAnimationSelect('')"
            >
              <div class="flex items-center gap-2">
                <div v-if="!vrmIdleAnimation" class="h-2 w-2 rounded-full bg-primary-500" />
                <div class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                  None
                </div>
              </div>
            </div>

            <div v-if="filteredAnimations.length === 0" class="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No animations match filters
            </div>
            <div
              v-for="animation in filteredAnimations"
              :key="animation.value"
              :class="[
                'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors',
                vrmIdleAnimation === animation.value || isAnimationSelected(animation.value) ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
            >
              <!-- Left Side: Name -->
              <div class="min-w-0 flex-1 cursor-pointer" @click="handleAnimationSelect(animation.value)">
                <div class="flex items-center gap-2">
                  <!-- Active Indicator -->
                  <div v-if="vrmIdleAnimation === animation.value" class="h-2 w-2 rounded-full bg-primary-500" />

                  <!-- Name (Editable) -->
                  <div v-if="editingAnimationKey === animation.value" class="flex flex-1 items-center gap-1" @click.stop>
                    <input
                      v-model="editingAnimationValue"
                      type="text"
                      :placeholder="animation.label"
                      class="max-w-[230px] w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                      @keydown.enter="saveAnimationName(animation.value)"
                      @keydown.esc="cancelEditing"
                    >
                    <button class="text-xs text-green-500 hover:text-green-600" @click="saveAnimationName(animation.value)">
                      <div class="i-solar:check-circle-bold-duotone text-lg" />
                    </button>
                    <button class="text-xs text-red-500 hover:text-red-600" @click="cancelEditing">
                      <div class="i-solar:close-circle-bold-duotone text-lg" />
                    </button>
                  </div>
                  <div v-else class="max-w-[230px] truncate text-sm text-neutral-900 font-medium dark:text-neutral-100">
                    {{ animationMappings[animation.value] || animation.label }}
                  </div>
                </div>
              </div>

              <!-- Right Side: Actions -->
              <div class="flex items-center gap-1" @click.stop>
                <!-- Loop / Cycle Toggle -->
                <button
                  v-if="activeCard"
                  :class="[
                    'rounded p-1 transition-colors',
                    isAnimationSelected(animation.value)
                      ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                      : 'text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800',
                  ]"
                  :title="isAnimationSelected(animation.value) ? 'Remove from Idle Cycle' : 'Add to Idle Cycle'"
                  @click="toggleAnimation(animation.value)"
                >
                  <div class="i-solar:infinity-bold-duotone text-sm" />
                </button>

                <!-- Edit Button -->
                <button
                  class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  title="Rename"
                  @click="startEditing(animation)"
                >
                  <div class="i-solar:pen-bold-duotone text-sm" />
                </button>

                <!-- Visibility Toggle -->
                <button
                  class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  :title="hiddenAnimations.includes(animation.value) ? 'Show' : 'Hide'"
                  @click="toggleVisibility(animation.value)"
                >
                  <div :class="hiddenAnimations.includes(animation.value) ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>

    <Section
      :title="t('settings.pages.models.sections.section.scene')"
      icon="i-solar:people-nearby-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
      size="sm"
      :expand="true"
    >
      <ColorPalette class="mb-4 mt-2" :colors="palette.map(hex => ({ hex, name: hex }))" mx-auto />

      <!-- Tab Selection -->
      <div class="mb-4 px-2">
        <SelectTab v-model="activeTab" :options="vrmTabs" size="sm" />
      </div>

      <div :class="settingsLockClass">
        <!-- === Placement Tab === -->
        <div v-if="activeTab === 'placement'" flex="~ col gap-4" p-2>
          <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
            <PropertyNumber
              v-model="modelOffset.x"
              :config="{ min: -modelSize.x * 2, max: modelSize.x * 2, step: modelSize.x / 1000, label: 'X', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.x')"
            />
            <PropertyNumber
              v-model="modelOffset.y"
              :config="{ min: -modelSize.y * 2, max: modelSize.y * 2, step: modelSize.y / 1000, label: 'Y', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.y')"
            />
            <PropertyNumber
              v-model="modelOffset.z"
              :config="{ min: -modelSize.z * 2, max: modelSize.z * 2, step: modelSize.z / 1000, label: 'Z', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.z')"
            />
            <PropertyNumber
              v-model="modelRotationY"
              :config="{ min: -180, max: 180, step: 1, label: t('settings.vrm.scale-and-position.rotation-y'), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.rotation-y')"
            />
            <PropertyNumber
              v-model="cameraDistance"
              :config="{ min: modelSize.z, max: modelSize.z * 20, step: modelSize.z / 100, label: t('settings.vrm.scale-and-position.camera-distance'), formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.camera-distance')"
            />
            <PropertyNumber
              v-model="cameraFOV"
              :config="{ min: 1, max: 180, step: 1, label: t('settings.vrm.scale-and-position.fov'), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.fov')"
            />

            <!-- Eye Tracking Mode -->
            <div class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
              {{ t('settings.vrm.scale-and-position.eye-tracking-mode.title') }}
            </div>
            <div />
            <div grid-col-span-3>
              <SelectTab
                v-model="trackingMode"
                :options="trackingOptions"
                :disabled="sceneMutationLocked"
                size="sm"
              />
            </div>
          </div>
        </div>

        <!-- === Lighting Tab === -->
        <div v-if="activeTab === 'lighting'" flex="~ col gap-6" p-2>
          <!-- Directional Light -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Directional Light
            </div>
            <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyNumber
                v-model="directionalLightRotation.x"
                :config="{ min: -180, max: 180, step: 1, label: 'X°', formatValue: val => val?.toFixed(0), disabled: sceneMutationLocked }"
                label="Rotation X"
              />
              <PropertyNumber
                v-model="directionalLightRotation.y"
                :config="{ min: -180, max: 180, step: 1, label: 'Y°', formatValue: val => val?.toFixed(0), disabled: sceneMutationLocked }"
                label="Rotation Y"
              />
              <PropertyColor
                v-model="directionalLightColor"
                :disabled="sceneMutationLocked"
                label="Color"
              />
              <PropertyNumber
                v-model="directionalLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
          </div>

          <!-- Ambient Light -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Ambient Light
            </div>
            <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyColor
                v-model="ambientLightColor"
                :disabled="sceneMutationLocked"
                label="Color"
              />
              <PropertyNumber
                v-model="ambientLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
          </div>

          <!-- Environment -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Environment
            </div>
            <div class="mb-1">
              <SelectTab v-model="envSelect" :options="envOptions" :disabled="sceneMutationLocked" size="sm" />
            </div>

            <div v-if="envSelect === 'hemisphere'" grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyColor
                v-model="hemisphereSkyColor"
                :disabled="sceneMutationLocked"
                label="Sky Color"
              />
              <PropertyColor
                v-model="hemisphereGroundColor"
                :disabled="sceneMutationLocked"
                label="Ground Color"
              />
              <PropertyNumber
                v-model="hemisphereLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
            <div v-else grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyNumber
                v-model="skyBoxIntensity"
                :config="{ min: 0, max: 1, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                :label="t('settings.vrm.skybox.skybox-intensity')"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>

    <!-- === Advanced Tools === -->
    <Section
      title="Advanced"
      icon="i-solar:settings-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
      size="sm"
      :expand="false"
    >
      <div flex="~ col gap-4" p-2 :class="settingsLockClass">
        <div flex="~ col gap-2">
          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            V-HACK Editor
          </div>
          <Button
            :variant="vhackStore.isHackerModeActive ? 'primary' : 'secondary'"
            :disabled="sceneMutationLocked"
            @click="vhackStore.toggleHackerMode"
          >
            <template #icon>
              <div i-solar:mask-h-bold-duotone />
            </template>
            V-HACK Dashboard
          </Button>
          <p class="mb-2 px-1 text-[10px] text-neutral-400">
            Open the Hacker Inspector for real-time mesh and material modding.
          </p>

          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Theme Extraction
          </div>
          <Button variant="secondary" :disabled="sceneMutationLocked" @click="$emit('extractColorsFromModel')">
            <template #icon>
              <div i-solar:palette-bold-duotone />
            </template>
            {{ t('settings.vrm.theme-color-from-model.button-extract.title') }}
          </Button>
          <p class="px-1 text-[10px] text-neutral-400">
            Extract dominant colors from the model texture to set UI theme.
          </p>
        </div>

        <div flex="~ col gap-2">
          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Model Information
          </div>
          <Callout :label="t('settings.vrm.scale-and-position.model-info-title')">
            <div class="text-[11px] text-neutral-600 space-y-1 dark:text-neutral-400">
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-x') }}</span>
                <span font-mono>{{ modelSize.x.toFixed(4) }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-y') }}</span>
                <span font-mono>{{ modelSize.y.toFixed(4) }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-z') }}</span>
                <span font-mono>{{ modelSize.z.toFixed(4) }}</span>
              </div>
            </div>
          </Callout>
        </div>

        <Callout theme="lime" label="Tips!">
          <div class="text-[11px] text-neutral-600 leading-relaxed dark:text-neutral-400">
            {{ t('settings.vrm.scale-and-position.tips') }}
          </div>
        </Callout>
      </div>
    </Section>
  </div>
</template>
