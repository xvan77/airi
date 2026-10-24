export type Live2dThumbnailSource = 'render-fallback-icon' | 'icon-fallback-render'

export const LIVE2D_THUMBNAIL_SOURCE_VALUES: readonly Live2dThumbnailSource[] = [
  'render-fallback-icon',
  'icon-fallback-render',
]

export const LIVE2D_THUMBNAIL_SOURCE_STORAGE_KEY = 'airi:live2d-thumbnail-source'

const DEFAULT_SOURCE: Live2dThumbnailSource = 'render-fallback-icon'

function normalizeStoredSource(stored: string | null): Live2dThumbnailSource {
  if (stored === 'icon-fallback-render' || stored === 'zip-icon')
    return 'icon-fallback-render'
  if (stored === 'render-fallback-icon' || stored === 'render')
    return 'render-fallback-icon'
  return DEFAULT_SOURCE
}

export function getLive2dThumbnailSource(): Live2dThumbnailSource {
  if (typeof localStorage === 'undefined')
    return DEFAULT_SOURCE
  return normalizeStoredSource(localStorage.getItem(LIVE2D_THUMBNAIL_SOURCE_STORAGE_KEY))
}
