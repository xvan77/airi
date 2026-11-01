<script setup lang="ts">
import { isElectronWindow } from '@proj-airi/stage-shared'
import { ChatSessionsDrawer } from '@proj-airi/stage-ui/components'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import { shallowRef, useTemplateRef } from 'vue'

import ChatOpeningOverlay from '../components/chat-window/chat-opening-overlay.vue'
import ChatSpeechMuteButton from '../components/chat-window/chat-speech-mute-button.vue'
import ChatWindowStyleMenu from '../components/chat-window/chat-window-style-menu.vue'
import InteractiveArea from '../components/InteractiveArea.vue'
import WindowTitleBar from '../components/Window/TitleBar.vue'
import ChatPageShell from './chat-page-shell.vue'

import { useChatDraftHandover } from '../composables/use-chat-draft-handover'
import { useChatOpeningOverlay } from '../composables/use-chat-opening-overlay'
import { useLocalLlmStartupChatNotice } from '../composables/use-local-llm-startup-chat-notice'

const { activeCard } = storeToRefs(useAiriCardStore())
const hasNativeControls = isElectronWindow(window) && window.platform === 'darwin'
const sessionsDrawerOpen = shallowRef(false)
const interactiveArea = useTemplateRef<InstanceType<typeof InteractiveArea>>('interactive-area')

useChatDraftHandover(interactiveArea)
const { showChatOpeningOverlay } = useChatOpeningOverlay()
useLocalLlmStartupChatNotice()
</script>

<template>
  <ChatPageShell class="relative flex flex-col">
    <WindowTitleBar
      :title="activeCard?.name || 'AIRI'"
      :class="{ 'pl-20!': hasNativeControls }"
      icon="i-solar:chat-line-bold"
      @title-click="sessionsDrawerOpen = true"
    >
      <template #actions>
        <ChatSpeechMuteButton />
        <ChatWindowStyleMenu />
      </template>
    </WindowTitleBar>
    <div class="relative h-full min-h-0 flex-1">
      <InteractiveArea
        ref="interactive-area"
        class="interaction-area block"
        h-full w-full transition="opacity duration-250"
      />
      <ChatOpeningOverlay :show="showChatOpeningOverlay" />
    </div>
    <ChatSessionsDrawer v-model="sessionsDrawerOpen" />
  </ChatPageShell>
</template>

<route lang="yaml">
meta:
  layout: stage
</route>
