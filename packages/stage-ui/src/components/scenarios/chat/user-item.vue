<script setup lang="ts">
import type { ChatHistoryItem, ChatMessage } from '../../../types/chat'

import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import JournalMomentModal from './JournalMomentModal.vue'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useTextJournalStore } from '../../../stores/memory-text-journal'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { MarkdownRenderer } from '../../markdown'
import { ChatActionMenu } from './components/action-menu'
import { getChatHistoryItemCopyText } from './utils'

const props = withDefaults(defineProps<{
  message: Extract<ChatMessage, { role: 'user' }> & { id?: string, createdAt?: number }
  label: string
  variant?: 'desktop' | 'mobile'
}>(), {
  variant: 'desktop',
})

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'delete'): void
}>()

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const showJournalModal = ref(false)

const formattedTime = computed(() => {
  if (!props.message.createdAt)
    return ''
  return new Date(props.message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
})

const content = computed(() => {
  const raw = props.message.content
  if (typeof raw === 'string')
    return raw

  if (Array.isArray(raw)) {
    const textPart = raw.find(part => 'type' in part && part.type === 'text') as { text?: string } | undefined
    return textPart?.text || ''
  }

  return ''
})

const images = computed(() => {
  const raw = props.message.content
  if (!Array.isArray(raw))
    return []

  return raw
    .filter(part => 'type' in part && part.type === 'image_url')
    .map(part => (part as any).image_url?.url as string)
    .filter(Boolean)
})

const containerClasses = computed(() => [
  'flex',
  props.variant === 'mobile' ? 'ml-0 flex-row' : 'ml-12 flex-row-reverse',
])

const boxClasses = computed(() => [
  props.variant === 'mobile' ? 'px-2 py-2 text-sm bg-neutral-100/90 dark:bg-neutral-800/90' : 'px-3 py-3 bg-neutral-100/80 dark:bg-neutral-800/80',
])

const copyText = computed(() => getChatHistoryItemCopyText(props.message as ChatHistoryItem))

function handleCopy() {
  emit('copy')
}

function handleDelete() {
  if (props.message.id)
    chatSession.deleteMessage(props.message.id)
  emit('delete')
}

async function handleRetry() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Truncate messages up to (but not including) this user message!
  const nextMessages = messages.slice(0, index)
  chatSession.setSessionMessages(activeSessionId, nextMessages)

  // Now ingest the message content again!
  await chatOrchestrator.ingest(content.value, {})

  toast.success('Retrying message...')
}

async function handleFork() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Fork at index + 1 to include the user message!
  const newSessionId = await chatSession.forkSession({
    fromSessionId: activeSessionId,
    atIndex: index + 1,
  })

  if (newSessionId) {
    // Trigger inference on the new session!
    // We pass empty string as message, and triggerOnly: true.
    await chatOrchestrator.ingest('', { triggerOnly: true }, newSessionId)

    // Show toast!
    toast.success('Conversation forked and triggered!')
  }
}

function handleDeleteFollowing() {
  if (props.message.id) {
    chatSession.deleteMessagesFromHere(props.message.id)
    toast.success('Messages deleted from here.')
  }
}

function handleJournal() {
  showJournalModal.value = true
}

async function handleJournalSubmit(data: { scope: 'all' | 'turns', turns?: number, instructions: string }) {
  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const allMessages = chatSession.getSessionMessages(activeSessionId)
  const clickedIndex = allMessages.findIndex(m => m.id === props.message.id)
  if (clickedIndex === -1)
    return

  let contextMessages: any[] = []
  if (data.scope === 'all') {
    contextMessages = allMessages.slice(0, clickedIndex + 1)
  }
  else {
    const turnsCount = data.turns || 15
    contextMessages = allMessages.slice(Math.max(0, clickedIndex - turnsCount + 1), clickedIndex + 1)
  }

  const textJournalStore = useTextJournalStore()
  const consciousnessStore = useConsciousnessStore()
  const { activeCard } = storeToRefs(useAiriCardStore())

  if (!activeCard.value)
    return

  // Get model/provider info
  const extension = activeCard.value.extensions.airi
  const modelId = extension.modules?.consciousness?.model || consciousnessStore.activeModel
  const providerId = extension.modules?.consciousness?.provider || consciousnessStore.activeProvider

  toast.promise(textJournalStore.createJournalMoment({
    messages: contextMessages,
    instructions: data.instructions,
    modelId,
    providerId,
  }).catch((err) => {
    console.error('[JournalMoment] Creation failed:', err)
    throw err
  }), {
    loading: 'Generating journal entry...',
    success: 'Journal entry created!',
    error: 'Failed to create journal entry.',
  })

  showJournalModal.value = false
}

async function handleForkAndSwitch() {
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(msg => msg.id === props.message.id)

  if (index === -1)
    return

  // Fork at index + 1 to include the user message!
  const newSessionId = await chatSession.forkSession({
    fromSessionId: activeSessionId,
    atIndex: index + 1,
  })

  if (newSessionId) {
    // Switch to the new session!
    chatSession.activeSessionId = newSessionId

    // Trigger inference on the new session!
    await chatOrchestrator.ingest('', { triggerOnly: true }, newSessionId)

    // Show toast!
    toast.success('Conversation forked and switched!')
  }
}
</script>

<template>
  <div v-if="message.role === 'user'" self-end class="group ph-no-capture max-w-[calc(100%-4rem)]" :class="containerClasses">
    <JournalMomentModal
      :open="showJournalModal"
      :message-id="message.id"
      :messages="chatSession.getSessionMessages(chatSession.activeSessionId || '')"
      @close="showJournalModal = false"
      @submit="handleJournalSubmit"
    />
    <ChatActionMenu
      :copy-text="copyText"
      placement="left"
      @copy="handleCopy"
      @delete="handleDelete"
      @fork="handleFork"
      @retry="handleRetry"
      @delete-following="handleDeleteFollowing"
      @fork-switch="handleForkAndSwitch"
      @journal="handleJournal"
    >
      <template #default="{ setMeasuredElement }">
        <div
          :ref="setMeasuredElement"
          flex="~ col" shadow="sm neutral-200/50 dark:none"
          h="unset <sm:fit"
          relative min-w-20 rounded-xl
          :class="boxClasses"
        >
          <div>
            <span text-sm text="black/60 dark:white/65" font-normal class="inline <sm:hidden">{{ label }}</span>
          </div>

          <div v-if="images.length > 0" class="my-2 flex flex-wrap gap-2">
            <div v-for="(url, idx) in images" :key="idx" class="relative max-w-sm overflow-hidden border border-neutral-200 rounded-lg dark:border-neutral-700">
              <img :src="url" class="max-h-64 object-contain">
            </div>
          </div>

          <MarkdownRenderer
            v-if="content"
            :content="content as string"
            class="break-words"
          />

          <div
            v-if="variant === 'desktop' && formattedTime"
            class="absolute right-full top-1/2 mr-4 opacity-0 transition-opacity -translate-y-1/2 group-hover:opacity-100"
          >
            <span class="whitespace-nowrap text-xs text-neutral-400 font-medium tabular-nums dark:text-neutral-500">
              {{ formattedTime }}
            </span>
          </div>
        </div>
      </template>
    </ChatActionMenu>
  </div>
</template>
