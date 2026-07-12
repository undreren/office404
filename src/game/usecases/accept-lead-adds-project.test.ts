import { describe, expect, it } from 'vitest'
import { LEAD_SPAWN_INTERVAL_DAYS, SECONDS_PER_GAME_DAY } from '../constants'
import { acceptLeadMsg, timeElapsed } from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import { dispatchChain } from './_helpers/dispatchChain'

const SEED = 42
const T0 = 1_000_000

describe('accept-lead-adds-project', () => {
  it('matches use case invariants', () => {
    const spawnSec = LEAD_SPAWN_INTERVAL_DAYS * SECONDS_PER_GAME_DAY

    let state = createInitialState(T0, SEED)
    state = dispatchChain(state, [timeElapsed(T0 + 1000, spawnSec)])

    const available = state.leads.filter((l) => l.status === 'available')
    expect(available.length).toBeGreaterThan(0)

    const lead = available[0]!
    const prevCount = state.projects.length
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    expect(state.projects.length).toBe(prevCount + 1)
    expect(state.leads.find((l) => l.id === lead.id)?.status).toBe('accepted')
    expect(state.projects.some((p) => p.clientName === lead.clientName)).toBe(true)
    expect(state.phase).toBe('playing')
  })
})
