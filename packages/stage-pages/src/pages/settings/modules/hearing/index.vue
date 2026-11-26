<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  void router.replace({
    path: '/settings/modules/hearing/transcriber',
    query: route.query,
    hash: route.hash,
  })
})
</script>

<template>
  <div />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.hearing.title
  subtitleKey: settings.title
  icon: i-solar:microphone-3-bold-duotone
  stageTransition:
    name: slide
</route>
