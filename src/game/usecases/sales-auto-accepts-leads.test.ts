import { describe, expect, it } from 'vitest'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import type { GameState } from '../types'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { SEED, T0 } from './_helpers/testConstants'

describe('sales-auto-accepts-leads', () => {
  function withActiveSalesAgent(state: GameState) {
    const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'sales')])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'sales', true)])
  }

  it('auto-accepts available real leads when the sales specialist is assigned', () => {
    let state: GameState = stateWithCash(
      {
        ...createInitialState(T0, SEED),
        tutorialDone: true,
        projects: [],
        agents: [],
      },
      5000,
    )
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    expect(lead.source).toBe('real')

    const withSales = withActiveSalesAgent(state)
    const after = dispatchChain(withSales, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.find((l) => l.id === lead.id)?.status).toBe('accepted')
    expect(after.projects.some((p) => p.clientName === lead.clientName)).toBe(true)
  })

  it('does not auto-accept when the sales specialist is unassigned', () => {
    let state: GameState = stateWithCash(
      {
        ...createInitialState(T0, SEED),
        tutorialDone: true,
        projects: [],
        agents: [],
      },
      5000,
    )
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    const withSales = withActiveSalesAgent(state)
    const unassigned = dispatchChain(withSales, [toggleSpecialistRoleMsg(T0 + 2000, 'sales', false)])

    const after = dispatchChain(unassigned, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.find((l) => l.id === lead.id)?.status).toBe('available')
    expect(after.projects.some((p) => p.clientName === lead.clientName)).toBe(false)
  })

  it('auto-accepts a lead that spawns on the same tick', () => {
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const withSales = withActiveSalesAgent({ ...base, projects: [], agents: base.agents.filter((a) => !a.isAutomation) })

    const after = dispatchChain(withSales, [timeElapsed(T0 + 3000, 1)])

    const available = after.leads.filter((l) => l.status === 'available')
    const accepted = after.leads.filter((l) => l.status === 'accepted')
    expect(available.length).toBe(0)
    expect(accepted.length).toBeGreaterThan(0)
    expect(after.projects.length).toBeGreaterThan(0)
  })
})
