const STAGE_MARKER = /<\|(?:[^|]|\|(?!>))*\|>/g
const ESCAPED_STAGE_MARKER = /<\{'\|'\}(?:[^}]|\}(?!>))*\{'\|'\}>/g

function replacePreservingLength(text: string, pattern: RegExp): string {
  return text.replace(pattern, match => ' '.repeat(match.length))
}

/** Replaces AIRI stage markers so HTML and XML tag parsers do not treat them as elements. */
export function shieldStageMarkersForHtmlParse(text: string): string {
  return replacePreservingLength(replacePreservingLength(text, ESCAPED_STAGE_MARKER), STAGE_MARKER)
}
