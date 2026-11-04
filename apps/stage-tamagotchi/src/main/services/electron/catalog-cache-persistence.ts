import type { InvocableEventContext } from '@moeru/eventa'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import { catalogCacheReadText, catalogCacheWriteText } from '@proj-airi/stage-shared/catalog-cache-persistence'
import { app } from 'electron'

const CACHE_DIR_NAME = 'cloud-model-catalog'

function resolveCachePath(fileName: string): string | null {
  if (!/^[a-z0-9-]+\.json$/i.test(fileName))
    return null

  return join(app.getPath('userData'), CACHE_DIR_NAME, fileName)
}

export function setupCatalogCachePersistence(context: InvocableEventContext<any, any>) {
  defineInvokeHandler(context, catalogCacheReadText, async ({ fileName }) => {
    const path = resolveCachePath(fileName)
    if (!path)
      return null

    try {
      return await readFile(path, 'utf8')
    }
    catch {
      return null
    }
  })

  defineInvokeHandler(context, catalogCacheWriteText, async ({ fileName, contents }) => {
    const path = resolveCachePath(fileName)
    if (!path)
      return false

    try {
      await mkdir(join(app.getPath('userData'), CACHE_DIR_NAME), { recursive: true })
      await writeFile(path, contents, 'utf8')
      return true
    }
    catch {
      return false
    }
  })
}
