import type { CloudModelCatalogCacheDocument } from '@proj-airi/stage-shared/cloud-model-catalog-cache'

import localforage from 'localforage'

import {
  readCatalogCacheText,
  writeCatalogCacheText,
} from '@proj-airi/stage-shared/catalog-cache-persistence'
import {
  cloudModelCatalogStorageFileName,
  parseCloudModelCatalogCacheDocument,
  serializeCloudModelCatalogCacheDocument,
} from '@proj-airi/stage-shared/cloud-model-catalog-cache'

const browserStore = localforage.createInstance({
  name: 'proj-airi',
  storeName: 'cloud-model-catalog',
})

function browserStorageKey(fileName: string): string {
  return fileName.replace(/\.json$/, '')
}

export async function readPersistedCloudModelCatalog(
  providerId: string,
  configurationFingerprint: string,
): Promise<CloudModelCatalogCacheDocument | null> {
  const fileName = cloudModelCatalogStorageFileName(providerId, configurationFingerprint)

  const electronRaw = await readCatalogCacheText(fileName)
  if (electronRaw) {
    const parsed = parseCloudModelCatalogCacheDocument(electronRaw)
    if (parsed?.configurationFingerprint === configurationFingerprint)
      return parsed
  }

  const browserRaw = await browserStore.getItem<string>(browserStorageKey(fileName))
  if (typeof browserRaw !== 'string')
    return null

  const parsed = parseCloudModelCatalogCacheDocument(browserRaw)
  if (!parsed || parsed.configurationFingerprint !== configurationFingerprint)
    return null

  return parsed
}

export async function writePersistedCloudModelCatalog(
  document: CloudModelCatalogCacheDocument,
): Promise<void> {
  const fileName = cloudModelCatalogStorageFileName(document.providerId, document.configurationFingerprint)
  const contents = serializeCloudModelCatalogCacheDocument(document)

  const wroteElectron = await writeCatalogCacheText(fileName, contents)
  if (!wroteElectron)
    await browserStore.setItem(browserStorageKey(fileName), contents)
}
