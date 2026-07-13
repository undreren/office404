import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/simulation/gameLogic'
import { applySkipOnboarding } from './fixture-loader'

describe('applySkipOnboarding', () => {
  it('marks story, tab intros, and tutorial steps as acknowledged', () => {
    const state = createInitialState(0, 1)
    const skipped = applySkipOnboarding(state)

    expect(skipped.seenStoryIntro).toBe(true)
    expect(skipped.seenTabIntros).toEqual(['status', 'shop', 'projects', 'leads', 'hallucinations'])
    expect(skipped.acknowledgedTutorialStep).toBe(3)
  })
})
