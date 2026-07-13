import { describe, expect, it } from 'vitest'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('lead-spawns-after-cooldown', () => {
  it('matches use case invariants', () => {
    const before = { ...initialPlaying(), tutorialDone: true }
    const state = advanceUntilLeadSpawns(before, T0 + 5000)

    expect(state.leads.some((l) => l.status === 'available')).toBe(true)
  })
})
