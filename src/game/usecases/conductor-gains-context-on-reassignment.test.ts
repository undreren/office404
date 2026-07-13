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

  it('charges context once per tick when multiple workers are reassigned', () => {
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
    const coderA: Agent = {
      ...template,
      id: 'coder-a',
      job: 'code',
      projectId: project.id,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }
    const coderB: Agent = {
      ...template,
      id: 'coder-b',
      job: 'code',
      projectId: project.id,
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
          roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
          requirements: [
            { ...project.requirements[0]!, status: 'open' },
            ...project.requirements.slice(1).map((r) => ({ ...r, status: 'refined' as const })),
          ],
          tasks: [
            {
              id: 'task-1',
              projectId: project.id,
              requirementId: project.requirements[1]!.id,
              title: 'Shippable chunk',
              storyPointsRequired: 1,
              storyPointsEarned: 0,
              complexity: 1,
              refined: true,
              status: 'open',
              assignedAgentId: null,
              completedByAgentId: null,
              parentTaskId: null,
              prQuality: null,
              prQualityStaging: 0,
              hasUndiscoveredBug: false,
              bugDiscovered: false,
              isBugFix: false,
              sourceTaskId: null,
              isReviewComment: false,
              reviewed: false,
              testStoryPointsEarned: 0,
              refinePassesRemaining: 0,
            },
          ],
        },
      ],
      agents: [conductor, coderA, coderB],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const staffedConductor = state.agents.find((a) => a.id === conductor.id)!
    const modelTierIndex = getHallucinationLevel(state.meta, 'model')
    const model = getModelTier(modelTierIndex)!
    const contextSize = contextSizeForLevel(model.contextSize, getHallucinationLevel(state.meta, 'context'))
    const expectedGain = (() => {
      const scratch = { ...conductor }
      fillAgentContext(scratch, contextSize, 1, 1, 1)
      return scratch.contextUsed
    })()

    expect(staffedConductor.contextUsed).toBeCloseTo(expectedGain, 5)
  })
})
