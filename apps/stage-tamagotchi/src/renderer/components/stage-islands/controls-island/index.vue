<script setup lang="ts">
import { defineInvoke } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseInElement } from '@proj-airi/electron-vueuse'
import { HearingConfigDialog } from '@proj-airi/stage-ui/components'
import { useSettings, useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'
import { ScrollableArea, useTheme } from '@proj-airi/ui'
import { useFocusWithin, useMouseInElement, useMousePressed } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ControlButtonTooltip from './control-button-tooltip.vue'
import ControlButton from './control-button.vue'
import ControlsIslandChatButton from './controls-island-chat-button.vue'
import ControlsIslandSpeechMute from './controls-island-speech-mute.vue'
import IndicatorMicVolume from './indicator-mic-volume.vue'

import {
  electron,
  electronOpenSettings,
  electronStartDraggingWindow,
  electronWindowSetAlwaysOnTop,
} from '../../../../shared/eventa'
import { useControlsIslandLayout } from './use-controls-island-layout'
import { useControlsIslandPlacement } from './use-controls-island-placement'

interface Emits {
  /** Reports whether an active interaction must delay placement changes. */
  interactionChange: [active: boolean]
}

const props = withDefaults(defineProps<{
  /**
   * The cursor is away from the stage window, so the Island hides. The stage
   * page owns the cursor signals and decides this.
   */
  cursorAway?: boolean
}>(), {
  cursorAway: false,
})

const emit = defineEmits<Emits>()

const { themeMode, switchToNextTheme } = useTheme()
const { t } = useI18n()
// The button shows the current theme, and its label tells what a press selects.
const themeIcons = {
  light: 'i-solar:sun-2-outline',
  dark: 'i-solar:moon-outline',
  auto: 'i-lucide:contrast',
} as const
const themeActions = {
  light: 'switch_to_dark_mode',
  dark: 'switch_to_system_mode',
  auto: 'switch_to_light_mode',
} as const
const themeLabel = computed(() => ({
  light: t('tamagotchi.stage.controls-island.switch-to-dark-mode'),
  dark: t('tamagotchi.stage.controls-island.switch-to-system-mode'),
  auto: t('tamagotchi.stage.controls-island.switch-to-light-mode'),
})[themeMode.value])
const placement = useControlsIslandPlacement()
const { isLeft, isTop, motionPhase } = placement

const settingsAudioDeviceStore = useSettingsAudioDevice()
const settingsStore = useSettings()
const context = useElectronEventaContext()
const { enabled } = storeToRefs(settingsAudioDeviceStore)
const { alwaysOnTop, controlsIslandIconSize } = storeToRefs(settingsStore)
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const isLinux = useElectronEventaInvoke(electron.app.isLinux)
const setAlwaysOnTop = useElectronEventaInvoke(electronWindowSetAlwaysOnTop)

const expanded = ref(false)
const islandElement = useTemplateRef<HTMLElement>('island')
const islandScrollArea = useTemplateRef<InstanceType<typeof ScrollableArea>>('islandScrollArea')
const islandViewport = computed(() => islandScrollArea.value?.viewport)
const islandContent = useTemplateRef<HTMLElement>('islandContent')
const mainControlsElement = useTemplateRef<HTMLElement>('mainControls')
const menuContent = useTemplateRef<HTMLElement>('menuContent')
const availableSpaceElement = useTemplateRef<HTMLElement>('availableSpace')
const gapElement = useTemplateRef<HTMLElement>('gap')
const { direction, scrollWholeIsland, layoutClasses: islandLayoutClasses } = useControlsIslandLayout({
  main: mainControlsElement,
  menu: menuContent,
  available: availableSpaceElement,
  gap: gapElement,
  viewport: islandViewport,
  menuViewport: islandViewport,
  content: islandContent,
}, expanded, placement)

// Tracks open overlays/dialogs that should prevent auto-collapse (e.g. 'hearing', 'profile-picker')
const blockingOverlays = reactive(new Set<string>())
// A scrollbar drag can leave the visible boundary before the user releases it.
const { pressed } = useMousePressed({ target: islandElement })
const isBlocked = computed(() => blockingOverlays.size > 0 || pressed.value)

function setOverlay(key: string, active: boolean) {
  if (active) {
    blockingOverlays.add(key)
    return
  }

  blockingOverlays.delete(key)
}

/** True while the microphone button waits for the permission prompt. The button is disabled, so a second press cannot start another request. */
const microphonePending = ref(false)
const microphoneLabel = computed(() => enabled.value
  ? t('tamagotchi.stage.controls-island.disable-microphone')
  : t('tamagotchi.stage.controls-island.enable-microphone'))

/**
 * Turns the microphone preference on or off. The Hearing input mode still decides when the microphone captures.
 * Only this press asks for permission. A refusal opens Hearing controls, which show the reason from the device store.
 */
async function toggleMicrophone() {
  if (microphonePending.value)
    return
  if (enabled.value) {
    enabled.value = false
    return
  }

  microphonePending.value = true
  try {
    if (await settingsAudioDeviceStore.askPermission()) {
      enabled.value = true
      return
    }
    setOverlay('hearing', true)
  }
  finally {
    microphonePending.value = false
  }
}

// NOTICE: On native Wayland, `isOutsideByCursor` can get permanently stuck
// because it is driven by Electron's screen.getCursorScreenPoint(), which
// Chromium's Ozone/Wayland backend cannot query reliably the way X11 does.
// Source: https://github.com/moeru-ai/airi/issues/2521 (CachyOS + KDE
// Plasma, Flatpak). OR it with the DOM-based `isOutsideByDom`
// (useMouseInElement), which self-corrects on every pointermove and needs
// no OS-level cursor query, so a broken cursor signal cannot force a false
// collapse. The stage reads this paired result for click-through hit
// testing, where DOM events may not reach the renderer at all.
// Removal condition: once Ozone/Wayland reports the absolute
// cursor position reliably upstream, or the click-through hit-testing no
// longer depends on this composable.
const { isOutside: isOutsideByCursor } = useElectronMouseInElement(islandElement)
const { isOutside: isOutsideByDom } = useMouseInElement(islandElement)
const isOutside = computed(() => isOutsideByCursor.value && isOutsideByDom.value)

// A user who works in a dialog or with the keyboard keeps the Island after the cursor leaves the window.
const { focused: islandFocused } = useFocusWithin(islandElement)
const concealed = computed(() => props.cursorAway && !isBlocked.value && !islandFocused.value)

// The stage page observes this element for cursor hit testing.
defineExpose({
  get element() { return islandElement.value },
  get isOutside() { return isOutside.value },
  get overlayActive() { return blockingOverlays.size > 0 || pressed.value },
  get hearingDialogOpen() { return blockingOverlays.has('hearing') },
  set hearingDialogOpen(v: boolean) { setOverlay('hearing', v) },
})

watch(isBlocked, (isInteractionBlocked) => {
  emit('interactionChange', isInteractionBlocked)
}, { immediate: true })

// Apply alwaysOnTop on mount and when it changes
watch(alwaysOnTop, (val) => {
  setAlwaysOnTop(val)
}, { immediate: true })

// Grouped classes for icon / border / padding and combined style class
const adjustStyleClasses = computed(() => {
  let isLarge: boolean

  // Determine size based on setting
  switch (controlsIslandIconSize.value) {
    case 'large':
      isLarge = true
      break
    case 'small':
      isLarge = false
      break
    case 'auto':
    default:
      isLarge = true
      break
  }

  const icon = isLarge ? 'size-5' : 'size-3.5'
  const border = isLarge ? 'border-2' : 'border'
  const padding = isLarge ? 'p-2' : 'p-1'
  return { icon, border, padding, button: `${border} ${padding}` }
})

const islandPositionClasses = computed(() => [
  isTop.value ? 'top-2' : 'bottom-2',
  isLeft.value ? 'left-2' : 'right-2',
])
const islandMotionClasses = computed(() => {
  const isHidden = motionPhase.value === 'leaving' || motionPhase.value === 'entering'

  return [
    motionPhase.value === 'entering'
      ? 'transition-none'
      : 'transition-[opacity,transform] duration-200 ease-out',
    motionPhase.value === 'idle' ? '' : 'will-change-[opacity,transform] pointer-events-none',
    isHidden ? 'scale-95' : 'scale-100',
    isHidden || concealed.value ? 'opacity-0' : 'opacity-100',
    isHidden && isLeft.value ? '-translate-x-3' : '',
    isHidden && !isLeft.value ? 'translate-x-3' : '',
    isHidden && isTop.value ? '-translate-y-2' : '',
    isHidden && !isTop.value ? 'translate-y-2' : '',
  ]
})
// Main bar order is always Settings → … → drag on screen (top to bottom). Do not
// mirror flex-col-reverse when the island docks to a top corner — that flipped
// the stack when the window crossed the display midline.
const mainControlsLayoutClasses = computed(() => [
  'flex gap-1 flex-col',
])
/**
 * This is a know issue (or expected behavior maybe) to Electron.
 * We don't use this approach on Linux because it's not working.
 *
 * See `apps/stage-tamagotchi/src/main/windows/main/index.ts` for handler definition
 */
const startDraggingWindow = !isLinux() ? defineInvoke(context.value, electronStartDraggingWindow) : undefined
</script>

<template>
  <div
    ref="island"
    data-testid="controls-island"
    :data-direction="direction"
    :data-scroll-owner="scrollWholeIsland ? 'island' : 'menu'"
    :class="[
      'fixed max-h-[calc(100dvh-1rem)] max-w-[calc(100dvw-1rem)]',
      islandPositionClasses,
      islandMotionClasses,
    ]"
  >
    <!-- Probes track viewport/rem sizes without adding scrollable overflow. -->
    <div aria-hidden="true" :class="['pointer-events-none invisible fixed size-0 overflow-hidden [contain:strict]']">
      <div ref="availableSpace" :class="['h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)]']" />
      <div ref="gap" :class="['size-3']" />
    </div>
    <ScrollableArea
      ref="islandScrollArea"
      orientation="both"
      :class="['max-h-[inherit] max-w-[inherit]']"
      viewport-class="overscroll-contain"
    >
      <div ref="islandContent" :class="['relative w-max flex', islandLayoutClasses]">
        <div
          ref="menuContent"
          aria-hidden="true"
          :class="['pointer-events-none invisible absolute size-0 overflow-hidden [contain:strict]']"
        />

        <!-- Main Controls -->
        <div ref="mainControls" data-testid="main-controls" :class="['shrink-0', mainControlsLayoutClasses]">
          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{ name: 'controls_island_action', action: 'toggle_settings' }"
              data-testid="controls-island-settings"
              :button-style="adjustStyleClasses.button"
              :aria-label="t('tamagotchi.stage.controls-island.open-settings')"
              @click="openSettings({ route: '/settings' })"
            >
              <div :class="['i-solar:settings-minimalistic-outline text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.open-settings') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{ name: 'controls_island_action', action: 'open_consciousness_settings' }"
              data-testid="controls-island-consciousness"
              :button-style="adjustStyleClasses.button"
              :aria-label="t('tamagotchi.stage.controls-island.open-consciousness')"
              @click="openSettings({ route: '/settings/modules/consciousness' })"
            >
              <div :class="['i-solar:ghost-bold-duotone text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.open-consciousness') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{ name: 'controls_island_action', action: 'open_speech_settings' }"
              data-testid="controls-island-speech-module"
              :button-style="adjustStyleClasses.button"
              :aria-label="t('tamagotchi.stage.controls-island.open-speech')"
              @click="openSettings({ route: '/settings/modules/speech' })"
            >
              <div :class="['i-solar:user-speak-rounded-bold-duotone text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.open-speech') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{ name: 'controls_island_action', action: 'open_models_settings' }"
              data-testid="controls-island-models"
              :button-style="adjustStyleClasses.button"
              :aria-label="t('tamagotchi.stage.controls-island.open-models')"
              @click="openSettings({ route: '/settings/models' })"
            >
              <div :class="['i-solar:people-nearby-bold-duotone text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.open-models') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{ name: 'controls_island_action', action: 'open_airi_card_settings' }"
              data-testid="controls-island-airi-card"
              :button-style="adjustStyleClasses.button"
              :aria-label="t('tamagotchi.stage.controls-island.open-airi-card')"
              @click="openSettings({ route: '/settings/airi-card' })"
            >
              <div :class="['i-solar:card-2-bold-duotone text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.open-airi-card') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="inward">
            <ControlButton
              v-track-button="{
                name: 'controls_island_action',
                action: themeActions[themeMode],
              }"
              data-testid="controls-island-theme"
              :button-style="adjustStyleClasses.button"
              :aria-label="themeLabel"
              @click="switchToNextTheme"
            >
              <Transition name="fade" mode="out-in">
                <div :key="themeMode" :class="[themeIcons[themeMode], 'text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
              </Transition>
            </ControlButton>
            <template #tooltip>
              {{ themeLabel }}
            </template>
          </ControlButtonTooltip>

          <ControlsIslandChatButton :button-style="adjustStyleClasses.button" :icon-class="adjustStyleClasses.icon" />

          <ControlButtonTooltip side="inward">
            <ControlButton
              data-testid="controls-island-microphone"
              :button-style="adjustStyleClasses.button"
              :aria-label="microphoneLabel"
              :aria-pressed="enabled"
              :aria-busy="microphonePending"
              :disabled="microphonePending"
              @click="toggleMicrophone"
            >
              <Transition name="fade" mode="out-in">
                <IndicatorMicVolume v-if="enabled" :class="adjustStyleClasses.icon" />
                <div v-else :class="['i-ph:microphone-slash text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
              </Transition>
            </ControlButton>
            <template #tooltip>
              {{ microphoneLabel }}
            </template>
          </ControlButtonTooltip>

          <ControlsIslandSpeechMute
            :button-style="adjustStyleClasses.button"
            :icon-class="adjustStyleClasses.icon"
          />

          <ControlButtonTooltip side="inward">
            <ControlButton :button-style="adjustStyleClasses.button" :class="['cursor-move', { 'drag-region': isLinux }]" @mousedown="startDraggingWindow?.()">
              <div :class="['i-ph:arrows-out-cardinal text-neutral-800 dark:text-neutral-300', adjustStyleClasses.icon]" />
            </ControlButton>
            <template #tooltip>
              {{ t('tamagotchi.stage.controls-island.drag-to-move-window') }}
            </template>
          </ControlButtonTooltip>

          <HearingConfigDialog
            :show="blockingOverlays.has('hearing')"
            @update:show="value => setOverlay('hearing', value)"
          >
            <span :class="['sr-only']" aria-hidden="true" />
          </HearingConfigDialog>
        </div>
      </div>
    </ScrollableArea>
  </div>
</template>
