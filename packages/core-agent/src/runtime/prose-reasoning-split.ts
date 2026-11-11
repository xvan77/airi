import { stripStreamingControlMarkersFromVisibleSpeech } from './streaming-control-visible-speech'

const PLANNING_LINE = /^(?:The user said|Looking at the previous|Emotion flow|Initial emotion|Initial:|Constraint:|Tone:|Draft:|Response:|Plan:|Analysis:|Notes?:|Let's go with|Now it is|AIRI is|AIRI should|I need to|Let me think)/i

const ANSWER_BOUNDARY = /(?:^|\n)\s*(?:Response|Draft|Final(?:\s+answer)?)\s*:\s*/gi

function looksLikePlanningMonologue(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed)
    return false
  const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean)
  const planningLines = lines.filter(line => PLANNING_LINE.test(line)).length
  if (planningLines >= 1)
    return true
  if (trimmed.length < 32)
    return false
  return /^(?:The user said|Looking at the previous|Emotion flow)/i.test(trimmed)
}

/**
 * Splits model prose that appears before the first stage marker.
 * Models often emit planning text, then `<|ACT|>` tokens.
 */
export function splitPlanningBeforeStageMarkers(text: string): { planning: string, remainder: string } {
  const markerIndex = text.indexOf('<|')
  if (markerIndex < 0)
    return { planning: '', remainder: text }

  const planning = text.slice(0, markerIndex).trim()
  const remainder = text.slice(markerIndex).trim()
  if (!looksLikePlanningMonologue(planning))
    return { planning: '', remainder: text }

  return { planning, remainder }
}

/**
 * Splits long planning prose when the model never uses stage markers or thought tags.
 */
export function splitProsePlanningFromSpeech(speech: string): { speech: string, reasoning: string } {
  const text = speech.trim()
  if (!text)
    return { speech: '', reasoning: '' }

  if (!looksLikePlanningMonologue(text))
    return { speech: text, reasoning: '' }

  let lastBoundary = -1
  for (const match of text.matchAll(ANSWER_BOUNDARY))
    lastBoundary = match.index! + match[0].length

  if (lastBoundary > 0) {
    const prefix = text.slice(0, lastBoundary).trim()
    let answer = text.slice(lastBoundary).trim()
    answer = stripStreamingControlMarkersFromVisibleSpeech(answer).trim()
    if (prefix.length >= 24 && answer.length > 0)
      return { speech: answer, reasoning: prefix }
  }

  if (looksLikePlanningMonologue(text) && !stripStreamingControlMarkersFromVisibleSpeech(text).trim()) {
    return { speech: '', reasoning: text }
  }

  return { speech: text, reasoning: '' }
}

export function mergeReasoningParts(...parts: Array<string | undefined>): string {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => !!part)
    .join('\n\n')
}
