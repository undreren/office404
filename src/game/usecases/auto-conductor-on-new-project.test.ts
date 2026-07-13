import { describe, expect, it } from 'vitest'
import { acceptLeadMsg } from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import type { GameState } from '../types'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { dispatchChain } from './_helpers/dispatchChain'
import { T0 } from './_helpers/testConstants'

const SEED = 42

describe('auto-conductor-on-new-project', () => {
  it('enables conductor mode when Auto Conductor course is owned', () => {
    let state: GameState = {
      ...createInitialState(T0, SEED),
      tutorialDone: true,
      projects: [],
      agents: [],
      vibingCourses: ['conductor', 'auto_conductor'],
    }
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(true)
    expect(project.roleCounts.conductor).toBe(1)
    expect(project.roleCounts.refine).toBe(0)
    expect(project.roleCounts.code).toBe(0)
  })

  it('does not auto-enable without the Conductor course', () => {
    let state: GameState = {
      ...createInitialState(T0, SEED),
      tutorialDone: true,
      projects: [],
      agents: [],
      vibingCourses: ['auto_conductor'],
    }
    state = advanceUntilLeadSpawns(state, T0 + 1000)

    const lead = state.leads.find((l) => l.status === 'available')!
    state = dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.useConductor).toBe(false)
    expect(project.roleCounts.conductor).toBe(0)
  })
})
