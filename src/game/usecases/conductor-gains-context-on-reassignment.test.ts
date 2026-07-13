import { describe, expect, it } from 'vitest'
import { fillAgentContext } from '../mechanics'
import { contextSizeForLevel, getModelTier } from '../models'
import { getHallucinationLevel } from '../prestige'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

describe('conductor-gains-context-on-reassignment', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const conductor: Agent = {
      ...template,
      id: 'conductor-1',
      job: 'conductor',
      projectId: project.id,
      status: 'conducting',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }
    const bench: Agent = {
      ...template,
      id: 'bench-1',
      job: null,
      projectId: null,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
          crewCap: 3,
        },
      ],
      agents: [conductor, bench],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const staffedConductor = state.agents.find((a) => a.id === conductor.id)!
    const refineAgent = state.agents.find((a) => a.projectId === project.id && a.job === 'refine')

    expect(refineAgent).toBeTruthy()

    const modelTierIndex = getHallucinationLevel(state.meta, 'model')
    const model = getModelTier(modelTierIndex)!
    const contextSize = contextSizeForLevel(model.contextSize, getHallucinationLevel(state.meta, 'context'))
    const expectedGain = (() => {
      const scratch = { ...conductor }
      fillAgentContext(scratch, contextSize, 1, 1, 1)
      return scratch.contextUsed
    })()

    expect(staffedConductor.contextUsed).toBeCloseTo(expectedGain, 5)
    expect(staffedConductor.contextUsed).toBeGreaterThan(0)
  })
})
