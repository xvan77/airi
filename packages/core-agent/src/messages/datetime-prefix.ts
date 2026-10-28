function padDatePart(value: number): string {
  return value.toString().padStart(2, '0')
}

/**
 * Formats a timestamp as `[YYYY-MM-DD HH:MM] ` in the user's local timezone.
 *
 * Use when:
 * - Annotating user messages so the model has a concrete time anchor on
 *   every turn — historic and current user turns use the same shape so that
 *   prefix-cache stays valid when a "current" turn becomes "historic" on
 *   the next send.
 * - Not used for assistant messages — that caused the model to mirror the
 *   prefix into its own output.
 *
 * Returns:
 * - String including a trailing space, e.g. `"[2026-04-25 18:47] "`.
 *
 * Before:
 * - createdAt = 1745570820000  (a Unix ms in Asia/Shanghai)
 *
 * After:
 * - "[2026-04-25 18:47] "
 */
export function formatTimePrefix(createdAt: number): string {
  const date = new Date(createdAt)
  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  const hour = padDatePart(date.getHours())
  const minute = padDatePart(date.getMinutes())

  return `[${year}-${month}-${day} ${hour}:${minute}] `
}

const PROMPT_TIME_PREFIX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/

/**
 * Removes leading `[YYYY-MM-DD HH:MM] ` prefixes from assistant text.
 * Local models sometimes echo the user-turn time anchor from the prompt.
 */
export function stripPromptTimePrefix(text: string): string {
  let result = text
  while (PROMPT_TIME_PREFIX.test(result))
    result = result.replace(PROMPT_TIME_PREFIX, '')
  return result
}

export interface PromptTimePrefixEchoStripState {
  hold: string
  resolved: boolean
  /** The prior chunk was only a prompt prefix. Trim leading space on the next chunk. */
  trimLeadingSpace: boolean
}

function mightBeSplitPromptTimePrefix(text: string): boolean {
  if (text === '[')
    return true
  if (!/^\[\d/.test(text))
    return false
  if (/\]/.test(text))
    return false
  return /^\[[\d\-: ]+$/.test(text) && text.length <= 18
}

/** Emits text held while waiting for the rest of a split time prefix. Call at stream end. */
export function drainPromptTimePrefixEchoHold(state: PromptTimePrefixEchoStripState): string {
  if (state.trimLeadingSpace) {
    state.trimLeadingSpace = false
    state.resolved = true
  }

  const held = state.hold
  state.hold = ''
  if (!held)
    return ''

  state.resolved = true
  const stripped = stripPromptTimePrefix(held)
  return stripped || held
}

/**
 * Strips a leading prompt time prefix from streamed assistant speech chunks.
 * Buffers text while a split prefix may still arrive in the next chunk.
 */
export function takeSpeechAfterPromptTimePrefixEcho(
  state: PromptTimePrefixEchoStripState,
  chunk: string,
): string {
  if (state.trimLeadingSpace) {
    state.trimLeadingSpace = false
    state.resolved = true
    state.hold = ''
    return chunk.trimStart()
  }

  if (state.resolved)
    return chunk

  const combined = state.hold + chunk
  const stripped = stripPromptTimePrefix(combined)
  if (stripped !== combined) {
    state.hold = ''
    if (stripped.length > 0) {
      state.resolved = true
      return stripped
    }
    state.trimLeadingSpace = true
    return ''
  }

  if (mightBeSplitPromptTimePrefix(combined)) {
    state.hold = combined
    return ''
  }

  state.resolved = true
  state.hold = ''
  return combined
}
