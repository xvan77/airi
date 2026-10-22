<script setup lang="ts">
import { FieldCheckbox, FieldInput, FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useSpeechStore } from '../../../stores/modules/speech'

const { t } = useI18n()
const speechStore = useSpeechStore()
const {
  audioConsoleEffectPitch,
  audioConsoleEffectRate,
  audioConsoleEffectAsmr,
  audioConsoleEffectRadio,
  audioConsoleEffectRobot,
  audioConsoleEffectReverb,
  audioConsoleEffectSpatial,
  audioConsoleUstEnabled,
  audioConsoleUstMode,
  audioConsoleUstCustomStripChars,
  audioConsoleUstStripEmojis,
  audioConsoleUstTildeReplacement,
} = storeToRefs(speechStore)
</script>

<template>
  <div class="mt-4 flex flex-col gap-6 border border-neutral-200/80 rounded-2xl bg-neutral-100/40 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/30">
    <div>
      <h3 class="text-base text-neutral-600 font-bold dark:text-neutral-300">
        {{ t('settings.pages.modules.speech.sections.section.audio-console.title') }}
      </h3>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('settings.pages.modules.speech.sections.section.audio-console.description') }}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FieldRange
        v-model="audioConsoleEffectPitch"
        :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch.label')"
        :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch.description')"
        :min="-100"
        :max="100"
        :step="1"
        :format-value="val => `${val}%`"
      />
      <FieldRange
        v-model="audioConsoleEffectRate"
        :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.rate.label')"
        :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.rate.description')"
        :min="0.5"
        :max="2.5"
        :step="0.05"
        :format-value="val => `${val}x`"
      />
      <FieldRange
        v-model="audioConsoleEffectAsmr"
        label="ASMR softness"
        description="Lowpass and compression for a softer voice"
        :min="0"
        :max="100"
        :step="1"
        :format-value="val => `${val}%`"
      />
      <FieldRange
        v-model="audioConsoleEffectRadio"
        label="Radio filter"
        description="Telephone-style bandpass"
        :min="0"
        :max="100"
        :step="1"
        :format-value="val => `${val}%`"
      />
      <FieldRange
        v-model="audioConsoleEffectRobot"
        label="Robotic"
        description="Metallic comb delay"
        :min="0"
        :max="100"
        :step="1"
        :format-value="val => `${val}%`"
      />
      <FieldRange
        v-model="audioConsoleEffectReverb"
        label="Space echo"
        description="Short delay feedback"
        :min="0"
        :max="100"
        :step="1"
        :format-value="val => `${val}%`"
      />
      <FieldRange
        v-model="audioConsoleEffectSpatial"
        label="Stereo pan"
        description="Move the voice left or right"
        :min="-100"
        :max="100"
        :step="1"
        :format-value="val => val === 0 ? 'Center' : val < 0 ? `Left ${Math.abs(val)}%` : `Right ${val}%`"
      />
    </div>

    <div class="flex flex-col gap-4 border-t border-neutral-200/80 pt-4 dark:border-neutral-800/80">
      <div flex="~ row items-center justify-between">
        <div>
          <h4 class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.ust.title') }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.ust.description') }}
          </p>
        </div>
        <FieldCheckbox v-model="audioConsoleUstEnabled" hide-description />
      </div>

      <div v-if="audioConsoleUstEnabled" class="flex flex-col gap-4">
        <div class="grid grid-cols-3 gap-2">
          <label
            v-for="mode in (['mute', 'flatten', 'custom'] as const)"
            :key="mode"
            class="flex cursor-pointer border rounded-xl p-2.5 text-center text-xs capitalize transition-colors"
            :class="audioConsoleUstMode === mode
              ? 'border-primary-500/50 bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'"
          >
            <input v-model="audioConsoleUstMode" type="radio" :value="mode" class="sr-only">
            {{ mode }}
          </label>
        </div>
        <FieldInput
          v-if="audioConsoleUstMode === 'custom'"
          v-model="audioConsoleUstCustomStripChars"
          label="Strip characters"
          description="Characters to remove from speech text"
          placeholder="*_[]()<>"
        />
        <FieldCheckbox
          v-model="audioConsoleUstStripEmojis"
          label="Strip emojis"
          description="Remove emoji characters before speech"
        />
        <FieldInput
          v-model="audioConsoleUstTildeReplacement"
          label="Tilde replacement"
          description="Spoken word for ~ (empty strips tildes)"
          placeholder="nyan"
        />
      </div>
    </div>
  </div>
</template>
