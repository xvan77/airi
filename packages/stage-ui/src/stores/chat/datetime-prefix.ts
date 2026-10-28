export { formatTimePrefix } from '@proj-airi/core-agent'

// NOTICE:
// Duplicated from `packages/core-agent/src/messages/datetime-prefix.ts` so stage-ui
// does not depend on a rebuilt `@proj-airi/core-agent` dist during local dev.
// Keep the regex in sync with core-agent when the prompt prefix shape changes.
const PROMPT_TIME_PREFIX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/

/**
 * Removes leading `[YYYY-MM-DD HH:MM] ` prefixes from text before TTS.
 * Local models sometimes echo the user-turn time anchor from the chat prompt.
 */
export function stripPromptTimePrefix(text: string): string {
  let result = text
  while (PROMPT_TIME_PREFIX.test(result))
    result = result.replace(PROMPT_TIME_PREFIX, '')
  return result
}
