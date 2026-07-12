import { describe, expect, it } from 'vitest'
import { LEAD_SPAWN_INTERVAL_DAYS } from '../constants'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('leads-blocked-until-tutorial-done', () => {
  it('does not spawn leads while tutorial is incomplete', () => {
    const state = advanceGameDays(initialPlaying(), LEAD_SPAWN_INTERVAL_DAYS, T0 + 5000)

    expect(state.tutorialDone).toBe(false)
    expect(state.leads.some((l) => l.status === 'available')).toBe(false)
  })
})
