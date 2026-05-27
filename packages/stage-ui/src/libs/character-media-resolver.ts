import { useBackgroundStore } from '../stores/background'
import { useDisplayModelsStore } from '../stores/display-models'

// Global memory caches to avoid duplicate zip parsing or canvas computation
export const iconCache = new Map<string, string>()
export const colorCache = new Map<string, { light: string, dark: string }>()

export function getLatestSelfie(cardId: string): string | null {
  try {
    const backgroundStore = useBackgroundStore()
    const entries = backgroundStore.getCharacterJournalEntries(cardId)
    const selfies = entries.filter(e => e.type === 'selfie')
    if (selfies.length === 0)
      return null
    const sorted = [...selfies].sort((a, b) => b.createdAt - a.createdAt)
    return backgroundStore.getBackgroundUrl(sorted[0].id)
  }
  catch {
    return null
  }
}

export async function extractModelIcon(displayModelId: string): Promise<string | null> {
  if (iconCache.has(displayModelId)) {
    return iconCache.get(displayModelId) || null
  }

  const displayModelsStore = useDisplayModelsStore()
  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  if (!model)
    return null

  try {
    let zipData: Blob | File | null = null
    if (model.type === 'file') {
      zipData = model.file
    }
    else if (model.type === 'url') {
      const res = await fetch(model.url)
      zipData = await res.blob()
    }

    if (zipData) {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(zipData)
      const iconFileName = Object.keys(zip.files).find((name) => {
        const lower = name.toLowerCase()
        return lower.endsWith('icon.png') || lower.endsWith('icon.jpg')
      })
      if (iconFileName) {
        const fileData = await zip.files[iconFileName].async('blob')
        const url = URL.createObjectURL(fileData)
        iconCache.set(displayModelId, url)
        return url
      }
    }
    iconCache.set(displayModelId, '')
    return null
  }
  catch (e) {
    console.error('[CharacterMediaResolver] Failed to extract icon:', e)
    iconCache.set(displayModelId, '')
    return null
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r = l
  let g = l
  let b = l
  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0)
        t += 1
      if (t > 1)
        t -= 1
      if (t < 1 / 6)
        return p + (q - p) * 6 * t
      if (t < 1 / 2)
        return q
      if (t < 2 / 3)
        return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function getContrastingComplementaryColor(
  r: number,
  g: number,
  b: number,
  _threshold = 0.5,
  darkValue = 0.12, // 12% lightness for dark mode
  brightValue = 0.95, // 95% lightness for light mode
  saturation = 0.20, // Muted pastels (20% saturation) for premium look
): { light: string, dark: string } {
  const [h] = rgbToHsl(r, g, b)
  const compH = (h + 0.5) % 1.0

  const lightRgb = hslToRgb(compH, saturation, brightValue)
  const lightHex = `#${lightRgb.map(x => x.toString(16).padStart(2, '0')).join('')}`

  const darkRgb = hslToRgb(compH, saturation, darkValue)
  const darkHex = `#${darkRgb.map(x => x.toString(16).padStart(2, '0')).join('')}`

  return {
    light: lightHex,
    dark: darkHex,
  }
}

export async function extractComplementaryColors(imageUrl: string): Promise<{ light: string, dark: string } | null> {
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl) || null
  }

  // Check localStorage first
  const cacheKey = `airi_cc_${imageUrl}`
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(cacheKey) : null
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      colorCache.set(imageUrl, parsed)
      return parsed
    }
    catch {}
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32 // small size is extremely fast
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const imgData = ctx.getImageData(0, 0, size, size)

        let sumR = 0
        let sumG = 0
        let sumB = 0
        let count = 0
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i]
          const g = imgData.data[i + 1]
          const b = imgData.data[i + 2]
          const a = imgData.data[i + 3]

          // Only average non-transparent, non-white, non-black pixels
          if (a > 50 && (r <= 245 || g <= 245 || b <= 245) && (r >= 15 || g >= 15 || b >= 15)) {
            sumR += r
            sumG += g
            sumB += b
            count++
          }
        }

        if (count === 0) {
          resolve(null)
          return
        }

        const avgR = Math.round(sumR / count)
        const avgG = Math.round(sumG / count)
        const avgB = Math.round(sumB / count)

        const colors = getContrastingComplementaryColor(avgR, avgG, avgB)
        colorCache.set(imageUrl, colors)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(colors))
        }
        resolve(colors)
      }
      catch (e) {
        console.error('[CharacterMediaResolver] Canvas extraction failed:', e)
        resolve(null)
      }
    }
    img.onerror = () => {
      resolve(null)
    }
  })
}
