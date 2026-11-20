<script setup lang="ts">
import { BasicButton, FieldCheckbox, FieldInput, FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { MAX_EQ_DB } from '../../../composables/audio/audio-effects'
import { MAX_FORMANT_SEMITONES, MAX_TONE_SEMITONES } from '../../../composables/audio/heavy-audio-processor'
import { useSpeechStore } from '../../../stores/modules/speech'

const { t } = useI18n()
const speechStore = useSpeechStore()
const {
  audioConsoleEffectPitch,
  audioConsoleEffectVolume,
  audioConsoleEffectHighpass,
  audioConsoleEffectEqBass,
  audioConsoleEffectEqMid,
  audioConsoleEffectEqTreble,
  audioConsoleEffectDeesser,
  audioConsoleEffectLimiter,
  audioConsoleEffectChorus,
  audioConsoleEffectGrit,
  audioConsoleEffectGate,
  audioConsoleEffectPitchTone,
  audioConsoleEffectFormant,
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

function formatEqDb(val: number): string {
  if (val === 0)
    return '0 dB'
  const db = ((val / 100) * MAX_EQ_DB).toFixed(1)
  return `${val > 0 ? '+' : ''}${db} dB`
}

function formatPan(val: number): string {
  if (val === 0)
    return 'C'
  return val < 0 ? `L${Math.abs(val)}%` : `R${val}%`
}

function formatSemitones(val: number, maxSemitones: number): string {
  if (val === 0)
    return '0'
  const semitones = ((val / 100) * maxSemitones).toFixed(1)
  return `${val > 0 ? '+' : ''}${semitones} st`
}
</script>

<template>
  <div
    :class="[
      'mt-3 flex flex-col gap-3',
      'border border-neutral-200/80 rounded-2xl bg-neutral-100/40 p-3.5',
      'dark:border-neutral-800/80 dark:bg-neutral-900/30',
    ]"
  >
    <div
      :class="[
        'flex items-start justify-between gap-2',
        'border-b border-neutral-200/80 pb-3 dark:border-neutral-800/80',
      ]"
    >
      <div :class="['min-w-0 flex flex-col gap-0.5']">
        <h3 :class="['text-base text-neutral-700 font-bold dark:text-neutral-200']">
          {{ t('settings.pages.modules.speech.sections.section.audio-console.title') }}
        </h3>
        <p :class="['text-xs leading-snug text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.modules.speech.sections.section.audio-console.description') }}
        </p>
      </div>
      <BasicButton
        size="sm"
        :label="t('settings.pages.modules.speech.sections.section.audio-console.reset_defaults')"
        type="button"
        :class="[
          'shrink-0 rounded-lg border border-neutral-300/90 bg-white/90 px-2.5! shadow-sm',
          'text-neutral-700',
          'hover:border-primary-500/45 hover:bg-primary-500/10 hover:text-primary-700',
          'dark:border-neutral-600/90 dark:bg-neutral-800/80 dark:text-neutral-200',
          'dark:hover:border-primary-400/45 dark:hover:bg-primary-400/10 dark:hover:text-primary-300',
        ]"
        @click="speechStore.resetAudioConsole()"
      />
    </div>

    <div :class="['flex flex-col gap-2.5']">
      <section
        :class="[
          'flex flex-col gap-2',
          'rounded-xl border border-neutral-200/70 bg-white/55 p-3',
          'dark:border-neutral-700/55 dark:bg-neutral-950/35',
        ]"
      >
        <div :class="['flex flex-col gap-0.5']">
          <h4 :class="['text-xs text-neutral-600 font-semibold tracking-wide uppercase dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.sections.distortion.title') }}
          </h4>
          <p :class="['text-xs leading-snug text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.sections.distortion.description') }}
          </p>
        </div>
        <div :class="['grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-4 md:gap-y-2']">
          <FieldRange
            v-model="audioConsoleEffectPitch"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="val => `${val > 0 ? '+' : ''}${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectVolume"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.volume.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.volume.description')"
            :min="0"
            :max="200"
            :step="1"
            :format-value="val => `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectAsmr"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.asmr.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.asmr.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectRadio"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.radio.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.radio.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectRobot"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.robot.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.robot.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectReverb"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.reverb.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.reverb.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectChorus"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.chorus.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.chorus.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectGrit"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.grit.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.grit.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectGate"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.gate.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.gate.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectSpatial"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.spatial.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.spatial.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="formatPan"
          />
        </div>
      </section>

      <section
        :class="[
          'flex flex-col gap-2',
          'rounded-xl border border-neutral-200/70 bg-white/55 p-3',
          'dark:border-neutral-700/55 dark:bg-neutral-950/35',
        ]"
      >
        <div :class="['flex flex-col gap-0.5']">
          <h4 :class="['text-xs text-neutral-600 font-semibold tracking-wide uppercase dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.sections.equalizing.title') }}
          </h4>
          <p :class="['text-xs leading-snug text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.sections.equalizing.description') }}
          </p>
        </div>
        <div :class="['grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-4 md:gap-y-2']">
          <FieldRange
            v-model="audioConsoleEffectHighpass"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.highpass.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.highpass.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectEqBass"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_bass.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_bass.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="formatEqDb"
          />
          <FieldRange
            v-model="audioConsoleEffectEqMid"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_mid.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_mid.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="formatEqDb"
          />
          <FieldRange
            v-model="audioConsoleEffectEqTreble"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_treble.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.eq_treble.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="formatEqDb"
          />
          <FieldRange
            v-model="audioConsoleEffectDeesser"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.deesser.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.deesser.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectLimiter"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.limiter.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.limiter.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => val === 0 ? 'Off' : `${val}%`"
          />
          <FieldRange
            v-model="audioConsoleEffectPitchTone"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch_tone.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.pitch_tone.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="val => formatSemitones(val, MAX_TONE_SEMITONES)"
          />
          <FieldRange
            v-model="audioConsoleEffectFormant"
            as="div"
            density="compact"
            :label="t('settings.pages.modules.speech.sections.section.audio-console.fields.formant.label')"
            :description="t('settings.pages.modules.speech.sections.section.audio-console.fields.formant.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="val => formatSemitones(val, MAX_FORMANT_SEMITONES)"
          />
        </div>
      </section>
    </div>

    <section
      :class="[
        'flex flex-col gap-2',
        'rounded-xl border border-neutral-200/70 bg-white/55 p-3',
        'dark:border-neutral-700/55 dark:bg-neutral-950/35',
      ]"
    >
      <div :class="['flex flex-row items-center justify-between gap-2']">
        <div :class="['min-w-0']">
          <h4 :class="['text-xs text-neutral-600 font-semibold tracking-wide uppercase dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.ust.title') }}
          </h4>
          <p :class="['text-xs leading-snug text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.modules.speech.sections.section.audio-console.ust.description') }}
          </p>
        </div>
        <FieldCheckbox v-model="audioConsoleUstEnabled" hide-description />
      </div>

      <div v-if="audioConsoleUstEnabled" :class="['flex flex-col gap-2']">
        <div :class="['grid grid-cols-3 gap-1.5']">
          <label
            v-for="mode in (['mute', 'flatten', 'custom'] as const)"
            :key="mode"
            :class="[
              'flex cursor-pointer border rounded-lg p-2 text-center text-xs capitalize transition-colors',
              audioConsoleUstMode === mode
                ? 'border-primary-500/50 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
            ]"
          >
            <input v-model="audioConsoleUstMode" type="radio" :value="mode" class="sr-only">
            {{ mode }}
          </label>
        </div>
        <FieldInput
          v-if="audioConsoleUstMode === 'custom'"
          v-model="audioConsoleUstCustomStripChars"
          :label="t('settings.pages.modules.speech.sections.section.audio-console.ust.custom_strip')"
          :description="t('settings.pages.modules.speech.sections.section.audio-console.ust.custom_strip_hint')"
          placeholder="*_[]()<>"
        />
        <FieldCheckbox
          v-model="audioConsoleUstStripEmojis"
          :label="t('settings.pages.modules.speech.sections.section.audio-console.ust.strip_emojis')"
        />
        <FieldInput
          v-model="audioConsoleUstTildeReplacement"
          :label="t('settings.pages.modules.speech.sections.section.audio-console.ust.tilde')"
          :description="t('settings.pages.modules.speech.sections.section.audio-console.ust.tilde_hint')"
          placeholder="nyan"
        />
      </div>
    </section>
  </div>
</template>
