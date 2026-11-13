<script setup lang="ts">
import { VoicevoxFamilySettings } from '@proj-airi/stage-ui/components'

const providerId = 'voicevox'
</script>

<template>
  <VoicevoxFamilySettings :provider-id="providerId" />
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
