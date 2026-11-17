import { defineInvoke } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { installLocalLlmServerReadyProbe } from '@proj-airi/stage-shared'

import { electronLocalLlmWaitUntilReady } from '../../shared/eventa/local-llm'

installLocalLlmServerReadyProbe(async (options) => {
  const context = getElectronEventaContext()
  if (!context)
    return false
  const waitUntilReady = defineInvoke(context, electronLocalLlmWaitUntilReady)
  return waitUntilReady({
    timeoutMs: options.timeoutMs,
    pollMs: options.pollMs,
  })
})
