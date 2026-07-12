import { describe, expect, it } from 'vitest'
import { COMPACT_DURATION_SEC } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('agent-context-compaction-recovers', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-compact',
      projectId: project.id,
      requirementId: req.id,
      title: 'Overflow',
      storyPointsRequired: 10,
      storyPointsEarned: 0,
      complexity: 2,
      refined: true,
      status: 'in_progress',
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
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'code' as const,
        projectId: project.id,
        status: 'working' as const,
        taskId: task.id,
        contextUsed: 3950,
        compactingRemainingSec: 0,
      })),
    }
    const statsBefore = before.stats.compactionsSurvived

    let state: GameState = dispatchChain(before, [timeElapsed(T0 + 100, 10)])
    expect(state.agents[0]!.status).toBe('compacting')

    state = dispatchChain(state, [timeElapsed(T0 + 200, COMPACT_DURATION_SEC)])

    expect(state.agents[0]!.status).not.toBe('compacting')
    expect(state.stats.compactionsSurvived).toBe(statsBefore + 1)
  })
})
