import { describe, expect, it } from 'vitest'
import { RENT_INTERVAL_DAYS } from '../constants'
import { HOUSING_CONFIG } from '../housing'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('rent-due-deducts-cash', () => {
  it('matches use case invariants', () => {
    const rent = HOUSING_CONFIG.cardboard.rent
    const before = stateWithCash(initialPlaying(), 100)
    const state = advanceGameDays(before, RENT_INTERVAL_DAYS, T0 + 10_000)

    expect(state.cash).toBe(100 - rent)
  })
})
