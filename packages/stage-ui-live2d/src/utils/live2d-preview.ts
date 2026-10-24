import type { Live2dThumbnailCache } from './live2d-thumbnail-cache'
import type { Live2dThumbnailSource } from './live2d-thumbnail-source'

import cropImg from '@lemonneko/crop-empty-pixels'

import { Application } from '@pixi/app'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { Live2DFactory, Live2DModel } from 'pixi-live2d-display/cubism4'

import { readLive2dThumbnailCache, writeLive2dThumbnailCache } from './live2d-thumbnail-cache'
import { getLive2dThumbnailSource } from './live2d-thumbnail-source'

export type { Live2dThumbnailCache } from './live2d-thumbnail-cache'
export { readLive2dThumbnailCache, writeLive2dThumbnailCache } from './live2d-thumbnail-cache'
export type { Live2dThumbnailSource } from './live2d-thumbnail-source'
export {
  getLive2dThumbnailSource,
  LIVE2D_THUMBNAIL_SOURCE_STORAGE_KEY,
  LIVE2D_THUMBNAIL_SOURCE_VALUES,
} from './live2d-thumbnail-source'

/** Sent-patch A2: use `icon.png` / `icon.jpg` from the zip when the user opts in. */
export async function tryLoadLive2dZipIconPreview(file: File): Promise<string | undefined> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const iconFileName = Object.keys(zip.files).find((name) => {
      const lower = name.toLowerCase()
      return lower.endsWith('icon.png') || lower.endsWith('icon.jpg')
    })
    if (!iconFileName)
      return undefined

    const fileData = await zip.files[iconFileName].async('blob')
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(fileData)
    })
  }
  catch (error) {
    console.warn('[Live2D Preview] Zip icon lookup failed', error)
    return undefined
  }
}

/**
 * Render a Live2D zip/file to an offscreen canvas and return a padded preview data URL.
 */
export async function renderLive2dZipPreview(file: File) {
  Live2DModel.registerTicker(Ticker)
  extensions.add(TickerPlugin)

  const previewWidth = 1440
  const previewHeight = 2560
  const previewResolution = 2

  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = previewWidth * previewResolution
  offscreenCanvas.height = previewHeight * previewResolution
  offscreenCanvas.style.position = 'absolute'
  offscreenCanvas.style.top = '0'
  offscreenCanvas.style.left = '0'
  offscreenCanvas.style.objectFit = 'cover'
  offscreenCanvas.style.display = 'block'
  offscreenCanvas.style.zIndex = '10000000000'
  offscreenCanvas.style.opacity = '0'
  document.body.appendChild(offscreenCanvas)

  const app = new Application({
    view: offscreenCanvas,
    width: offscreenCanvas.width,
    height: offscreenCanvas.height,
    // Ensure the drawing buffer persists so toDataURL() can read pixels
    preserveDrawingBuffer: true,
    backgroundAlpha: 0,
    autoDensity: false,
    resolution: 1,
    autoStart: false,
  })
  app.stage.scale.set(previewResolution)
  app.ticker.stop()

  const modelInstance = new Live2DModel()
  const objUrl = URL.createObjectURL(file)
  const res = await fetch(objUrl)
  const blob = await res.blob()

  const cleanup = () => {
    // A loaded model is on the global `Ticker.shared`, and its textures stay in
    // the global texture cache, where they keep this app's WebGL context alive.
    // The model has no internal model when the load failed before it registered.
    if (modelInstance.internalModel)
      modelInstance.destroy({ texture: true, baseTexture: true })
    app.destroy()
    if (offscreenCanvas.isConnected)
      document.body.removeChild(offscreenCanvas)
    URL.revokeObjectURL(objUrl)
  }

  try {
    await Live2DFactory.setupLive2DModel(modelInstance, [new File([blob], file.name)], { autoInteract: false })
    app.stage.addChild(modelInstance)

    modelInstance.x = 275
    modelInstance.y = 450
    modelInstance.width = previewWidth
    modelInstance.height = previewHeight
    modelInstance.scale.set(0.1, 0.1)
    modelInstance.anchor.set(0.5, 0.5)

    await new Promise(resolve => setTimeout(resolve, 500))
    app.renderer.render(app.stage)

    const croppedCanvas = cropImg(offscreenCanvas)

    // padding to 12:16
    const paddingCanvas = document.createElement('canvas')
    paddingCanvas.width = croppedCanvas.width > croppedCanvas.height / 16 * 12 ? croppedCanvas.width : croppedCanvas.height / 16 * 12
    paddingCanvas.height = paddingCanvas.width / 12 * 16
    const paddingCanvasCtx = paddingCanvas.getContext('2d')!

    paddingCanvasCtx.drawImage(croppedCanvas, (paddingCanvas.width - croppedCanvas.width) / 2, (paddingCanvas.height - croppedCanvas.height) / 2, croppedCanvas.width, croppedCanvas.height)
    const paddingDataUrl = paddingCanvas.toDataURL()

    cleanup()

    return paddingDataUrl
  }
  catch (error) {
    console.error(error)
    cleanup()
  }
}

export interface Live2dCardThumbnailResult {
  previewImage: string | undefined
  cache: Live2dThumbnailCache | undefined
  generated: boolean
  cacheUpdated: boolean
}

export async function computeLive2dCardThumbnail(
  file: File,
  cache: Live2dThumbnailCache | undefined,
  source: Live2dThumbnailSource,
): Promise<Live2dCardThumbnailResult> {
  let nextCache = cache
  let generated = false
  let cacheUpdated = false

  async function ensureRender(): Promise<string | undefined> {
    const cached = readLive2dThumbnailCache(nextCache, 'render')
    if (cached)
      return cached
    generated = true
    const previewImage = await renderLive2dZipPreview(file)
    nextCache = writeLive2dThumbnailCache(nextCache, 'render', previewImage)
    cacheUpdated = true
    return previewImage
  }

  async function ensureZipIcon(): Promise<string | undefined> {
    const cached = readLive2dThumbnailCache(nextCache, 'zipIcon')
    if (cached)
      return cached
    generated = true
    const previewImage = await tryLoadLive2dZipIconPreview(file)
    if (previewImage) {
      nextCache = writeLive2dThumbnailCache(nextCache, 'zipIcon', previewImage)
      cacheUpdated = true
    }
    return previewImage
  }

  let previewImage: string | undefined

  if (source === 'render-fallback-icon') {
    previewImage = await ensureRender()
    if (!previewImage)
      previewImage = await ensureZipIcon()
  }
  else {
    previewImage = await ensureZipIcon()
    if (!previewImage)
      previewImage = await ensureRender()
  }

  return { previewImage, cache: nextCache, generated, cacheUpdated }
}

export async function loadLive2DModelPreview(file: File, options?: { source?: Live2dThumbnailSource }) {
  const source = options?.source ?? getLive2dThumbnailSource()
  const { previewImage } = await computeLive2dCardThumbnail(file, undefined, source)
  return previewImage
}
