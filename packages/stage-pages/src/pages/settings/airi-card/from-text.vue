<script setup lang="ts">
import type { CardFromTextMemoryImport, CompiledCharacterCard } from '@proj-airi/stage-ui/services/airi-card-from-text'

import { Alert } from '@proj-airi/stage-ui/components'
import { useAiriCardFromText } from '@proj-airi/stage-ui/composables/use-airi-card-from-text'
import {
  AIRI_CARD_FROM_TEXT_MAX_INPUT,
  AIRI_CARD_FROM_TEXT_STORAGE_KEY,
  encodeCardFromTextPendingDraft,
  memoryEntriesFromCompiledCard,
} from '@proj-airi/stage-ui/services/airi-card-from-text'
import { memoryEntryGroceryLabel } from '@proj-airi/stage-ui/services/airi-card-from-text-memory'
import { readCharacterMaterialFile } from '@proj-airi/stage-ui/services/character-material-file'
import { Button, FieldInput, GhostButton } from '@proj-airi/ui'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const router = useRouter()
const {
  compiling,
  error,
  configured,
  activeProvider,
  activeModel,
  compileFromText,
  toCardDraft,
} = useAiriCardFromText()

const sourceText = shallowRef('')
const compiled = shallowRef<CompiledCharacterCard | undefined>()
const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')

const formattedMemoryEntries = computed(() => {
  if (!compiled.value)
    return []
  return memoryEntriesFromCompiledCard(compiled.value)
})

const characterCount = computed(() => sourceText.value.length)
const canGenerate = computed(() => {
  return sourceText.value.trim().length >= 50
    && sourceText.value.length <= AIRI_CARD_FROM_TEXT_MAX_INPUT
    && configured.value
    && !compiling.value
})

const errorMessage = computed(() => {
  if (!error.value)
    return ''
  if (error.value === 'too_short')
    return t('settings.pages.card.creation.from_text.errors.too_short')
  if (error.value === 'too_long')
    return t('settings.pages.card.creation.from_text.errors.too_long')
  if (error.value === 'no_consciousness')
    return t('settings.pages.card.creation.from_text.errors.no_consciousness')
  return t('settings.pages.card.creation.from_text.errors.compile_failed', { detail: error.value })
})

async function handleGenerate() {
  compiled.value = undefined
  const result = await compileFromText(sourceText.value)
  if (result)
    compiled.value = result
}

function handleBack() {
  void router.replace('/settings/airi-card')
}

function handleOpenConsciousness() {
  void router.push('/settings/modules/consciousness')
}

function continueToEditor(memoryImport: CardFromTextMemoryImport) {
  if (!compiled.value)
    return
  const payload = encodeCardFromTextPendingDraft({
    card: toCardDraft(compiled.value),
    memoryEntries: formattedMemoryEntries.value,
    memoryImport,
  })
  sessionStorage.setItem(AIRI_CARD_FROM_TEXT_STORAGE_KEY, payload)
  void router.push('/settings/airi-card/new')
}

function handleContinueToEditor() {
  if (!compiled.value)
    return
  continueToEditor('skip')
}

async function handleUploadTxt(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  try {
    sourceText.value = await readCharacterMaterialFile(file)
  }
  catch (error) {
    const message = error instanceof Error && error.message === 'legacy_doc_unsupported'
      ? t('settings.pages.card.creation.from_text.errors.legacy_doc')
      : t('settings.pages.card.creation.from_text.errors.read_file')
    toast.error(message)
  }
}
</script>

<template>
  <div :class="['mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8']">
    <div :class="['flex flex-wrap items-center gap-3']">
      <GhostButton icon="i-solar:arrow-left-line-duotone" :label="t('settings.pages.card.back')" @click="handleBack" />
      <h1 :class="['text-lg font-semibold text-neutral-800 dark:text-neutral-100']">
        {{ t('settings.pages.card.creation.from_text.title') }}
      </h1>
    </div>

    <p :class="['text-sm text-neutral-600 dark:text-neutral-400']">
      {{ t('settings.pages.card.creation.from_text.description') }}
    </p>

    <Alert v-if="!configured" type="warning">
      <template #title>
        {{ t('settings.pages.card.creation.from_text.errors.no_consciousness') }}
      </template>
      <template #content>
        <Button
          variant="secondary"
          :label="t('settings.pages.card.creation.from_text.open_consciousness')"
          @click="handleOpenConsciousness"
        />
      </template>
    </Alert>

    <div v-else :class="['text-xs text-neutral-500 dark:text-neutral-400']">
      {{ t('settings.pages.card.creation.from_text.using_model', { provider: activeProvider, model: activeModel }) }}
    </div>

    <FieldInput
      v-model="sourceText"
      :label="t('settings.pages.card.creation.from_text.source_label')"
      :description="t('settings.pages.card.creation.from_text.source_description')"
      :single-line="false"
      input-class="min-h-48 md:min-h-64 font-mono text-sm"
    />

    <div :class="['flex flex-wrap items-center justify-between gap-3']">
      <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.card.creation.from_text.character_count', { count: characterCount, max: AIRI_CARD_FROM_TEXT_MAX_INPUT }) }}
      </span>
      <div :class="['flex flex-wrap gap-2']">
        <Button
          variant="secondary"
          icon="i-solar:upload-square-line-duotone"
          :label="t('settings.pages.card.creation.from_text.upload_txt')"
          @click="uploadInput?.click()"
        />
        <Button
          variant="primary"
          color="primary"
          icon="i-solar:magic-stick-3-line-duotone"
          :label="t('settings.pages.card.creation.from_text.generate')"
          :disabled="!canGenerate"
          :loading="compiling"
          @click="handleGenerate"
        />
      </div>
      <input
        ref="uploadInput"
        type="file"
        accept=".txt,.md,.doc,.docx,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        :class="['hidden']"
        @change="handleUploadTxt"
      >
    </div>

    <Alert v-if="errorMessage" type="error">
      <template #title>
        {{ errorMessage }}
      </template>
    </Alert>

    <div v-if="compiled" :class="['flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700']">
      <h2 :class="['text-sm font-semibold']">
        {{ t('settings.pages.card.creation.from_text.preview_title') }}
      </h2>
      <p :class="['text-sm']">
        <span :class="['text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.card.creation.name') }}:</span>
        {{ compiled.name }}
      </p>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.card.creation.from_text.preview_card_hint') }}
      </p>
      <pre :class="['max-h-64 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs whitespace-pre-wrap dark:bg-neutral-900']">{{ compiled.systemPrompt }}</pre>
      <div
        v-if="formattedMemoryEntries.length"
        :class="[
          'flex flex-col gap-2.5 border-t border-neutral-200 pt-4 dark:border-neutral-700',
        ]"
      >
        <p :class="['text-sm leading-relaxed text-neutral-700 dark:text-neutral-200']">
          {{ t('settings.pages.card.creation.from_text.split_not_on_card') }}
        </p>
        <p :class="['text-sm leading-relaxed text-neutral-700 dark:text-neutral-200']">
          {{ t('settings.pages.card.creation.from_text.split_to_memory') }}
        </p>
        <p :class="['text-sm font-semibold text-neutral-800 dark:text-neutral-100']">
          {{ t('settings.pages.card.creation.from_text.consent_question') }}
        </p>
        <p :class="['text-sm text-neutral-700 dark:text-neutral-200']">
          {{ t('settings.pages.card.creation.from_text.memory_grocery_heading') }}
        </p>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.card.creation.from_text.memory_grocery_note') }}
        </p>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.card.creation.from_text.memory_save_only') }}
        </p>
        <ul :class="['list-disc ps-5 text-sm text-neutral-800 dark:text-neutral-100']">
          <li v-for="entry in formattedMemoryEntries" :key="entry.name">
            {{ memoryEntryGroceryLabel(entry) }}
          </li>
        </ul>
        <div :class="['flex flex-wrap gap-2 pt-1']">
          <Button
            variant="primary"
            color="primary"
            :label="t('settings.pages.card.creation.from_text.send_to_long_memory')"
            @click="continueToEditor('on_save')"
          />
          <Button
            variant="secondary"
            :label="t('settings.pages.card.creation.from_text.add_manually_later')"
            @click="continueToEditor('skip')"
          />
        </div>
      </div>
      <Button
        v-else
        variant="primary"
        color="primary"
        :label="t('settings.pages.card.creation.from_text.continue_editor')"
        @click="handleContinueToEditor"
      />
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: plain
  titleKey: settings.pages.card.creation.from_text.title
  transition: card-expand
  transitionBack: card-collapse
</route>
