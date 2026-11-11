import { describe, expect, it } from 'vitest'

import { splitPlanningBeforeStageMarkers, splitProsePlanningFromSpeech } from './prose-reasoning-split'
import { categorizeResponse } from './response-categoriser'

describe('splitProsePlanningFromSpeech', () => {
  it('splits Gemma-style planning before the spoken line', () => {
    const input = [
      'The user said "hey".',
      'Emotion flow: happy.',
      'Response: Hey! Did you miss me?',
    ].join('\n')
    const split = splitProsePlanningFromSpeech(input)
    expect(split.reasoning).toContain('The user said')
    expect(split.speech).toBe('Hey! Did you miss me?')
  })
})

describe('splitPlanningBeforeStageMarkers', () => {
  it('moves prose before the first stage marker into planning', () => {
    const input = 'The user said "hey".\nResponse: <|ACT {"emotion":"happy"}|> Hey!'
    const split = splitPlanningBeforeStageMarkers(input)
    expect(split.planning).toContain('The user said')
    expect(split.remainder).toMatch(/^<\|ACT/)
  })
})

describe('categorizeResponse gemma regressions', () => {
  it('strips orphan closing-tag tails from visible speech', () => {
    const input = 'ght> Hey there!'
    const result = categorizeResponse(input)
    expect(result.speech).toBe('Hey there!')
    expect(result.speech).not.toContain('ght>')
  })

  it('does not leak thought tag tails into visible speech', () => {
    const input = [
      'The user said "hey". Looking at the previous history.',
      '<|ACT {"emotion":"happy"}|> Hey!',
    ].join('\n')
    const result = categorizeResponse(input)
    expect(result.speech).toBe('Hey!')
    expect(result.speech).not.toContain('ght>')
    expect(result.reasoning.length).toBeGreaterThan(10)
  })

  it('keeps plain planning out of visible speech without thought tags', () => {
    const input = [
      'The user said "of course".',
      'Emotion flow: happy.',
      'Draft: <|ACT {"emotion":"happy"}|> Hehe, really?',
    ].join('\n')
    const result = categorizeResponse(input)
    expect(result.reasoning).toContain('The user said')
    expect(result.speech).toContain('Hehe, really?')
    expect(result.speech).not.toContain('Emotion flow')
  })
})
