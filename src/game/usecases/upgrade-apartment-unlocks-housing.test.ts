import { describe, expect, it } from 'vitest'
import { HOUSING_CONFIG } from '../housing'
import { upgradeApartmentMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('upgrade-apartment-unlocks-housing', () => {
  it('matches use case invariants', () => {
    const cost = HOUSING_CONFIG.shared_1br.upgradeCost
    const before = stateWithCash(initialPlaying(), 100)

    const state = dispatchChain(before, [upgradeApartmentMsg(T0 + 1000)])

    expect(state.apartment).toBe('shared_1br')
    expect(state.cash).toBe(100 - cost)
  })
})
