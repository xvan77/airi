import type { Message } from '@xsai/shared-chat'

import { normalizeLlamaServerChatMessages } from '@proj-airi/core-agent'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { defineProvider } from '../registry'

const LOCAL_LLM_BASE_URL = 'http://localhost:39000/v1'

function wrapFetchForLlamaServer(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!init?.body || typeof init.body !== 'string')
      return fetchImpl(input, init)

    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    if (!url.includes('/chat/completions'))
      return fetchImpl(input, init)

    try {
      const body = JSON.parse(init.body) as { messages?: Message[] }
      if (Array.isArray(body.messages)) {
        const nextInit = {
          ...init,
          body: JSON.stringify({
            ...body,
            messages: normalizeLlamaServerChatMessages(body.messages),
          }),
        }
        return fetchImpl(input, nextInit)
      }
    }
    catch {
      // Keep the original request when the body is not JSON.
    }

    return fetchImpl(input, init)
  }
}

const localLlmConfigSchema = z.object({
  modelId: z
    .string()
    .optional()
    .default(''),
})

type LocalLlmConfig = z.input<typeof localLlmConfigSchema>

export const providerLocalLlm = defineProvider<LocalLlmConfig, 'local-llm'>({
  id: 'local-llm',
  order: 1,
  name: 'App (Local LLM)',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.local-llm.title'),
  description: 'Offline GGUF models bundled with the desktop app.',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.local-llm.description'),
  tasks: ['chat'],
  icon: 'i-lucide:cpu',
  isAvailableBy: isStageTamagotchi,

  createProviderConfig: ({ t }) => localLlmConfigSchema.extend({
    modelId: localLlmConfigSchema.shape.modelId.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.placeholder'),
      type: 'select',
      options: [],
    }),
  }),
  createProvider() {
    const provider = createOpenAI('not-needed', LOCAL_LLM_BASE_URL)
    return {
      ...provider,
      chat: (model: string) => {
        const config = provider.chat(model)
        const upstream = (config.fetch ?? globalThis.fetch.bind(globalThis)) as typeof globalThis.fetch
        return {
          ...config,
          fetch: wrapFetchForLlamaServer(upstream) as typeof config.fetch,
        }
      },
    }
  },

  validationRequiredWhen: () => false,
  validators: {
    validateProvider: [
      () => ({
        id: 'local-llm:check-connectivity',
        name: 'Local server connectivity',
        validator: async () => {
          try {
            const res = await fetch(`${LOCAL_LLM_BASE_URL}/models`)
            if (res.ok)
              return { errors: [], reason: '', reasonKey: '', valid: true }
            throw new Error(`Server returned status ${res.status}`)
          }
          catch (error) {
            return {
              errors: [{ error }],
              reason: 'Cannot reach the local LLM server on port 39000. Open App (Local LLM) in Providers, download a model, and start the server.',
              reasonKey: '',
              valid: false,
            }
          }
        },
      }),
    ],
  },
})
