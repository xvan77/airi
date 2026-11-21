/**
 * Headers that let the renderer use several CPU threads for Kokoro.
 * ONNX checks `crossOriginIsolated`. Without these headers it keeps one thread.
 */
export const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

/**
 * Add the isolation headers to one response. An existing isolation header is replaced.
 */
export function mergeCrossOriginIsolationHeaders(
  responseHeaders: Record<string, string | string[] | undefined> | undefined,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(responseHeaders ?? {})) {
    if (value == null)
      continue
    next[key] = Array.isArray(value) ? value : [value]
  }

  for (const [key, value] of Object.entries(crossOriginIsolationHeaders)) {
    const existingKey = Object.keys(next).find(header => header.toLowerCase() === key.toLowerCase())
    if (existingKey)
      next[existingKey] = [value]
    else
      next[key] = [value]
  }

  return next
}
