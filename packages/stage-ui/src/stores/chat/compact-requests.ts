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

/** Omits memory tools when compact mode has nothing to read yet, or when the provider is on-device slim. */
export function shouldAttachMemoryTools(
  memoryEnabled: boolean,
  memoryIndex: string,
  compactRequests: boolean,
  providerId?: string,
): boolean {
  if (!memoryEnabled)
    return false
  if (isOnDeviceSlimChatProvider(providerId))
    return false
  if (!compactRequests)
    return true
  return memoryIndex.trim().length > 0
}
