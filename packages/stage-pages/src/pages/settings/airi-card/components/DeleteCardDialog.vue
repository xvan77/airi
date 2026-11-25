<script setup lang="ts">
import { useMemoryStore } from '@proj-airi/stage-ui/stores/memory'
import { Button, FieldCheckbox } from '@proj-airi/ui'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean
  cardId?: string
  cardName?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', options: { removeLongTermMemories: boolean }): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const memoryStore = useMemoryStore()
const removeLongTermMemories = shallowRef(true)

const memoryCount = computed(() => props.cardId ? memoryStore.countForPersona(props.cardId) : 0)

watch(() => props.modelValue, (open) => {
  if (open)
    removeLongTermMemories.value = memoryCount.value > 0
})

function handleCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('update:modelValue', false)
  emit('confirm', {
    removeLongTermMemories: memoryCount.value > 0 && removeLongTermMemories.value,
  })
}
</script>

<template>
  <AlertDialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-100 bg-black/50 data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 z-100 max-w-md w-full border border-neutral-200 rounded-xl bg-white p-6 shadow-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800"
        @interact-outside.prevent
      >
        <AlertDialogTitle class="mb-4 text-xl font-normal">
          {{ t('settings.pages.card.delete_card') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="mb-4">
          {{ t('settings.pages.card.delete_confirmation') }} <b>"{{ cardName || '' }}"</b>
        </AlertDialogDescription>

        <FieldCheckbox
          v-if="memoryCount > 0"
          v-model="removeLongTermMemories"
          :class="['mb-6']"
          :label="t('settings.pages.card.delete_remove_long_term_memories')"
          :description="t('settings.pages.card.delete_remove_long_term_memories_description', { count: memoryCount })"
        />

        <div class="flex flex-row justify-end gap-3">
          <AlertDialogCancel as-child>
            <Button

              :label="t('settings.pages.card.cancel')"
              @click="handleCancel"
            />
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button

              :label="t('settings.pages.card.delete')"
              color="red"
              variant="primary" @click="handleConfirm"
            />
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
