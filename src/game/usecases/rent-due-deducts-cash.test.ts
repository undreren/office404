import { describe, expect, it } from 'vitest'
import { APARTMENT_CONFIG, RENT_INTERVAL_DAYS } from '../constants'
import { stateWithCash } from './_helpers/stateWithCash'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('rent-due-deducts-cash', () => {
  it('matches use case invariants', () => {
    const rent = APARTMENT_CONFIG.cardboard.rent
    const before = stateWithCash(initialPlaying(), 100)
    const state = advanceGameDays(before, RENT_INTERVAL_DAYS, T0 + 10_000)

    expect(state.cash).toBe(100 - rent)
    expect(state.rentDueInDays).toBeCloseTo(RENT_INTERVAL_DAYS, 0)
  })
})
