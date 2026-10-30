/** Stable id for a Tamagotchi renderer window shown in loading copy. */
export type RendererWindowLoadLabelId
  = | 'main'
    | 'model'
    | 'settings'
    | 'consciousness'
    | 'speech'
    | 'chat'
    | 'workspace'
    | 'onboarding'
    | 'about'
    | 'caption'
    | 'spotlight'
    | 'widgets'
    | 'editor'
    | 'inlay'
    | 'notice'
    | 'devtools'
    | 'dashboard'
    | 'desktop-overlay'
    | 'other'

function normalizeRoutePath(routePath: string) {
  const [path = ''] = routePath.split(/[?#]/)
  if (!path || path === '/')
    return '/'
  return path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Maps a renderer hash route to the loading label id for that window.
 *
 * @example
 * resolveRendererWindowLoadLabelId('/settings/providers')
 * // => 'settings'
 */
export function resolveRendererWindowLoadLabelId(routePath: string): RendererWindowLoadLabelId {
  const path = normalizeRoutePath(routePath)

  if (path === '/')
    return 'main'
  if (path === '/chat' || path === '/chat-floating' || path.startsWith('/chat/'))
    return 'chat'
  if (path === '/settings/modules/consciousness' || path.startsWith('/settings/modules/consciousness/'))
    return 'consciousness'
  if (path === '/settings/modules/speech' || path.startsWith('/settings/modules/speech/'))
    return 'speech'
  if (path.startsWith('/settings'))
    return 'settings'
  if (path === '/workspace' || path.startsWith('/workspace/'))
    return 'workspace'
  if (path === '/onboarding' || path.startsWith('/onboarding/'))
    return 'onboarding'
  if (path === '/about')
    return 'about'
  if (path === '/caption')
    return 'caption'
  if (path === '/spotlight')
    return 'spotlight'
  if (path === '/widgets' || path.startsWith('/widgets/'))
    return 'widgets'
  if (path === '/editor' || path.startsWith('/editor/'))
    return 'editor'
  if (path === '/inlay' || path.startsWith('/inlay/'))
    return 'inlay'
  if (path === '/notice' || path.startsWith('/notice/'))
    return 'notice'
  if (path === '/devtools' || path.startsWith('/devtools/'))
    return 'devtools'
  if (path === '/dashboard' || path.startsWith('/dashboard/'))
    return 'dashboard'
  if (path === '/desktop-overlay')
    return 'desktop-overlay'

  return 'other'
}

/** Reads the hash route from a renderer URL or load target before Vue starts. */
export function resolveRendererWindowLoadLabelIdFromLocation(
  hash = globalThis.location?.hash ?? '',
): RendererWindowLoadLabelId {
  const hashPath = hash.startsWith('#') ? hash.slice(1) : hash
  return resolveRendererWindowLoadLabelId(hashPath || '/')
}

export function extractRendererRouteFromLoadTarget(
  target: string | { url: string } | { file: string, options?: { hash?: string } },
): string {
  if (typeof target === 'string') {
    try {
      const hashPath = new URL(target).hash
      return normalizeRoutePath(hashPath.startsWith('#') ? hashPath.slice(1) : hashPath || '/')
    }
    catch {
      return '/'
    }
  }

  if ('url' in target) {
    try {
      const hashPath = new URL(target.url).hash
      return normalizeRoutePath(hashPath.startsWith('#') ? hashPath.slice(1) : hashPath || '/')
    }
    catch {
      return '/'
    }
  }

  const hash = target.options?.hash ?? ''
  const hashPath = hash.startsWith('#') ? hash.slice(1) : hash
  return normalizeRoutePath(hashPath || '/')
}
