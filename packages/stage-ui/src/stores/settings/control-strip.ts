import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export interface ControlStripButton {
  id: string
  enabled: boolean
  label: string
  icon: string
}

const DEFAULT_BUTTONS: ControlStripButton[] = [
  { id: 'chat', enabled: true, label: 'Chat Toggle', icon: 'i-solar:chat-line-linear' },
  { id: 'stage', enabled: true, label: 'Actor Stage', icon: 'i-solar:clapperboard-play-bold-duotone' },
  { id: 'mic', enabled: true, label: 'Microphone Toggle', icon: 'i-solar:muted-linear' },
  { id: 'settings', enabled: true, label: 'Settings', icon: 'i-solar:settings-linear' },
  { id: 'caption', enabled: true, label: 'Captions', icon: 'i-solar:letter-opened-linear' },
  { id: 'layout', enabled: true, label: 'Stage Layout & Snapping', icon: 'i-solar:widget-linear' },
  { id: 'gemini-session', enabled: false, label: 'Toggle Speech Session', icon: 'i-solar:star-linear' },
  { id: 'gemini-witness', enabled: false, label: 'Witness Vision Mode', icon: 'i-solar:camera-linear' },
  { id: 'gemini-frequency', enabled: false, label: 'Proactive Interval', icon: 'i-solar:clock-circle-linear' },
  { id: 'gemini-tts', enabled: false, label: 'TTS Output Toggle', icon: 'i-solar:volume-loud-linear' },
  { id: 'gemini-voice', enabled: false, label: 'Cycle Speakers', icon: 'i-solar:user-speak-linear' },
  { id: 'gemini-schedule', enabled: false, label: 'Respect Schedule', icon: 'i-solar:calendar-linear' },
  { id: 'gemini-grounding', enabled: false, label: 'Google Search Grounding', icon: 'i-solar:global-linear' },
]

export const useSettingsControlStrip = defineStore('settings-control-strip', () => {
  const orientation = useLocalStorageManualReset<'vertical' | 'horizontal'>('settings/control-strip/orientation', 'vertical')
  const interactionMode = useLocalStorageManualReset<'tactile' | 'positioning' | 'orbit'>('settings/control-strip/interaction-mode', 'tactile')
  const isAdvancedPositioningOpen = useLocalStorageManualReset<boolean>('settings/control-strip/advanced-positioning-open', false)
  const stageEnabled = useLocalStorageManualReset<boolean>('settings/stage-enabled', true)
  const buttons = useLocalStorageManualReset<ControlStripButton[]>('settings/control-strip/buttons', DEFAULT_BUTTONS)

  // Synchronize icons and labels with DEFAULT_BUTTONS to overwrite stale cached attributes (like the old paw print)
  if (Array.isArray(buttons.value)) {
    let changed = false
    const updated = buttons.value.map((btn) => {
      const def = DEFAULT_BUTTONS.find(d => d.id === btn.id)
      if (def) {
        if (def.icon !== btn.icon || def.label !== btn.label) {
          changed = true
          return { ...btn, icon: def.icon, label: def.label }
        }
      }
      return btn
    })
    if (changed) {
      buttons.value = updated
    }
  }

  function toggleOrientation() {
    orientation.value = orientation.value === 'vertical' ? 'horizontal' : 'vertical'
  }

  function cycleInteractionMode() {
    if (interactionMode.value === 'tactile') {
      interactionMode.value = 'positioning'
    }
    else if (interactionMode.value === 'positioning') {
      interactionMode.value = 'orbit'
    }
    else {
      interactionMode.value = 'tactile'
    }
  }

  function resetState() {
    orientation.reset()
    interactionMode.reset()
    isAdvancedPositioningOpen.reset()
    stageEnabled.reset()
    buttons.reset()
  }

  return {
    orientation,
    interactionMode,
    isAdvancedPositioningOpen,
    stageEnabled,
    buttons,
    toggleOrientation,
    cycleInteractionMode,
    resetState,
  }
})
