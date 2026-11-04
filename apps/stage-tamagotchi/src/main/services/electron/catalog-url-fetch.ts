import type { InvocableEventContext } from '@moeru/eventa'

import { defineInvokeHandler } from '@moeru/eventa'
import { catalogFetchUrlText } from '@proj-airi/stage-shared/catalog-url-fetch'
import { net } from 'electron'

export function setupCatalogUrlFetch(context: InvocableEventContext<any, any>) {
  defineInvokeHandler(context, catalogFetchUrlText, async ({ url }) => {
    try {
      const response = await net.fetch(url)
      if (!response.ok)
        return null
      return await response.text()
    }
    catch {
      return null
    }
  })
}
