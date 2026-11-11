const STREAMING_CONTROL_MARKER = /<(?:\||\{'\|'\})(?:ACT|DELAY|CALL)\b[\s\S]*?(?:(?:\||\{'\|'\})>|$)/gi

// Some models omit the opening `<|`. The stage parser ignores these, but they must not appear in chat.
const MALFORMED_ACT_MARKER = /ACT\s+\{[\s\S]*?\}\s*\|>/gi

// Models often emit the malformed ACT line in one burst. During streaming, hide a trailing partial line.
const TRAILING_PARTIAL_MALFORMED_ACT = /ACT\s+\{[\s\S]*$/i

// A split or truncated closing tag can leave tails such as `ght>` from `</thought>`.
const ORPHAN_XML_CLOSE_TAG_TAIL = /(?:^|\s)(?:ght|ought|easoning|soning|ink)>(?=\s|$|[!?.])/gi

/**
 * Removes LLM streaming-control markers from text shown in chat or sent to TTS.
 *
 * Special tokens still flow through the marker parser for stage dispatch. This
 * helper only cleans visible speech when markers leak as literals or remain in
 * the raw completion string used for categorization.
 */
export function stripStreamingControlMarkersFromVisibleSpeech(
  text: string,
  options?: { collapseSpace?: boolean },
): string {
  let trimmed = text
    .replace(STREAMING_CONTROL_MARKER, '')
    .replace(MALFORMED_ACT_MARKER, '')
    .replace(TRAILING_PARTIAL_MALFORMED_ACT, '')
    .replace(ORPHAN_XML_CLOSE_TAG_TAIL, ' ')

  if (options?.collapseSpace)
    trimmed = trimmed.replace(/[^\S\n]{2,}/g, ' ')

  return trimmed
}
