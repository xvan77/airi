import type { ChatRequestOptions } from '../../../types'

import openRouterModels from 'model-bank/openrouter'

import { createOpenRouter } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { listModelCatalog } from '../../../model-catalog'
import { ProviderValidationCheck } from '../../../types'
import { createOpenAICompatibleValidators } from '../../../validators'
import { defineProvider } from '../../registry'

export const OPENROUTER_ATTRIBUTION_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://airi.moeru.ai/',
  'X-OpenRouter-Title': 'Project AIRI',
}

const openRouterConfigSchema = z.object({
  apiKey: z
    .string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://openrouter.ai/api/v1/'),
})

type OpenRouterConfig = z.input<typeof openRouterConfigSchema>

export const providerOpenRouterAI = defineProvider<OpenRouterConfig, 'openrouter-ai'>({
  id: 'openrouter-ai',
  order: 0,
  name: 'OpenRouter',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.openrouter.title'),
  description: 'openrouter.ai',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.openrouter.description'),
  tasks: ['chat'],
  capabilities: { chat: { reasoning: { modes: ['enabled', 'disabled'] } } },
  icon: 'i-lobe-icons:openrouter',

  createProviderConfig: ({ t }) => openRouterConfigSchema.extend({
    apiKey: openRouterConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: openRouterConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
    const base = createOpenRouter(apiKey, config.baseUrl)
    return {
      ...base,
      chat(model: string, options?: ChatRequestOptions) {
        const chatConfig = base.chat(model)
        const headers = new Headers(chatConfig.headers)
        // NOTICE:
        // xsai does not inject Authorization into init when chat replaces fetch.
        // Model listing still sends the key through listModels config headers.
        // Root cause: attribution-only fetch wrapper dropped Bearer auth on chat.
        // Source: packages/provider-inference/src/providers/cloud/openrouter-ai/index.ts.
        // Removal condition: upstream passes Authorization in init before custom fetch runs.
        if (apiKey)
          headers.set('Authorization', `Bearer ${apiKey}`)
        for (const [k, v] of Object.entries(OPENROUTER_ATTRIBUTION_HEADERS))
          headers.set(k, v)

        const request = {
          ...chatConfig,
          apiKey,
          headers: Object.fromEntries(headers.entries()),
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            const requestHeaders = new Headers(init?.headers)
            if (apiKey)
              requestHeaders.set('Authorization', `Bearer ${apiKey}`)
            for (const [k, v] of Object.entries(OPENROUTER_ATTRIBUTION_HEADERS))
              requestHeaders.set(k, v)
            return globalThis.fetch(input, { ...init, headers: requestHeaders })
          },
        }

        if (!options?.reasoning)
          return request

        return { ...request, reasoning: { effort: options.reasoning === 'enabled' ? 'medium' : 'none' } }
      },
    }
  },

  extraMethods: {
    listModelCatalog: (config) => {
      const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
      return listModelCatalog(
        { apiKey, baseURL: config.baseUrl ?? 'https://openrouter.ai/api/v1/', headers: { ...OPENROUTER_ATTRIBUTION_HEADERS, ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) } },
        { models: openRouterModels.filter(model => model.type === 'chat'), providerId: 'openrouter-ai', baseURL: 'https://openrouter.ai/api/v1/' },
      )
    },
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: [ProviderValidationCheck.Connectivity, ProviderValidationCheck.ModelList, ProviderValidationCheck.ChatCompletions],
      additionalHeaders: OPENROUTER_ATTRIBUTION_HEADERS,
    }),
  },
})
