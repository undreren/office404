import { describe, expect, it } from 'vitest'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('leads-blocked-until-tutorial-done', () => {
  it('does not spawn leads while tutorial is incomplete', () => {
    const state = advanceGameDays(initialPlaying(), 4, T0 + 5000)

    expect(state.tutorialDone).toBe(false)
    expect(state.leads.some((l) => l.status === 'available')).toBe(false)
  })
})
