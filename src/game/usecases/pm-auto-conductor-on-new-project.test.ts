import { describe, expect, it } from 'vitest'
import {
  acceptLeadMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  toggleSpecialistRoleMsg,
} from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import type { GameState } from '../types'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { dispatchChain } from './_helpers/dispatchChain'
import { T0 } from './_helpers/testConstants'

const SEED = 42

describe('pm-auto-conductor-on-new-project', () => {
  it('enables conductor mode on new projects when PM is active', () => {
    let state: GameState = {
      ...createInitialState(T0, SEED),
      tutorialDone: true,
      projects: [],
      agents: [],
      vibingCourses: ['conductor', 'project_manager'],
    }
    state = dispatchChain(state, [
      buyAgentSlotMsg(T0 + 500),
      buyVibingCourseMsg(T0 + 600, 'project_manager'),
      toggleSpecialistRoleMsg(T0 + 700, 'project_manager', true),
    ])
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(true)
    expect(project.roleCounts.conductor).toBe(1)
    expect(project.roleCounts.refine).toBe(0)
    expect(project.roleCounts.code).toBe(0)
  })

  it('does not auto-enable conductor without PM assigned', () => {
    let state: GameState = {
      ...createInitialState(T0, SEED),
      tutorialDone: true,
      projects: [],
      agents: [],
      vibingCourses: ['conductor', 'project_manager'],
    }
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(false)
    expect(project.roleCounts.conductor).toBe(0)
  })
})
