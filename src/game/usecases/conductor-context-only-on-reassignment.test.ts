import { describe, expect, it } from 'vitest'
import { TICK_INTERVAL_MS } from '../constants'
import { fillAgentContext } from '../mechanics'
import { contextSizeForLevel, getModelTier } from '../models'
import { getHallucinationLevel } from '../prestige'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

const TICK_SEC = TICK_INTERVAL_MS / 1000

function conductorStableState(): GameState {
  const base = initialPlaying()
  const project = base.projects[0]!
  const template = base.agents[0]!
  const taskA: Task = {
    id: 'task-a',
    projectId: project.id,
    requirementId: project.requirements[1]!.id,
    title: 'Chunk A',
    storyPointsRequired: 100,
    storyPointsEarned: 0,
    complexity: 2,
    refined: true,
    status: 'in_progress',
    assignedAgentId: 'coder-a',
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
  }
  const taskB: Task = {
    ...taskA,
    id: 'task-b',
    title: 'Chunk B',
    assignedAgentId: 'coder-b',
  }
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
    status: 'working',
    taskId: taskA.id,
    contextUsed: 0,
    compactingRemainingSec: 0,
  }
  const coderB: Agent = {
    ...template,
    id: 'coder-b',
    job: 'code',
    projectId: project.id,
    status: 'working',
    taskId: taskB.id,
    contextUsed: 0,
    compactingRemainingSec: 0,
  }

  return {
    ...base,
    vibingCourses: ['conductor'],
    projects: [
      {
        ...project,
        useConductor: true,
        roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
        requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
        tasks: [taskA, taskB],
      },
    ],
    agents: [conductor, coderA, coderB],
  }
}

describe('conductor-context-only-on-reassignment', () => {
  it('does not build context while the crew is stable at 30fps', () => {
    let state = conductorStableState()

    for (let i = 0; i < 90; i++) {
      state = dispatchChain(state, [timeElapsed(T0 + 1000 + i, TICK_SEC)])
    }

    const conductor = state.agents.find((a) => a.id === 'conductor-1')!
    expect(conductor.contextUsed).toBe(0)
  })

  it('does not build context when conductor evicts and restaffs the same idle worker at cap', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const taskBusy: Task = {
      id: 'task-busy',
      projectId: project.id,
      requirementId: project.requirements[1]!.id,
      title: 'Busy chunk',
      storyPointsRequired: 100,
      storyPointsEarned: 0,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'coder-a',
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
    }
    const taskOpen: Task = {
      ...taskBusy,
      id: 'task-open',
      title: 'Open chunk',
      status: 'open',
      assignedAgentId: null,
    }
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
      status: 'working',
      taskId: taskBusy.id,
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

    let state: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [taskBusy, taskOpen],
        },
      ],
      agents: [conductor, coderA, coderB],
    }

    for (let i = 0; i < 90; i++) {
      state = dispatchChain(state, [timeElapsed(T0 + 1000 + i, TICK_SEC)])
    }

    const conductorAfter = state.agents.find((a) => a.id === 'conductor-1')!
    const projectAgents = state.agents.filter((a) => a.projectId === project.id && a.job && a.job !== 'conductor')
    expect(projectAgents.map((a) => a.id).sort()).toEqual(['coder-a', 'coder-b'])
    expect(conductorAfter.contextUsed).toBe(0)
  })

  it('charges one simulation tick of context per reassignment at 30fps', () => {
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

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, TICK_SEC)])

    const staffedConductor = state.agents.find((a) => a.id === conductor.id)!
    const modelTierIndex = getHallucinationLevel(state.meta, 'model')
    const model = getModelTier(modelTierIndex)!
    const contextSize = contextSizeForLevel(model.contextSize, getHallucinationLevel(state.meta, 'context'))
    const expectedGain = (() => {
      const scratch = { ...conductor }
      fillAgentContext(scratch, contextSize, 1, TICK_SEC, 1)
      return scratch.contextUsed
    })()

    expect(staffedConductor.contextUsed).toBeCloseTo(expectedGain, 5)
    expect(staffedConductor.contextUsed).toBeGreaterThan(0)
    expect(staffedConductor.contextUsed).toBeLessThan(expectedGain * 2)
  })
})
