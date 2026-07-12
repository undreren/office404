import { describe, expect, it } from 'vitest'
import { EXPIRED_LEAD_REP_PENALTY } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { T0 } from './_helpers/testConstants'
import { SECONDS_PER_GAME_DAY } from '../constants'

describe('lead-expires-reduces-reputation', () => {
  it('matches use case invariants', () => {
    let state = stateWithAvailableLead()
    const lead = state.leads.find((l) => l.status === 'available')!
    const repBefore = state.reputation
    const expireDays = lead.daysToExpire + 0.5

    state = dispatchChain(state, [timeElapsed(T0 + 20_000, expireDays * SECONDS_PER_GAME_DAY)])

    expect(state.leads.find((l) => l.id === lead.id)?.status).toBe('expired')
    expect(state.reputation).toBe(repBefore - EXPIRED_LEAD_REP_PENALTY)
  })
})
