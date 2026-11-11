/**
 * Trims chat request size when Consciousness compact requests is on.
 */

/** Local inference needs small prompts and no tools. */
export function isOnDeviceSlimChatProvider(providerId: string | undefined): boolean {
  return providerId === 'local-llm'
}

export function usesCompactChatRequests(compactRequestsEnabled: boolean, _providerId: string | undefined): boolean {
  return compactRequestsEnabled
}

export function shouldIncludeChatFormatRules(compactRequests: boolean, providerId: string | undefined): boolean {
  if (isOnDeviceSlimChatProvider(providerId))
    return false
  return !compactRequests
}

/** Omits memory tools when compact mode has nothing to read yet. */
export function shouldAttachMemoryTools(memoryEnabled: boolean, memoryIndex: string, compactRequests: boolean): boolean {
  if (!memoryEnabled)
    return false
  if (!compactRequests)
    return true
  return memoryIndex.trim().length > 0
}
