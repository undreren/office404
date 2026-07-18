import { describe, expect, it } from 'vitest'
import {
  acceptLeadMsg,
  buyAgentSlotMsg,
  prestigeHallucinationBuyMsg,
  toggleSpecialistRoleMsg,
} from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import type { GameState } from '../types'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

const SEED = 99

function baseState(): GameState {
  return stateWithCash(
    {
      ...createInitialState(T0, SEED),
      tutorialDone: true,
      projects: [],
      agents: [],
      meta: {
        ...createInitialState(T0, SEED).meta,
        hallucinationLevels: { super_conductor: 1, project_manager: 1 },
      },
    },
    5_000,
  )
}

describe('super-conductor-pm-absorbs-conductor', () => {
  it('auto-enables virtual conductor on client projects without staffing a conductor agent', () => {
    let state = dispatchChain(baseState(), [
      buyAgentSlotMsg(T0 + 500),
      toggleSpecialistRoleMsg(T0 + 700, 'project_manager', true),
    ])
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(true)
    expect(project.roleCounts.conductor).toBe(0)
    expect(state.agents.some((a) => a.job === 'conductor' && a.projectId === project.id)).toBe(false)
  })

  it('does not apply without super conductor hallucination', () => {
    let state = dispatchChain(
      {
        ...baseState(),
        meta: {
          ...baseState().meta,
          hallucinationLevels: { project_manager: 1 },
        },
      },
      [buyAgentSlotMsg(T0 + 500), toggleSpecialistRoleMsg(T0 + 700, 'project_manager', true)],
    )
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(false)
  })

  it('can be purchased from the hallucination shop', () => {
    const before = {
      ...createInitialState(T0, SEED),
      meta: { ...createInitialState(T0, SEED).meta, hallucinationPoints: 5 },
    }
    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'super_conductor')])
    expect(after.meta.hallucinationLevels.super_conductor).toBe(1)
  })
})
