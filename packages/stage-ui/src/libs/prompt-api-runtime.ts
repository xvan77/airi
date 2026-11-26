import { isStageTamagotchi } from '@proj-airi/stage-shared'

/**
 * Chrome Prompt API runs in desktop Chrome, not in AIRI Tamagotchi (Electron).
 */
export function isPromptApiSupportedHost(): boolean {
  if (typeof globalThis === 'undefined')
    return false
  if (isStageTamagotchi())
    return false
  return 'LanguageModel' in globalThis
}
