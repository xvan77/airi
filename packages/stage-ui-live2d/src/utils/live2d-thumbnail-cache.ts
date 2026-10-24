export interface Live2dThumbnailCache {
  render?: string
  zipIcon?: string
}

export type Live2dThumbnailCacheSlot = 'render' | 'zipIcon'

export function readLive2dThumbnailCache(
  cache: Live2dThumbnailCache | undefined,
  slot: Live2dThumbnailCacheSlot,
): string | undefined {
  if (!cache)
    return undefined
  return cache[slot]
}

export function writeLive2dThumbnailCache(
  cache: Live2dThumbnailCache | undefined,
  slot: Live2dThumbnailCacheSlot,
  dataUrl: string | undefined,
): Live2dThumbnailCache {
  const next: Live2dThumbnailCache = { ...cache }
  if (dataUrl)
    next[slot] = dataUrl
  else
    delete next[slot]
  return next
}
