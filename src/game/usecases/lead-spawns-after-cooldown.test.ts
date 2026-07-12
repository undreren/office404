import { describe, expect, it } from 'vitest'
import { LEAD_SPAWN_INTERVAL_DAYS } from '../constants'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('lead-spawns-after-cooldown', () => {
  it('matches use case invariants', () => {
    const state = advanceGameDays(initialPlaying(), LEAD_SPAWN_INTERVAL_DAYS, T0 + 5000)

    expect(state.leads.some((l) => l.status === 'available')).toBe(true)
  })
})
