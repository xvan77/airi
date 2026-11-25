<script setup lang="ts">
import type { Card } from '@proj-airi/ccc'
import type { CardFromTextMemoryImport, CompiledMemoryEntry } from '@proj-airi/stage-ui/services/airi-card-from-text'

import { AIRI_CARD_FROM_TEXT_STORAGE_KEY, applyCompiledMemoryEntries, decodeCardFromTextPendingDraft } from '@proj-airi/stage-ui/services/airi-card-from-text'
import { useMemoryStore } from '@proj-airi/stage-ui/stores/memory'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import CardEditor from './components/CardEditor.vue'
import UnsavedChangesDialog from './components/UnsavedChangesDialog.vue'

import { useAiriCardEditorPage } from './composables/use-airi-card-editor-page'

interface FromTextPendingState {
  card?: Partial<Card>
  memoryEntries: CompiledMemoryEntry[]
  memoryImport?: CardFromTextMemoryImport
}

function readFromTextPendingState(): FromTextPendingState {
  if (typeof sessionStorage === 'undefined')
    return { memoryEntries: [] }
  const raw = sessionStorage.getItem(AIRI_CARD_FROM_TEXT_STORAGE_KEY)
  if (!raw)
    return { memoryEntries: [] }
  sessionStorage.removeItem(AIRI_CARD_FROM_TEXT_STORAGE_KEY)
  const draft = decodeCardFromTextPendingDraft(raw)
  if (!draft)
    return { memoryEntries: [] }
  return {
    card: draft.card,
    memoryEntries: draft.memoryEntries,
    memoryImport: draft.memoryImport,
  }
}

const fromTextPending = readFromTextPendingState()
const initialDraft = fromTextPending.card

const { t } = useI18n()
const memoryStore = useMemoryStore()

const {
  isDirty,
  showUnsavedChangesDialog,
  initialSection,
  handleBack,
  handleSectionChange,
  handleDiscardChanges,
  handleCancelDiscard,
  handleSaved: navigateAfterSave,
} = useAiriCardEditorPage()

async function handleSaved(payload: { cardId: string, activated: boolean }) {
  if (fromTextPending.memoryImport === 'on_save' && fromTextPending.memoryEntries.length > 0) {
    applyCompiledMemoryEntries(memoryStore.write, payload.cardId, fromTextPending.memoryEntries)
    toast.success(t('settings.pages.card.creation.from_text.saved_toast', {
      count: fromTextPending.memoryEntries.length,
    }))
    fromTextPending.memoryEntries = []
    fromTextPending.memoryImport = undefined
  }
  await navigateAfterSave(payload)
}
</script>

<template>
  <CardEditor
    v-model:dirty="isDirty"
    :initial-draft="initialDraft"
    :initial-section="initialSection"
    @back="handleBack"
    @saved="handleSaved"
    @update:section="handleSectionChange"
  />

  <UnsavedChangesDialog
    v-model="showUnsavedChangesDialog"
    @discard="handleDiscardChanges"
    @cancel="handleCancelDiscard"
  />
</template>

<route lang="yaml">
meta:
  layout: plain
  titleKey: settings.pages.card.create_card
  transition: card-expand
  transitionBack: card-collapse
</route>
