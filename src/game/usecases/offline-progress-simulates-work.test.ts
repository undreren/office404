import { describe, expect, it } from 'vitest'
import { CONTEXT_FILL_SECONDS } from '../constants'
import { applyOfflineProgressMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { contextFillPct } from '../mechanics'
import { contextSizeForLevel, getModelTier } from '../models'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

function codingAgentState(): GameState {
  const base = stateWithCash(initialPlaying(), 2000)
  const enrolled = dispatchChain(base, [buyVibingCourseMsg(T0 + 500, 'offline')])
  const project = enrolled.projects[0]!
  const req = project.requirements[0]!
  const task: Task = {
    id: 'task-code',
    projectId: project.id,
    requirementId: req.id,
    title: 'Code me',
    storyPointsRequired: 20,
    storyPointsEarned: 0,
    complexity: 2,
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
  }
  return {
    ...enrolled,
    projects: [
      {
        ...project,
        tasks: [task],
        roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
      },
    ],
    agents: enrolled.agents.map((a) => ({
      ...a,
      job: 'code' as const,
      projectId: project.id,
      status: 'working' as const,
      taskId: task.id,
      contextUsed: 0,
      compactingRemainingSec: 0,
    })),
    snapshotAt: T0,
  }
}

describe('offline-progress-simulates-work', () => {
  it('earns story points when simulating away time in one offline catch-up', () => {
    const awaySec = 60
    const before = codingAgentState()
    const earnedBefore = before.projects[0]!.tasks[0]!.storyPointsEarned

    const live = dispatchChain(before, Array.from({ length: awaySec }, (_, i) => timeElapsed(T0 + 1000 + i, 1)))
    const offline = dispatchChain(before, [applyOfflineProgressMsg(T0 + awaySec * 1000, awaySec)])

    const liveEarned = live.projects[0]!.tasks[0]!.storyPointsEarned
    const offlineEarned = offline.projects[0]!.tasks[0]!.storyPointsEarned

    expect(liveEarned).toBeGreaterThan(earnedBefore)
    expect(offlineEarned).toBeGreaterThan(earnedBefore)
    expect(offlineEarned).toBeCloseTo(liveEarned, 5)
  })

  it('does not leave staffed coders at full context with zero task progress', () => {
    const awaySec = CONTEXT_FILL_SECONDS - 1
    const before = codingAgentState()
    const model = getModelTier(0)!
    const contextSizeK = contextSizeForLevel(model.contextSize, 0)
    const contextTokens = contextSizeK * 1000

    const after = dispatchChain(before, [applyOfflineProgressMsg(T0 + awaySec * 1000, awaySec)])
    const agent = after.agents.find((a) => a.job === 'code')!
    const earned = after.projects[0]!.tasks[0]!.storyPointsEarned

    expect(earned).toBeGreaterThan(0)
    expect(agent.contextUsed).toBeLessThan(contextTokens)
    expect(agent.status).not.toBe('compacting')
    expect(contextFillPct(agent.contextUsed, contextSizeK)).toBeLessThan(100)
  })
})
